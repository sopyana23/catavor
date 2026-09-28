package services

import (
	"fmt"
	"html"
	"os"
	"strings"
	"time"
)

// getBaseURL returns the configured application base URL (e.g., http://localhost:8000)
func getBaseURL() string {
	url := strings.TrimRight(os.Getenv("APP_URL"), "/")
	if url == "" {
		url = "http://localhost:8000"
	}
	return url
}

// wrapEmailLayout encapsulates email content within a modern, mobile-friendly responsive HTML container
func wrapEmailLayout(badgeText, badgeBgColor, title, subtitle, mainContent, ctaButtonLabel, ctaButtonURL string) string {
	baseURL := getBaseURL()
	currentYear := time.Now().Year()

	ctaHTML := ""
	if ctaButtonLabel != "" && ctaButtonURL != "" {
		if !strings.HasPrefix(ctaButtonURL, "http://") && !strings.HasPrefix(ctaButtonURL, "https://") {
			ctaButtonURL = baseURL + "/" + strings.TrimLeft(ctaButtonURL, "/")
		}
		ctaHTML = fmt.Sprintf(`
		<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="margin: 22px 0 6px 0;">
			<tr>
				<td align="center">
					<!--[if mso]>
					<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="%s" style="height:44px;v-text-anchor:middle;width:280px;" arcsize="18%%" stroke="f" fillcolor="#2563eb">
					<w:anchorlock/>
					<center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">%s</center>
					</v:roundrect>
					<![endif]-->
					<!--[if !mso]><!-- -->
					<a href="%s" target="_blank" class="cta-btn" style="display: block; width: 100%%; max-width: 380px; box-sizing: border-box; text-align: center; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 13px 20px; border-radius: 8px; font-weight: 700; font-size: 13.5px; letter-spacing: 0.01em; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);">
						%s
					</a>
					<!--<![endif]-->
				</td>
			</tr>
		</table>`, html.EscapeString(ctaButtonURL), html.EscapeString(ctaButtonLabel), html.EscapeString(ctaButtonURL), html.EscapeString(ctaButtonLabel))
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>%s</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%%;
      -ms-text-size-adjust: 100%%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    @media only screen and (max-width: 600px) {
      .outer-wrap {
        padding: 6px 0 !important;
      }
      .card-wrap {
        width: 100%% !important;
        max-width: 100%% !important;
        border-radius: 8px !important;
      }
      .header-pad {
        padding: 20px 16px !important;
      }
      .body-pad {
        padding: 20px 16px !important;
      }
      .footer-pad {
        padding: 16px 16px !important;
      }
      .title-text {
        font-size: 17.5px !important;
        line-height: 1.35 !important;
      }
      .inner-card-pad {
        padding: 12px 12px !important;
      }
      .cta-btn {
        width: 100%% !important;
        max-width: 100%% !important;
        padding: 14px 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <!-- Outer Table Container -->
  <table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" class="outer-wrap" style="background-color: #f1f5f9; padding: 12px 4px; margin: 0; width: 100%%;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Main Card Container -->
        <table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" class="card-wrap" style="max-width: 580px; width: 100%%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.06);">
          
          <!-- Header Branding -->
          <tr>
            <td class="header-pad" style="background-color: #0f172a; padding: 22px 20px; border-bottom: 2px solid #1e293b;">
              <table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 17px; font-weight: 900; letter-spacing: 0.06em; color: #38bdf8;">CATAVOR</span>
                        </td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                          <span style="font-size: 11px; color: #94a3b8; font-weight: 500; border-left: 1px solid #334155; padding-left: 8px; line-height: 1; white-space: nowrap;">Platform Katalog Digital</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style="margin-bottom: 10px;">
                      <span style="display: inline-block; background-color: %s; color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 9px; border-radius: 4px;">
                        %s
                      </span>
                    </div>
                    <h1 class="title-text" style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #ffffff; line-height: 1.35; letter-spacing: -0.01em;">%s</h1>
                    <p style="margin: 0; font-size: 12.5px; color: #94a3b8; line-height: 1.45;">%s</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="body-pad" style="padding: 22px 20px 20px 20px; font-size: 13.5px; line-height: 1.65; color: #334155;">
              %s
              %s
            </td>
          </tr>

          <!-- Footer Security & Disclaimers -->
          <tr>
            <td class="footer-pad" style="background-color: #f8fafc; padding: 18px 20px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; line-height: 1.55;">
              <table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #475569;">Pemberitahuan Otomatis Sistem Catavor</p>
                    <p style="margin: 0 0 8px 0;">Email ini dikirimkan secara resmi terkait status akun atau tiket dukungan Anda. Harap tidak membalas email ini secara langsung.</p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; %d Catavor Multi-Channel Digital Engine. Hak cipta dilindungi.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, html.EscapeString(title), badgeBgColor, html.EscapeString(badgeText), html.EscapeString(title), html.EscapeString(subtitle), mainContent, ctaHTML, currentYear)
}

// BuildBannedEmail creates a high-end corporate compliance notice when a single store catalog is permanently banned.
func BuildBannedEmail(storeTitle, reasonLabel, adminNotes, reportNumber, userEmail string) (subject string, bodyHTML string) {
	subject = fmt.Sprintf("[Catavor Kepatuhan] Keputusan Penonaktifan Permanen Profil Katalog '%s' - #%s", storeTitle, reportNumber)
	title := "Penonaktifan Permanen Profil Katalog"
	subtitle := fmt.Sprintf("Surat Keputusan Resmi Tim Kepatuhan & Keamanan #%s", reportNumber)

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo Rekan Pengelola <strong>%s</strong>,</p>
	<p style="margin: 0 0 16px 0;">Berdasarkan peninjauan menyeluruh dan audit kepatuhan atas laporan nomor <strong>#%s</strong>, Tim Kepatuhan Catavor memutuskan untuk <strong>menonaktifkan secara permanen</strong> profil katalog toko di bawah ini:</p>

	<!-- Case Breakdown Card -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px;">
				<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12.5px; line-height: 1.6;">
					<tr>
						<td width="33%%" style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Nomor Berkas</td>
						<td width="67%%" style="padding: 6px 0 6px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">#%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Nama Katalog</td>
						<td style="padding: 6px 0 6px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Pelanggaran</td>
						<td style="padding: 6px 0 6px 10px; color: #b91c1c; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Catatan Resmi</td>
						<td style="padding: 6px 0 6px 10px; color: #334155; font-size: 12px; font-style: italic; vertical-align: top; border-bottom: 1px solid #e2e8f0;">"%s"</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top;">Status</td>
						<td style="padding: 6px 0 6px 10px; color: #be123c; font-size: 12.5px; font-weight: 800; vertical-align: top;">DITUTUP PERMANEN (BANNED)</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>

	<!-- Multi-Store Account Protection Notice (CRITICAL BEST PRACTICE) -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.55; color: #1e40af;">
				<strong style="display: block; margin-bottom: 4px; color: #1d4ed8; font-size: 13px;">Pemberitahuan Status Akun & Profil Lain Anda:</strong>
				Sanksi penonaktifan ini <strong>berlaku khusus untuk profil katalog "%s"</strong>. Akun kepemilikan Anda (<em>%s</em>) serta <strong>seluruh profil toko/katalog Anda yang lain tetap aman, aktif, dan dapat dikelola normal</strong> tanpa hambatan di platform Catavor.
			</td>
		</tr>
	</table>

	<p style="margin: 0 0 10px 0; font-size: 12.5px; color: #475569;">Nama slug katalog ini telah dinonaktifkan dari akses publik demi menjaga integritas ekosistem komunitas. Jika Anda memiliki pertanyaan atau memerlukan klarifikasi, Anda dapat mengakses menu Pusat Bantuan di Portal Pengelola.</p>
	`, html.EscapeString(storeTitle), html.EscapeString(reportNumber), html.EscapeString(reportNumber), html.EscapeString(storeTitle), html.EscapeString(reasonLabel), html.EscapeString(adminNotes), html.EscapeString(storeTitle), html.EscapeString(userEmail))

	bodyHTML = wrapEmailLayout("KEPUTUSAN KEPATUHAN", "#be123c", title, subtitle, mainContent, "Buka Portal Katalog Catavor", "/catalogs")
	return
}

// BuildSuspendedEmail creates an urgent notification when a store catalog is temporarily suspended.
func BuildSuspendedEmail(storeTitle, reasonLabel, adminNotes, reportNumber, storeSlug string) (subject string, bodyHTML string) {
	subject = fmt.Sprintf("[Catavor Kepatuhan] Pemberitahuan Penangguhan Operasional Katalog '%s' - #%s", storeTitle, reportNumber)
	title := "Penangguhan Operasional Profil Katalog"
	subtitle := fmt.Sprintf("Tindakan Penonaktifan Sementara Laporan Kepatuhan #%s", reportNumber)

	appealURL := fmt.Sprintf("/%s/admin/help", storeSlug)

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo Pengelola Toko <strong>%s</strong>,</p>
	<p style="margin: 0 0 16px 0;">Kami menginformasikan bahwa profil katalog toko Anda saat ini sedang <strong>dinonaktifkan sementara (Suspended)</strong> oleh Tim Kepatuhan Catavor guna menindaklanjuti laporan nomor <strong>#%s</strong>.</p>

	<!-- Details Card -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px;">
				<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12.5px; line-height: 1.6;">
					<tr>
						<td width="33%%" style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #fef3c7;">Nomor Berkas</td>
						<td width="67%%" style="padding: 6px 0 6px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #fef3c7;">#%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #fef3c7;">Nama Katalog</td>
						<td style="padding: 6px 0 6px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #fef3c7;">%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #fef3c7;">Alasan</td>
						<td style="padding: 6px 0 6px 10px; color: #b45309; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #fef3c7;">%s</td>
					</tr>
					<tr>
						<td style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; vertical-align: top;">Catatan</td>
						<td style="padding: 6px 0 6px 10px; color: #451a03; font-size: 12px; font-style: italic; vertical-align: top;">"%s"</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>

	<!-- Impact Points -->
	<p style="margin: 0 0 8px 0; font-weight: 700; color: #0f172a; font-size: 13px;">Batasan yang berlaku selama penangguhan sementara:</p>
	<ul style="margin: 0 0 16px 0; padding-left: 18px; font-size: 12.5px; color: #475569; line-height: 1.65;">
		<li style="margin-bottom: 6px;">Etalase publik Anda dinonaktifkan sementara dari akses publik & mesin pencari.</li>
		<li style="margin-bottom: 6px;">Seluruh data produk dan informasi katalog Anda <strong>tetap tersimpan aman</strong> di sistem.</li>
		<li style="margin-bottom: 6px;">Anda memiliki <strong>hak penuh untuk mengajukan banding kepatuhan</strong> resmi dengan melampirkan klarifikasi atau bukti perbaikan.</li>
	</ul>
	`, html.EscapeString(storeTitle), html.EscapeString(reportNumber), html.EscapeString(reportNumber), html.EscapeString(storeTitle), html.EscapeString(reasonLabel), html.EscapeString(adminNotes))

	bodyHTML = wrapEmailLayout("PENANGGUHAN OPERASIONAL", "#c2410c", title, subtitle, mainContent, "Ajukan Banding Kepatuhan Resmi →", appealURL)
	return
}

// BuildRestoredEmail creates a confirmation email when a catalog has been restored to active status.
func BuildRestoredEmail(storeTitle, reportNumber, storeSlug string) (subject string, bodyHTML string) {
	subject = fmt.Sprintf("[Catavor Kepatuhan] Pemulihan Operasional Profil Katalog '%s' Berhasil - #%s", storeTitle, reportNumber)
	title := "Pemulihan Operasional Profil Katalog Berhasil"
	subtitle := "Penangguhan Resmi Dicabut - Etalase Publik Telah Aktif Kembali"

	catalogURL := fmt.Sprintf("/%s/admin", storeSlug)

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo Pengelola Toko <strong>%s</strong>,</p>
	<p style="margin: 0 0 16px 0;">Kabar baik! Berdasarkan verifikasi peninjauan dan klarifikasi kepatuhan terkait berkas <strong>#%s</strong>, penangguhan atas profil katalog toko Anda telah <strong>resmi dicabut</strong>.</p>

	<!-- Success Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 14px 16px; font-size: 12.5px; color: #065f46; line-height: 1.65;">
				<strong style="display: block; font-size: 13.5px; margin-bottom: 8px; color: #047857;">Status Toko Anda: AKTIF & NORMAL</strong>
				• Etalase katalog Anda telah kembali dapat diakses oleh publik.<br>
				• Seluruh fitur manajemen produk dan pengaturan toko dapat digunakan kembali sepenuhnya.<br>
				• Terima kasih atas komitmen Anda dalam menjaga integritas ekosistem komunitas Catavor.
			</td>
		</tr>
	</table>
	`, html.EscapeString(storeTitle), html.EscapeString(reportNumber))

	bodyHTML = wrapEmailLayout("PEMULIHAN SELESAI", "#059669", title, subtitle, mainContent, "Buka Dashboard Katalog Saya →", catalogURL)
	return
}

// BuildWarningEmail creates an official warning notification for content policy infractions.
func BuildWarningEmail(storeTitle, targetEntityName, reasonLabel, adminNotes, reportNumber, storeSlug string) (subject string, bodyHTML string) {
	subject = fmt.Sprintf("[Catavor Kepatuhan] Peringatan Resmi Pelanggaran Konten - #%s", reportNumber)
	title := "Peringatan Resmi Kepatuhan Konten"
	subtitle := fmt.Sprintf("Surat Peringatan Penyesuaian Konten Berkas #%s", reportNumber)

	reviewURL := fmt.Sprintf("/%s/admin/items", storeSlug)

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo Pengelola Toko <strong>%s</strong>,</p>
	<p style="margin: 0 0 16px 0;">Tim Kepatuhan Catavor telah meninjau laporan masyarakat dan menemukan indikasi ketidaksesuaian konten pada entitas: <strong>%s</strong>.</p>

	<!-- Warning Details -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; border: 1px solid #fef08a; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.65;">
				<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
					<tr>
						<td width="33%%" style="padding: 5px 0; color: #854d0e; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #fef9c3;">Entitas</td>
						<td width="67%%" style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #fef9c3;">%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #854d0e; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #fef9c3;">Kategori Isu</td>
						<td style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #fef9c3;">%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #854d0e; font-size: 12px; font-weight: 600; vertical-align: top;">Catatan</td>
						<td style="padding: 5px 0 5px 10px; color: #713f12; font-size: 12px; font-style: italic; vertical-align: top;">"%s"</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>

	<p style="margin: 0 0 12px 0; font-size: 12.5px; color: #475569;">Mohon lakukan peninjauan dan penyesuaian materi deskripsi, gambar, atau harga item terkait agar selaras dengan Pedoman Komunitas Platform Catavor guna menghindari sanksi penangguhan operasional.</p>
	`, html.EscapeString(storeTitle), html.EscapeString(targetEntityName), html.EscapeString(targetEntityName), html.EscapeString(reasonLabel), html.EscapeString(adminNotes))

	bodyHTML = wrapEmailLayout("PERINGATAN RESMI", "#a16207", title, subtitle, mainContent, "Tinjau & Sesuaikan Item Katalog →", reviewURL)
	return
}

// BuildSupportReplyEmail creates an instant notification when Customer Support responds to a user ticket.
func BuildSupportReplyEmail(recipientName, storeTitle, ticketNumber, ticketSubject, agentName, agentMessage, storeSlug string) (subject string, bodyHTML string) {
	subject = fmt.Sprintf("[Catavor Bantuan] Tanggapan Baru pada Tiket #%s: %s", ticketNumber, ticketSubject)
	title := "Tanggapan Baru dari Tim Bantuan Platform"
	subtitle := fmt.Sprintf("Pembaruan Resmi Layanan Pelanggan untuk Tiket #%s", ticketNumber)

	ticketURL := fmt.Sprintf("/%s/admin/help?ticket=%s", storeSlug, ticketNumber)
	if storeSlug == "" {
		ticketURL = fmt.Sprintf("/admin/help?ticket=%s", ticketNumber)
	}

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo <strong>%s</strong>,</p>
	<p style="margin: 0 0 16px 0;">Staf Tim Dukungan Pelanggan (Customer Support) Catavor telah memberikan tanggapan terbaru pada tiket bantuan kendala Anda:</p>

	<!-- Ticket Meta Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.6;">
				<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
					<tr>
						<td width="30%%" style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Nomor Tiket</td>
						<td width="70%%" style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">#%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Subjek Kendala</td>
						<td style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top;">Petugas CS</td>
						<td style="padding: 5px 0 5px 10px; color: #2563eb; font-size: 12.5px; font-weight: 700; vertical-align: top;">%s</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>

	<!-- Agent Message Quote Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #4f46e5; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 14px 16px; font-size: 13px; line-height: 1.65; color: #1e293b;">
				<strong style="display: block; font-size: 11.5px; color: #4338ca; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Pesan Balasan CS:</strong>
				%s
			</td>
		</tr>
	</table>

	<p style="margin: 0 0 10px 0; font-size: 12.5px; color: #475569;">Jika Anda membutuhkan penjelasan tambahan atau ingin melampirkan berkas bukti, silakan klik tombol di bawah ini untuk membuka dan membalas langsung di ruang tiket.</p>
	`, html.EscapeString(recipientName), html.EscapeString(ticketNumber), html.EscapeString(ticketSubject), html.EscapeString(agentName), nl2br(html.EscapeString(agentMessage)))

	bodyHTML = wrapEmailLayout("LAYANAN PELANGGAN", "#4f46e5", title, subtitle, mainContent, "Buka & Balas Tiket Bantuan →", ticketURL)
	return
}

// BuildReporterReceivedEmail generates a professional confirmation email sent to the reporter acknowledging report submission
func BuildReporterReceivedEmail(reportNumber, targetType, targetName, storeTitle, reasonLabel, reportedAt string) (subject string, bodyHTML string) {
	subject = fmt.Sprintf("[Catavor Integritas] Tanda Terima Laporan #%s: %s", reportNumber, targetName)
	title := "Laporan Anda Telah Kami Terima"
	subtitle := fmt.Sprintf("Tiket Peninjauan Tim Integritas Komunitas #%s", reportNumber)

	targetTypeLabel := "Item / Produk"
	if targetType == "catalog" {
		targetTypeLabel = "Katalog Toko"
	}

	entityContext := html.EscapeString(targetName)
	if targetType == "item" && storeTitle != "" && storeTitle != targetName {
		entityContext = fmt.Sprintf("%s (pada katalog <em>%s</em>)", html.EscapeString(targetName), html.EscapeString(storeTitle))
	}

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo Pengguna Komunitas Catavor,</p>
	<p style="margin: 0 0 16px 0;">Terima kasih telah meluangkan waktu untuk menyampaikan laporan. Laporan Anda telah berhasil dicatat dalam sistem integritas dan kepatuhan Catavor dengan rincian berikut:</p>

	<!-- Report Summary Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.6;">
				<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
					<tr>
						<td width="34%%" style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Nomor Tiket</td>
						<td width="66%%" style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">#%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Objek Terlapor</td>
						<td style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s <span style="font-size: 11px; color: #64748b; font-weight: normal;">(%s)</span></td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Dugaan Pelanggaran</td>
						<td style="padding: 5px 0 5px 10px; color: #dc2626; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Waktu Laporan</td>
						<td style="padding: 5px 0 5px 10px; color: #334155; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top;">Status Tiket</td>
						<td style="padding: 5px 0 5px 10px; color: #0284c7; font-size: 12.5px; font-weight: 700; vertical-align: top;">Sedang Dalam Antrean Peninjauan</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>

	<!-- Privacy Guarantee Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #16a34a; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.6; color: #166534;">
				<strong style="display: block; font-size: 12px; margin-bottom: 4px; color: #15803d;">🛡️ Jaminan Perlindungan Privasi Pelapor:</strong>
				Identitas dan alamat email Anda sepenuhnya dirahasiakan oleh sistem. Kami tidak akan pernah membagikan data pribadi Anda kepada pihak yang dilaporkan.
			</td>
		</tr>
	</table>

	<p style="margin: 0 0 10px 0; font-size: 12.5px; color: #475569; line-height: 1.6;">
		Tim Trust & Safety Catavor akan segera meneliti laporan ini secara objektif dalam waktu <strong>1x24 jam kerja</strong>. Anda akan menerima email pembaruan resmi ketika status pemeriksaan telah ditetapkan.
	</p>
	`, html.EscapeString(reportNumber), entityContext, targetTypeLabel, html.EscapeString(reasonLabel), html.EscapeString(reportedAt))

	bodyHTML = wrapEmailLayout("TANDA TERIMA LAPORAN", "#0284c7", title, subtitle, mainContent, "", "")
	return
}

// BuildReporterOutcomeEmail generates an update email sent to the reporter once moderation action is finalized
func BuildReporterOutcomeEmail(reportNumber, targetType, targetName, storeTitle, reasonLabel, actionTaken string) (subject string, bodyHTML string) {
	isEnforced := actionTaken == "item_hidden" || actionTaken == "catalog_suspended" || actionTaken == "catalog_banned" || actionTaken == "warning_issued" || actionTaken == "action_taken" || actionTaken == "banned"

	targetTypeLabel := "item"
	if targetType == "catalog" {
		targetTypeLabel = "katalog"
	}

	entityName := html.EscapeString(targetName)
	if targetType == "item" && storeTitle != "" && storeTitle != targetName {
		entityName = fmt.Sprintf("%s (pada katalog <em>%s</em>)", html.EscapeString(targetName), html.EscapeString(storeTitle))
	}

	if isEnforced {
		subject = fmt.Sprintf("[Catavor Integritas] Pembaruan Laporan #%s: Tindakan Telah Diambil", reportNumber)
		title := "Tindakan Penegakan Telah Diberlakukan"
		subtitle := fmt.Sprintf("Pemberitahuan Resmi atas Laporan Komunitas #%s", reportNumber)

		actionDesc := "tindakan moderasi dan penonaktifan konten telah diberlakukan"
		if actionTaken == "item_hidden" {
			actionDesc = "item terkait telah dinonaktifkan dan diturunkan dari katalog publik"
		} else if actionTaken == "catalog_suspended" {
			actionDesc = "katalog toko terkait telah dibekukan sementara hingga proses kepatuhan diselesaikan"
		} else if actionTaken == "catalog_banned" {
			actionDesc = "akses katalog dan akun terkait telah dihentikan secara permanen dari ekosistem Catavor"
		} else if actionTaken == "warning_issued" {
			actionDesc = "surat peringatan kepatuhan resmi telah diterbitkan kepada pemilik katalog"
		}

		mainContent := fmt.Sprintf(`
		<p style="margin: 0 0 14px 0;">Halo Pengguna Komunitas Catavor,</p>
		<p style="margin: 0 0 16px 0;">Kami ingin menyampaikan kabar terbaru mengenai laporan Anda terhadap %s <strong>%s</strong> dengan nomor tiket <strong>#%s</strong>.</p>

		<!-- Outcome Result Box -->
		<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #16a34a; margin-bottom: 18px;">
			<tr>
				<td class="inner-card-pad" style="padding: 14px 16px; font-size: 13px; line-height: 1.65; color: #14532d;">
					<strong style="display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #166534; margin-bottom: 6px;">Hasil Peninjauan Tim Kepatuhan:</strong>
					Setelah melalui pemeriksaan bukti dan investigasi menyeluruh, laporan Anda <strong>terbukti melanggar Pedoman Komunitas Catavor</strong>. Saat ini, <strong>%s</strong>.
				</td>
			</tr>
		</table>

		<!-- Summary Meta Box -->
		<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
			<tr>
				<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.6;">
					<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
						<tr>
							<td width="34%%" style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Nomor Tiket</td>
							<td width="66%%" style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">#%s</td>
						</tr>
						<tr>
							<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Kategori Laporan</td>
							<td style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
						</tr>
						<tr>
							<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top;">Status Akhir</td>
							<td style="padding: 5px 0 5px 10px; color: #16a34a; font-size: 12.5px; font-weight: 700; vertical-align: top;">Selesai - Sanksi Telah Diberlakukan</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>

		<p style="margin: 0 0 10px 0; font-size: 12.5px; color: #334155; line-height: 1.6;">
			Kami mengucapkan terima kasih yang sebesar-besarnya atas kepedulian Anda. Partisipasi Anda sangat berharga dalam menjaga ekosistem transaksi dan informasi digital di Catavor tetap aman, jujur, dan tepercaya bagi seluruh masyarakat.
		</p>
		`, targetTypeLabel, entityName, html.EscapeString(reportNumber), actionDesc, html.EscapeString(reportNumber), html.EscapeString(reasonLabel))

		bodyHTML = wrapEmailLayout("TINDAKAN DIAMBIL", "#059669", title, subtitle, mainContent, "", "")
		return
	}

	// Skenario B: Dismissed / No Direct Violation Proven
	subject = fmt.Sprintf("[Catavor Integritas] Pembaruan Laporan #%s: Hasil Peninjauan Selesai", reportNumber)
	title := "Hasil Peninjauan Laporan Komunitas"
	subtitle := fmt.Sprintf("Pemberitahuan Resmi atas Laporan Komunitas #%s", reportNumber)

	mainContent := fmt.Sprintf(`
	<p style="margin: 0 0 14px 0;">Halo Pengguna Komunitas Catavor,</p>
	<p style="margin: 0 0 16px 0;">Kami telah menyelesaikan peninjauan menyeluruh terhadap laporan Anda terkait %s <strong>%s</strong> (Tiket <strong>#%s</strong>).</p>

	<!-- Outcome Result Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #64748b; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 14px 16px; font-size: 13px; line-height: 1.65; color: #1e293b;">
				<strong style="display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-bottom: 6px;">Catatan Peninjauan:</strong>
				Berdasarkan bukti yang tersedia dan Pedoman Komunitas saat ini, tim kami <strong>belum menemukan pelanggaran yang memerlukan tindakan moderasi langsung</strong> terhadap konten tersebut.
			</td>
		</tr>
	</table>

	<!-- Summary Meta Box -->
	<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
		<tr>
			<td class="inner-card-pad" style="padding: 12px 14px; font-size: 12.5px; line-height: 1.6;">
				<table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0">
					<tr>
						<td width="34%%" style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Nomor Tiket</td>
						<td width="66%%" style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">#%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top; border-bottom: 1px solid #e2e8f0;">Kategori Laporan</td>
						<td style="padding: 5px 0 5px 10px; color: #0f172a; font-size: 12.5px; font-weight: 700; vertical-align: top; border-bottom: 1px solid #e2e8f0;">%s</td>
					</tr>
					<tr>
						<td style="padding: 5px 0; color: #64748b; font-size: 12px; font-weight: 600; vertical-align: top;">Status Tiket</td>
						<td style="padding: 5px 0 5px 10px; color: #64748b; font-size: 12.5px; font-weight: 700; vertical-align: top;">Ditutup - Tersimpan untuk Pemantauan</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>

	<p style="margin: 0 0 10px 0; font-size: 12.5px; color: #334155; line-height: 1.6;">
		Meskipun tidak ada penindakan langsung yang diambil saat ini, laporan Anda tetap dicatat dalam basis data sistem kepatuhan kami sebagai bahan pemantauan rutin. Terima kasih atas partisipasi aktif Anda dalam menjaga kualitas dan keamanan komunitas Catavor.
	</p>
	`, targetTypeLabel, entityName, html.EscapeString(reportNumber), html.EscapeString(reportNumber), html.EscapeString(reasonLabel))

	bodyHTML = wrapEmailLayout("HASIL PENINJAUAN", "#475569", title, subtitle, mainContent, "", "")
	return
}

func nl2br(text string) string {
	return strings.ReplaceAll(text, "\n", "<br>")
}

