require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");
const nodemailer = require("nodemailer");

const LOGO_CID = "eblood-smtp-test-logo";
const logoPath = path.resolve(__dirname, "..", "assets", "eblood-logo.png");

function buildTestEmail() {
  const text = [
    "Dear e-Blood Team,",
    "",
    "This message confirms that the e-Blood backend SMTP configuration is operational.",
    "",
    "The verification utility successfully connected to the configured SMTP service and submitted this message for delivery. Please note that SMTP acceptance confirms submission, but does not guarantee inbox placement; delivery may also be affected by recipient filtering or spam policies.",
    "",
    "This is an automated configuration test. No action is required.",
    "",
    "Sincerely,",
    "e-Blood Backend",
    "Connecting Donors. Saving Lives.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>e-Blood SMTP Configuration Verification</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;color:#101828;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f4f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #eaecf0;border-radius:12px;overflow:hidden;">
          <tr><td style="height:5px;background:#c8102e;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:24px;">
              <img src="cid:${LOGO_CID}" width="176" alt="e-Blood - Connecting Donors. Saving Lives." style="display:block;width:176px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;border-top:1px solid #f2f4f7;">
              <p style="margin:0 0 10px;color:#c8102e;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">System verification</p>
              <h1 style="margin:0 0 20px;color:#101828;font-size:24px;line-height:32px;">SMTP configuration confirmed</h1>
              <p style="margin:0 0 16px;color:#344054;font-size:15px;line-height:24px;">Dear e-Blood Team,</p>
              <p style="margin:0 0 16px;color:#475467;font-size:14px;line-height:23px;">This message confirms that the e-Blood backend SMTP configuration is operational.</p>
              <p style="margin:0 0 20px;color:#475467;font-size:14px;line-height:23px;">The verification utility connected to the configured SMTP service and submitted this message for delivery. SMTP acceptance confirms submission, but does not guarantee inbox placement; recipient filtering or spam policies may affect final delivery.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ecfdf3;border:1px solid #abefc6;border-radius:8px;">
                <tr><td style="padding:14px 16px;color:#027a48;font-size:13px;line-height:20px;font-weight:700;">Configuration test completed. No action is required.</td></tr>
              </table>
              <p style="margin:24px 0 0;color:#475467;font-size:14px;line-height:22px;">Sincerely,<br><strong style="color:#101828;">e-Blood Backend</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #eaecf0;">
              <p style="margin:0;color:#667085;font-size:11px;line-height:17px;">Connecting Donors. Saving Lives.</p>
              <p style="margin:8px 0 0;color:#98a2b3;font-size:10px;line-height:16px;">Automated SMTP configuration test. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: "e-Blood SMTP Configuration Verification",
    text,
    html,
  };
}

async function main() {
  const recipient = process.argv[2];
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Usage: npm run mail:test -- recipient@example.com");
  }

  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !MAIL_FROM) {
    throw new Error("Set SMTP_HOST and MAIL_FROM in your local .env file first.");
  }
  if (Boolean(SMTP_USER) !== Boolean(SMTP_PASSWORD)) {
    throw new Error("Set both SMTP_USER and SMTP_PASSWORD, or leave both empty.");
  }
  if (!fs.existsSync(logoPath)) {
    throw new Error(`The e-Blood logo required for the SMTP test is missing: ${logoPath}`);
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number.");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    pool: true,
    maxConnections: 1,
    ...(SMTP_USER && SMTP_PASSWORD
      ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } }
      : {}),
  });

  try {
    await transporter.verify();
    const email = buildTestEmail();
    const result = await transporter.sendMail({
      from: MAIL_FROM,
      to: recipient,
      ...email,
      attachments: [{
        filename: "eblood-logo.png",
        path: logoPath,
        cid: LOGO_CID,
        contentDisposition: "inline",
      }],
    });
    console.log(`SMTP accepted the test email (message id: ${result.messageId}).`);
  } finally {
    transporter.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || "SMTP test failed.");
    process.exitCode = 1;
  });
}

module.exports = { buildTestEmail, LOGO_CID };
