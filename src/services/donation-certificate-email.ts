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
  <title>e-Blood Donation Appreciation</title>
</head>
<body style="margin: 0; padding: 0; background: #f4f6f8; font-family: Arial, Helvetica, sans-serif; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #eaecf0; border-radius: 12px; overflow: hidden;">
    
    <!-- Header Section -->
    <tr>
      <td style="padding: 28px 32px; text-align: center; border-bottom: 1px solid #eaecf0;">
        <!-- e-Blood Logo -->
        <img src="cid:${certificateLogoCid}" alt="e-Blood Logo" style="display: block; width: 120px; height: auto; margin: 0 auto 12px;">
        
        <!-- Thin horizontal divider below logo -->
        <hr style="border: 0; border-top: 1px solid #eaecf0; margin: 0 auto 24px; max-width: 40px;">
        
        <!-- Red uppercase section label -->
        <h2 style="margin: 0; color: #E60023; font-size: 14; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
          BLOOD DONATION APPRECIATION
        </h2>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding: 32px 32px 20px;">
        
        <!-- Large bold dark navy heading -->
        <h1 style="margin: 0 0 24px; color: #1A1A2E; font-size: 28; font-weight: 700; line-height: 1.3;">
          Thank You for Saving Lives
        </h1>
        
        <!-- Appreciation message -->
        <p style="margin: 0 0 20px; font-size: 16; color: #333333; line-height: 1.7;">
          Dear ${safeName},
        </p>
        
        <p style="margin: 0 0 20px; font-size: 16; color: #333333; line-height: 1.7;">
          On behalf of e-Blood, we sincerely thank you for your generous blood donation. Your kindness, compassion, and willingness to help those in need reflect the true spirit of humanity. Your contribution makes a meaningful difference and brings hope to patients and families in our community.
        </p>
        
        <!-- Certificate ID box -->
        <p style="margin: 0 0 24px; padding: 12px 16px; background: #fff5f4; border-left: 3px solid #E60023; font-size: 14; color: #b42318;">
          <strong>Certificate ID:</strong> ${safeCertificateId}
        </p>
        
        <!-- Thank you paragraph -->
        <p style="margin: 0 0 24px; font-size: 16; color: #333333; line-height: 1.7;">
          Thank you for being part of our mission to connect donors and save lives. Your generosity inspires us to continue making a difference.
        </p>
        
      </td>
    </tr>
    
    <!-- Signature Section -->
    <tr>
      <td style="padding: 0 32px 32px;">
        <p style="margin: 0 0 8px; font-size: 14; color: #666666; line-height: 1.6;">
          With heartfelt gratitude,
        </p>
        <p style="margin: 0; font-size: 15; color: #1A1A2E; font-weight: 600; line-height: 1.6;">
          Humnath Pokharel and Saurav Bogati
        </p>
        <p style="margin: 4px 0 0; font-size: 14; color: #666666; line-height: 1.6;">
          CEOs, e-Blood
        </p>
        <p style="margin: 12px 0 0; font-size: 13; color: #666666; line-height: 1.6;">
          Connecting Donors. Saving Lives.
        </p>
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
    text: `Dear ${donorName},\n\nOn behalf of e-Blood, we sincerely thank you for your generous blood donation. Your kindness, compassion, and willingness to help those in need reflect the true spirit of humanity. Your contribution makes a meaningful difference and brings hope to patients and families in our community.\n\nAs a token of our heartfelt appreciation, please find your Certificate of Appreciation attached as a PDF. This certificate recognizes your completed blood donation and serves as a lasting acknowledgment of your generosity.\n\nCertificate ID: ${safeCertificateId}\n\nThank you for being part of our mission to connect donors and save lives. Your generosity inspires us to continue making a difference.\n\nWith heartfelt gratitude,\n\nHumnath Pokharel and Saurav Bogati\nCEOs, e-Blood\nConnecting Donors. Saving Lives.`,
    html: buildDonationCertificateEmailHtml(donorName, certificateId),
  };
}