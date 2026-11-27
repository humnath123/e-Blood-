export const certificateLogoCid = "eblood-certificate-logo";
export const certificateEmailSubject = "Your Blood Donation Certificate – e-Blood";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character] || character;
  });
}

// Professional HTML email template for donor appreciation email
function buildDonationCertificateEmailHtml(
  donorName: string,
  certificateId: string
): string {
  const safeName = escapeHtml(donorName);
  const safeCertificateId = escapeHtml(certificateId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>e-Blood Donation Certificate</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;color:#101828;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f4f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #eaecf0;border-radius:12px;overflow:hidden;">
          <tr><td style="height:5px;background:#c8102e;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:24px;">
              <img src="cid:${certificateLogoCid}" width="176" alt="e-Blood - Connecting Donors. Saving Lives." style="display:block;width:176px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;border-top:1px solid #f2f4f7;">
              <p style="margin:0 0 10px;color:#c8102e;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Donation certificate</p>
              <h1 style="margin:0 0 20px;color:#101828;font-size:24px;line-height:32px;">Thank you for saving lives</h1>
              <p style="margin:0 0 16px;color:#344054;font-size:15px;line-height:24px;">Dear ${safeName},</p>
              <p style="margin:0 0 16px;color:#475467;font-size:14px;line-height:23px;">On behalf of e-Blood, we sincerely thank you for your generous blood donation. Your kindness and willingness to help people in need reflect the true spirit of humanity.</p>
              <p style="margin:0 0 20px;color:#475467;font-size:14px;line-height:23px;">Your certificate of appreciation is attached to this email as a PDF. It recognizes your completed donation and records the following certificate ID:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff8f8;border:1px solid #fecdca;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;color:#b42318;font-size:13px;line-height:20px;font-weight:700;">Certificate ID: ${safeCertificateId}</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;background:#ecfdf3;border:1px solid #abefc6;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;color:#027a48;font-size:13px;line-height:20px;font-weight:700;">Certificate issued successfully. Thank you for being a lifesaving donor.</td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#475467;font-size:14px;line-height:22px;">With heartfelt gratitude,<br><strong style="color:#101828;">Humnath Pokharel, Surav Bogati, and Prashant Syangtan</strong><br>CEOs, e-Blood</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #eaecf0;">
              <p style="margin:0;color:#667085;font-size:11px;line-height:17px;">Connecting Donors. Saving Lives.</p>
              <p style="margin:8px 0 0;color:#98a2b3;font-size:10px;line-height:16px;">This is an automated certificate email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildDonationCertificateEmail(donorName: string, certificateId: string) {
  const safeName = escapeHtml(donorName);
  const safeCertificateId = escapeHtml(certificateId);
  
  return {
    subject: certificateEmailSubject,
    text: `Dear ${donorName},\n\nOn behalf of e-Blood, we sincerely thank you for your generous blood donation. Your kindness, compassion, and willingness to help those in need reflect the true spirit of humanity. Your contribution makes a meaningful difference and brings hope to patients and families in our community.\n\nAs a token of our heartfelt appreciation, please find your Certificate of Appreciation attached as a PDF. This certificate recognizes your completed blood donation and serves as a lasting acknowledgment of your generosity.\n\nCertificate ID: ${safeCertificateId}\n\nThank you for being part of our mission to connect donors and save lives. Your generosity inspires us to continue making a difference.\n\nWith heartfelt gratitude,\n\nHumnath Pokharel, Surav Bogati, and Prashant Syangtan\nCEOs, e-Blood\nConnecting Donors. Saving Lives.`,
    html: buildDonationCertificateEmailHtml(donorName, certificateId),
  };
}