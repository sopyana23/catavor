<#
.SYNOPSIS
    Sinkronisasi atomik & tahan-gagal daftar subnet resmi Cloudflare untuk Nginx / Caddy (N-56).
.DESCRIPTION
    1. Mengunduh subnet resmi dari https://www.cloudflare.com/ips-v4 dan ips-v6
       (atau membaca berkas fixture lokal HANYA saat PROXY_TYPE="none" untuk uji unit offline).
    2. Memvalidasi semantik IP/CIDR dual-stack + strict host-bits zero check + deduplikasi.
    3. Memeriksa batas kelengkapan: IPv4 unik [12..20] dan IPv6 unik [5..10].
    4. Mode PROXY_TYPE="none" terisolasi ketat ke ./deploy/test-output/ tanpa menyentuh konfigurasi aktif.
    5. Mode "nginx" / "caddy" menulis .tmp pada direktori yang sama, memvalidasi sintaks target proxy,
       membuat backup .bak, melakukan atomic swap, reload ber-timeout 10 detik, smoke test /healthz 5 detik,
       serta auto-rollback / safe quarantine bila gagal.
#>
[CmdletBinding()]
param(
    [ValidateSet("nginx", "caddy", "none")]
    [string]$ProxyType = $(if ($env:PROXY_TYPE) { $env:PROXY_TYPE } else { "none" }),
    [string]$DeployDir = $PSScriptRoot,
    [string]$HealthUrl = $(if ($env:CATAVOR_HEALTH_URL) { $env:CATAVOR_HEALTH_URL } else { "http://127.0.0.1:8000/healthz" }),
    [string]$TestInputV4 = $env:CF_IPS_V4_FILE,
    [string]$TestInputV6 = $env:CF_IPS_V6_FILE
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($DeployDir)) {
    $DeployDir = $PSScriptRoot
}

function Test-CanonicalCidr {
    param(
        [Parameter(Mandatory = $true)][string]$Cidr,
        [Parameter(Mandatory = $true)][ValidateSet("v4", "v6")][string]$Family
    )
    $trimmed = $Cidr.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed -notmatch '^([^/\s]+)/(\d{1,3})$') {
        return $null
    }
    $ipPart = $Matches[1]
    $prefixLen = [int]$Matches[2]

    $ipObj = $null
    if (-not [System.Net.IPAddress]::TryParse($ipPart, [ref]$ipObj)) {
        return $null
    }

    $bytes = $ipObj.GetAddressBytes()
    if ($Family -eq "v4") {
        if ($ipObj.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or $bytes.Length -ne 4) {
            return $null
        }
        if ($prefixLen -lt 8 -or $prefixLen -gt 32) {
            return $null
        }
    } else {
        if ($ipObj.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetworkV6 -or $bytes.Length -ne 16) {
            return $null
        }
        if ($prefixLen -lt 16 -or $prefixLen -gt 128) {
            return $null
        }
    }

    # Strict Host-Bits Zero Check: seluruh bit setelah prefixLen WAJIB bernilai 0
    $totalBits = $bytes.Length * 8
    for ($bit = $prefixLen; $bit -lt $totalBits; $bit++) {
        $byteIdx = [math]::Floor($bit / 8)
        $bitOffset = 7 - ($bit % 8)
        if ((($bytes[$byteIdx] -shr $bitOffset) -band 1) -ne 0) {
            throw "Host bits tidak nol pada CIDR '$trimmed' (bukan alamat network kanonik)."
        }
    }

    return "$($ipObj.ToString().ToLowerInvariant())/$prefixLen"
}

function Get-CloudflareLines {
    param([string]$Url, [string]$OverrideFile, [string]$Mode)
    if (-not [string]::IsNullOrWhiteSpace($OverrideFile)) {
        if ($Mode -ne "none") {
            throw "Override berkas input lokal hanya diizinkan pada mode terisolasi PROXY_TYPE=none."
        }
        if (-not (Test-Path -LiteralPath $OverrideFile)) {
            throw "Berkas input uji tidak ditemukan: $OverrideFile"
        }
        return Get-Content -LiteralPath $OverrideFile -Encoding UTF8
    }

    $resp = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 15 -UseBasicParsing
    if ($resp.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($resp.Content)) {
        throw "Gagal mengunduh $Url (HTTP $($resp.StatusCode))."
    }
    if ($resp.Content -match '<html|<!DOCTYPE|cloudflare-challenge') {
        throw "Respons $Url terdeteksi berupa halaman HTML/challenge, bukan daftar CIDR."
    }
    return ($resp.Content -split "`r?`n")
}

try {
    $rawV4 = Get-CloudflareLines -Url "https://www.cloudflare.com/ips-v4" -OverrideFile $TestInputV4 -Mode $ProxyType
    $rawV6 = Get-CloudflareLines -Url "https://www.cloudflare.com/ips-v6" -OverrideFile $TestInputV6 -Mode $ProxyType

    $setV4 = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($line in $rawV4) {
        $t = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($t) -or $t.StartsWith("#")) { continue }
        $canon = Test-CanonicalCidr -Cidr $t -Family "v4"
        if (-not $canon) { throw "Baris IPv4 tidak valid: '$t'" }
        [void]$setV4.Add($canon)
    }

    $setV6 = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($line in $rawV6) {
        $t = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($t) -or $t.StartsWith("#")) { continue }
        $canon = Test-CanonicalCidr -Cidr $t -Family "v6"
        if (-not $canon) { throw "Baris IPv6 tidak valid: '$t'" }
        [void]$setV6.Add($canon)
    }

    $v4List = @($setV4) | Sort-Object
    $v6List = @($setV6) | Sort-Object

    if ($v4List.Count -lt 12 -or $v4List.Count -gt 20) {
        throw "Jumlah subnet IPv4 ($($v4List.Count)) berada di luar batas aman [12..20]."
    }
    if ($v6List.Count -lt 5 -or $v6List.Count -gt 10) {
        throw "Jumlah subnet IPv6 ($($v6List.Count)) berada di luar batas aman [5..10]."
    }

    $nginxLines = @(
        "# Auto-generated Cloudflare Trusted Subnets (Nginx)",
        "# IPv4 ($($v4List.Count) subnet)"
    ) + ($v4List | ForEach-Object { "set_real_ip_from $_;" }) + @(
        "",
        "# IPv6 ($($v6List.Count) subnet)"
    ) + ($v6List | ForEach-Object { "set_real_ip_from $_;" }) + @(
        "",
        "real_ip_header CF-Connecting-IP;",
        "real_ip_recursive on;"
    )
    $nginxContent = ($nginxLines -join "`n") + "`n"

    $allCidrs = ($v4List + $v6List) -join " "
    $caddyContent = "(cloudflare_trusted_proxies) {`n`ttrusted_proxies static $allCidrs`n`tclient_ip_headers CF-Connecting-IP X-Forwarded-For`n}`n"

    # Mode isolasi penuh untuk CI / unit-test tanpa menyentuh berkas konfigurasi aktif
    if ($ProxyType -eq "none") {
        $testOutDir = Join-Path $DeployDir "test-output"
        if (-not (Test-Path -LiteralPath $testOutDir)) {
            New-Item -ItemType Directory -Path $testOutDir -Force | Out-Null
        }
        $testNginx = Join-Path $testOutDir "cloudflare-ips.test.conf"
        $testCaddy = Join-Path $testOutDir "cloudflare-ips.test.caddy"
        [System.IO.File]::WriteAllText($testNginx, $nginxContent, [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($testCaddy, $caddyContent, [System.Text.UTF8Encoding]::new($false))
        Write-Host "[OK] Mode PROXY_TYPE=none: tervalidasi $($v4List.Count) IPv4 + $($v6List.Count) IPv6 -> $testNginx"
        exit 0
    }

    if ($ProxyType -eq "nginx") {
        $targetFile = Join-Path $DeployDir "cloudflare-ips.conf"
        $tmpFile = "$targetFile.tmp"
        $bakFile = "$targetFile.bak"
        [System.IO.File]::WriteAllText($tmpFile, $nginxContent, [System.Text.UTF8Encoding]::new($false))

        $mainConf = Join-Path $DeployDir "nginx.conf"
        $harnessConf = Join-Path $DeployDir ".nginx.harness.tmp.conf"
        $rawMain = [System.IO.File]::ReadAllText($mainConf)
        [System.IO.File]::WriteAllText($harnessConf, $rawMain.Replace("include cloudflare-ips.conf;", "include cloudflare-ips.conf.tmp;"), [System.Text.UTF8Encoding]::new($false))
        try {
            & nginx -t -c $harnessConf | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Validasi nginx -t gagal pada kandidat snippet baru." }
        } finally {
            Remove-Item -LiteralPath $harnessConf -Force -ErrorAction SilentlyContinue
        }

        if (Test-Path -LiteralPath $targetFile) { Copy-Item -LiteralPath $targetFile -Destination $bakFile -Force }
        Move-Item -LiteralPath $tmpFile -Destination $targetFile -Force

        $reloadJob = Start-Job -ScriptBlock { nginx -s reload }
        $completed = Wait-Job $reloadJob -Timeout 10
        $reloadOk = ($null -ne $completed) -and ($reloadJob.State -eq "Completed")
        Remove-Job $reloadJob -Force -ErrorAction SilentlyContinue

        $smokeOk = $false
        if ($reloadOk) {
            try {
                $hResp = Invoke-WebRequest -Uri $HealthUrl -Method Get -TimeoutSec 5 -UseBasicParsing
                $smokeOk = ($hResp.StatusCode -eq 200)
            } catch { $smokeOk = $false }
        }

        if (-not ($reloadOk -and $smokeOk)) {
            $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            Move-Item -LiteralPath $targetFile -Destination "$targetFile.quarantine.$ts" -Force
            if (Test-Path -LiteralPath $bakFile) { Move-Item -LiteralPath $bakFile -Destination $targetFile -Force }
            $rbJob = Start-Job -ScriptBlock { nginx -s reload }
            $rbDone = Wait-Job $rbJob -Timeout 10
            Remove-Job $rbJob -Force -ErrorAction SilentlyContinue
            if ($null -eq $rbDone) {
                $alertFile = Join-Path $DeployDir "PROXY_CONFIG_ERROR.alert"
                [System.IO.File]::WriteAllText($alertFile, "CRITICAL: Nginx reload & rollback gagal pada $ts`n")
                exit 3
            }
            exit 2
        }

        Remove-Item -LiteralPath $bakFile -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Nginx Cloudflare IPs diperbarui secara atomik ($($v4List.Count) IPv4, $($v6List.Count) IPv6)."
        exit 0
    }

    if ($ProxyType -eq "caddy") {
        $targetFile = Join-Path $DeployDir "cloudflare-ips.caddy"
        $tmpFile = "$targetFile.tmp"
        $bakFile = "$targetFile.bak"
        [System.IO.File]::WriteAllText($tmpFile, $caddyContent, [System.Text.UTF8Encoding]::new($false))

        $mainCaddy = Join-Path $DeployDir "Caddyfile"
        $harnessCaddy = Join-Path $DeployDir ".Caddyfile.harness.tmp"
        $rawCaddy = [System.IO.File]::ReadAllText($mainCaddy)
        [System.IO.File]::WriteAllText($harnessCaddy, $rawCaddy.Replace("import cloudflare-ips.caddy", "import cloudflare-ips.caddy.tmp"), [System.Text.UTF8Encoding]::new($false))
        try {
            & caddy validate --config $harnessCaddy | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Validasi caddy validate gagal pada kandidat snippet baru." }
        } finally {
            Remove-Item -LiteralPath $harnessCaddy -Force -ErrorAction SilentlyContinue
        }

        if (Test-Path -LiteralPath $targetFile) { Copy-Item -LiteralPath $targetFile -Destination $bakFile -Force }
        Move-Item -LiteralPath $tmpFile -Destination $targetFile -Force

        $reloadJob = Start-Job -ScriptBlock { param($cfg) caddy reload --config $cfg } -ArgumentList $mainCaddy
        $completed = Wait-Job $reloadJob -Timeout 10
        $reloadOk = ($null -ne $completed) -and ($reloadJob.State -eq "Completed")
        Remove-Job $reloadJob -Force -ErrorAction SilentlyContinue

        $smokeOk = $false
        if ($reloadOk) {
            try {
                $hResp = Invoke-WebRequest -Uri $HealthUrl -Method Get -TimeoutSec 5 -UseBasicParsing
                $smokeOk = ($hResp.StatusCode -eq 200)
            } catch { $smokeOk = $false }
        }

        if (-not ($reloadOk -and $smokeOk)) {
            $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            Move-Item -LiteralPath $targetFile -Destination "$targetFile.quarantine.$ts" -Force
            if (Test-Path -LiteralPath $bakFile) { Move-Item -LiteralPath $bakFile -Destination $targetFile -Force }
            $rbJob = Start-Job -ScriptBlock { param($cfg) caddy reload --config $cfg } -ArgumentList $mainCaddy
            $rbDone = Wait-Job $rbJob -Timeout 10
            Remove-Job $rbJob -Force -ErrorAction SilentlyContinue
            if ($null -eq $rbDone) {
                $alertFile = Join-Path $DeployDir "PROXY_CONFIG_ERROR.alert"
                [System.IO.File]::WriteAllText($alertFile, "CRITICAL: Caddy reload & rollback gagal pada $ts`n")
                exit 3
            }
            exit 2
        }

        Remove-Item -LiteralPath $bakFile -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Caddy Cloudflare IPs diperbarui secara atomik ($($v4List.Count) IPv4, $($v6List.Count) IPv6)."
        exit 0
    }
} catch {
    Write-Error "[ABORT] $($_.Exception.Message)"
    exit 1
}
