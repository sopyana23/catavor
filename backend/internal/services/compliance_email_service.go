package services

import (
	"fmt"
	"strings"
	"time"
)

// SendSingleCatalogBannedEmail dispatches an official compliance notification email to the merchant
// when a single catalog profile is permanently banned, confirming that their account identity
// and any other catalog profiles remain completely unaffected and active.
func SendSingleCatalogBannedEmail(toEmail, catalogTitle, catalogSlug, reportNumber, reasonLabel, adminNotes string) {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return
	}

	if catalogTitle == "" {
		catalogTitle = catalogSlug
	}
	if reportNumber == "" {
		reportNumber = fmt.Sprintf("MOD-%d", time.Now().Unix())
	}
	if reasonLabel == "" {
		reasonLabel = "Pelanggaran Ketentuan Layanan & Pedoman Komunitas Platform"
	}
	if adminNotes == "" {
		adminNotes = "Penonaktifan permanen atas pertimbangan keamanan dan kepatuhan platform."
	}

	subject := fmt.Sprintf("[Catavor Kepatuhan] Keputusan Final: Penonaktifan Permanen Profil Katalog '%s' - #%s", catalogTitle, reportNumber)
	headline := "Pemberitahuan Penonaktifan Permanen Profil Katalog"

	bodyContent := fmt.Sprintf(`
Halo Pengelola <strong>%s</strong>,<br><br>
Berdasarkan hasil investigasi mendalam Tim Kepatuhan & Keamanan Platform Catavor (Trust & Safety), kami memberitahukan bahwa profil katalog berikut telah <strong>ditutup dan dinonaktifkan secara permanen</strong>:<br><br>

<div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 12px 0;">
  <strong style="color: #9f1239; font-size: 1.05rem; display: block; margin-bottom: 8px;">Rincian Keputusan Moderasi:</strong>
  • <strong>Nama Profil Katalog:</strong> %s<br>
  • <strong>Tautan Username (Slug):</strong> catavor.com/%s<br>
  • <strong>Nomor Tiket Berkas:</strong> #%s<br>
  • <strong>Kategori Pelanggaran:</strong> %s<br>
  • <strong>Catatan Kepatuhan:</strong> <em>"%s"</em>
</div>

<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <strong style="color: #065f46; font-size: 1rem; display: block; margin-bottom: 6px;">Pemberitahuan Status Akun & Profil Katalog Lain:</strong>
  Sanksi penonaktifan ini <strong>hanya berlaku khusus untuk profil katalog di atas</strong>. Identitas akun pengguna Anda beserta <strong>seluruh profil katalog Anda yang lain tetap aman, berstatus aktif, dan tidak terdampak</strong>.<br><br>
  Anda dapat terus mengelola profil-profil katalog Anda yang lain secara normal melalui <a href="https://catavor.com" style="color: #059669; font-weight: 700; text-decoration: underline;">Portal Katalog Catavor</a>.
</div>

Seluruh data media dan informasi yang terkait dengan profil katalog yang ditutup telah dibersihkan secara aman dari server publik dan nama tautan (slug) telah dimasukkan ke dalam daftar terlarang sistem demi perlindungan ekosistem platform.<br><br>
Hormat kami,<br>
<strong>Tim Kepatuhan & Keamanan Platform Catavor (Trust & Safety)</strong>
`, catalogTitle, catalogTitle, catalogSlug, reportNumber, reasonLabel, adminNotes)

	sendHTMLEmail(toEmail, subject, headline, bodyContent)
}

// SendIdentityBannedEmail dispatches an official compliance notification email to the user
// when their entire account identity and all related catalog profiles are permanently terminated.
func SendIdentityBannedEmail(toEmail, userName, reportNumber, reasonLabel, adminNotes string) {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return
	}

	if userName == "" {
		userName = "Pengguna Platform"
	}
	if reportNumber == "" {
		reportNumber = fmt.Sprintf("IDENTITY-%d", time.Now().Unix())
	}
	if reasonLabel == "" {
		reasonLabel = "Pelanggaran Fatal / Kejahatan Terencana Terhadap Ketentuan Layanan"
	}
	if adminNotes == "" {
		adminNotes = "Pemutusan akses permanen sehubungan dengan pelanggaran fatal platform."
	}

	subject := fmt.Sprintf("[Catavor Kepatuhan] KEPUTUSAN FINAL: Pemutusan Akses & Penutupan Akun Permanen - #%s", reportNumber)
	headline := "Pemberitahuan Pemutusan Layanan & Pemblokiran Identitas Penuh"

	bodyContent := fmt.Sprintf(`
Yth. <strong>%s</strong>,<br><br>
Berdasarkan hasil audit menyeluruh dan penegakan hukum kepatuhan atas pelanggaran berat terhadap Syarat Layanan dan Kebijakan Keamanan Platform Catavor, dengan ini kami sampaikan keputusan final bahwa:<br><br>

<div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 12px 0;">
  <strong style="color: #9f1239; font-size: 1.05rem; display: block; margin-bottom: 8px;">Dampak Keputusan Pemblokiran Identitas (Identity Ban):</strong>
  1. <strong>Penutupan Seluruh Profil Katalog:</strong> Seluruh profil katalog yang terdaftar di bawah akun email Anda telah ditutup dan dinonaktifkan secara permanen.<br>
  2. <strong>Pencabutan Sesi & Akses Login:</strong> Seluruh hak akses dan sesi login akun Anda telah dicabut secara permanen di seluruh sistem.<br>
  3. <strong>Pendaftaran Daftar Hitam (Blacklist):</strong> Alamat email Anda (%s) telah didaftarkan ke daftar hitam platform secara permanen. Anda <strong>tidak diizinkan</strong> mendaftar akun baru ataupun membuat profil katalog baru di masa mendatang.
</div>

<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
  • <strong>Nomor Berkas:</strong> #%s<br>
  • <strong>Alasan Penindakan:</strong> %s<br>
  • <strong>Catatan Resmi Penegakan:</strong> <em>"%s"</em>
</div>

Keputusan ini bersifat final dan mengikat demi menjaga keamanan seluruh pelaku usaha dan masyarakat dalam ekosistem platform Catavor.<br><br>
Hormat kami,<br>
<strong>Direktorat Kepatuhan & Keamanan Platform Catavor (Trust & Safety)</strong>
`, userName, toEmail, reportNumber, reasonLabel, adminNotes)

	sendHTMLEmail(toEmail, subject, headline, bodyContent)
}

// sendHTMLEmail executes SMTP delivery via persistent queue
func sendHTMLEmail(toEmail, subject, headline, bodyContent string) {
	htmlMessage := wrapEmailLayout("KEPUTUSAN KEPATUHAN", "#be123c", headline, subject, bodyContent, "Buka Portal Katalog Catavor", "/catalogs")
	_, _ = EnqueueEmail(toEmail, "", "Catavor Trust & Safety", subject, htmlMessage, "compliance_banned", "")
}
