<#
.SYNOPSIS
    Generator kunci CSPRNG 256-bit produksi Catavor (PowerShell — Gate #1).
.DESCRIPTION
    Membangkitkan JWT_SECRET, MFA_ENCRYPTION_KEY (terpisah secara kriptografis),
    REDIS_PASSWORD, dan DB_PASSWORD dari deploy/env.production.example tanpa
    mencetak nilai rahasia ke konsol/log.
#>
param(
    [string]$TemplateFile = (Join-Path $PSScriptRoot "env.production.example"),
    [string]$OutFile = (Join-Path $PSScriptRoot ".env.production"),
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $TemplateFile)) {
    throw "[ABORT] Berkas template tidak ditemukan: $TemplateFile"
}

if ((Test-Path -LiteralPath $OutFile) -and (-not $Force) -and (-not $DryRun)) {
    throw "[ABORT] Berkas $OutFile sudah ada. Gunakan -Force hanya untuk instalasi baru agar MFA_ENCRYPTION_KEY tidak tertimpa."
}

function New-CryptoHex32 {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

$jwtKey = New-CryptoHex32
$mfaKey = New-CryptoHex32
$redisPass = New-CryptoHex32
$dbPass = New-CryptoHex32

if (($jwtKey -eq $mfaKey) -or ($jwtKey.Length -lt 64) -or ($mfaKey.Length -lt 64)) {
    throw "[ABORT] Validasi entropi atau pemisahan kunci CSPRNG gagal."
}

$content = [System.IO.File]::ReadAllText($TemplateFile, [System.Text.Encoding]::UTF8)
$map = [ordered]@{
    "<GENERATE_WITH_DEPLOY_SCRIPT>"                = $jwtKey
    "<GENERATE_DISTINCT_WITH_DEPLOY_SCRIPT>"       = $mfaKey
    "<GENERATE_REDIS_PASSWORD_WITH_DEPLOY_SCRIPT>" = $redisPass
    "<GENERATE_DB_PASSWORD_WITH_DEPLOY_SCRIPT>"    = $dbPass
}

foreach ($k in $map.Keys) {
    if (-not $content.Contains($k)) {
        throw "[ABORT] Placeholder $k tidak ditemukan di $TemplateFile"
    }
    $content = $content.Replace($k, $map[$k])
}

if ($DryRun) {
    Write-Output "[OK] DryRun berhasil: JWT_SECRET (64 hex) != MFA_ENCRYPTION_KEY (64 hex), REDIS_PASSWORD & DB_PASSWORD siap. Tidak menulis ke disk."
    exit 0
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutFile, $content, $utf8NoBom)
Write-Output "[BERHASIL] Berkas rahasia produksi dibuat di: $OutFile"
