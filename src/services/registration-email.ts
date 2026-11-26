import env from "../config";
import { getBrandLogoAttachment, getMailer } from "./mailer";

export const REGISTRATION_LOGO_CID = "eblood-registration-logo";

export type RegistrationEmailData = {
  recipientEmail: string;
  userName: string;
  bloodGroup?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function buildRegistrationEmail(data: RegistrationEmailData) {
  const userName = escapeHtml(data.userName);
  const bloodGroup = data.bloodGroup ? escapeHtml(data.bloodGroup) : "Not added yet";
  const appLink = env.APP_BASE_URL
    ? `<a href="${escapeHtml(env.APP_BASE_URL)}" style="display:inline-block;background:#c8102e;border-radius:6px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:13px 22px;text-decoration:none;">Open e-Blood</a>`
    : "";

  const text = [
    `Dear ${data.userName},`,
    "",
    "Welcome to e-Blood!",
    "",
    "Thank you for joining our platform. We are happy to have you as part of our community dedicated to making blood donation easier, faster, and more accessible.",
    "",
    "Your account has been successfully registered.",
    "",
    "What's next?",
    "- Complete your profile.",
    "- Add your blood group.",
    "- Set your donor availability if you wish to donate.",
    "- Explore nearby blood banks and donation opportunities.",
    "",
    "Together, we can help save lives by connecting people who need blood with those willing to donate.",
    "",
    "Someone, somewhere, may be waiting for a life-saving blood donation. Your willingness to donate could make the difference between life and death.",
    "",
    "We would like to invite you to become a blood donor and help someone in need.",
    "",
    "Why donate blood?",
    "- Your donation can help save lives.",
    "- Support patients during medical emergencies.",
    "- Help maintain an adequate blood supply.",
    "- Become part of a community of life-saving donors.",
    "",
    "If you are willing and eligible to donate blood, log in to your e-Blood account and update your donor availability.",
    "",
    "Your details:",
    `- Name: ${data.userName}`,
    `- Blood Group: ${data.bloodGroup || "Not added yet"}`,
    "- Location: Add your location in your profile",
    "",
    "Remember, blood cannot be manufactured. It can only come from generous donors like you.",
    "",
    "If you did not create this account, please contact our support team immediately.",
    "",
    "With gratitude,",
    "e-Blood Support Team",
    "Connecting Donors. Saving Lives.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Welcome to e-Blood</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell { width: 100% !important; }
      .email-content { padding: 26px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;color:#101828;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Welcome to e-Blood. Together, we can help connect donors with people who need blood.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f4f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table class="email-shell" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #eaecf0;border-radius:12px;overflow:hidden;">
          <tr><td style="height:5px;background:#c8102e;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:22px 24px 18px;">
              <img src="cid:${REGISTRATION_LOGO_CID}" width="176" alt="e-Blood - Connecting Donors. Saving Lives." style="display:block;width:176px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:34px 42px 38px;border-top:1px solid #f2f4f7;">
              <p style="margin:0 0 10px;color:#c8102e;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Welcome to e-Blood</p>
              <h1 style="margin:0 0 14px;color:#101828;font-size:26px;line-height:34px;">Dear ${userName}, welcome!</h1>
              <p style="margin:0 0 14px;color:#475467;font-size:15px;line-height:24px;">Thank you for joining our platform. We are happy to have you in our community, making blood donation easier, faster, and more accessible.</p>
              <p style="margin:0 0 26px;color:#027a48;font-size:14px;line-height:22px;font-weight:700;">Your account has been successfully registered.</p>

              <h2 style="margin:0 0 10px;color:#101828;font-size:18px;line-height:26px;">What's next?</h2>
              <ul style="margin:0 0 22px;padding-left:22px;color:#475467;font-size:14px;line-height:24px;">
                <li>Complete your profile.</li>
                <li>Add your blood group.</li>
                <li>Set your donor availability if you wish to donate.</li>
                <li>Explore nearby blood banks and donation opportunities.</li>
              </ul>
              <p style="margin:0 0 28px;color:#475467;font-size:14px;line-height:23px;">Together, we can help save lives by connecting people who need blood with those willing to donate.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#fff8f8;border:1px solid #fecdca;border-radius:8px;">
                <tr>
                  <td style="padding:22px 20px;">
                    <h2 style="margin:0 0 10px;color:#b42318;font-size:18px;line-height:26px;">Become a lifesaving blood donor</h2>
                    <p style="margin:0 0 14px;color:#475467;font-size:14px;line-height:23px;">Someone, somewhere, may be waiting for a life-saving blood donation. Your willingness to donate could make the difference between life and death.</p>
                    <p style="margin:0 0 8px;color:#344054;font-size:14px;line-height:22px;font-weight:700;">Why donate blood?</p>
                    <ul style="margin:0 0 16px;padding-left:20px;color:#475467;font-size:14px;line-height:23px;">
                      <li>Your donation can help save lives.</li>
                      <li>Support patients during medical emergencies.</li>
                      <li>Help maintain an adequate blood supply.</li>
                      <li>Become part of a community of life-saving donors.</li>
                    </ul>
                    <p style="margin:0;color:#475467;font-size:14px;line-height:23px;">If you are willing and eligible to donate blood, log in to your account and update your donor availability.</p>
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 10px;color:#101828;font-size:18px;line-height:26px;">Your details</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
                <tr><td style="padding:10px 0;border-bottom:1px solid #eaecf0;color:#667085;font-size:13px;">Name</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eaecf0;color:#101828;font-size:13px;font-weight:700;">${userName}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid #eaecf0;color:#667085;font-size:13px;">Blood group</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eaecf0;color:#101828;font-size:13px;font-weight:700;">${bloodGroup}</td></tr>
                <tr><td style="padding:10px 0;color:#667085;font-size:13px;">Location</td><td align="right" style="padding:10px 0;color:#101828;font-size:13px;font-weight:700;">Add it in your profile</td></tr>
              </table>
              <p style="margin:0 0 22px;color:#475467;font-size:14px;line-height:23px;">Remember, blood cannot be manufactured. It can only come from generous donors like you.</p>
              ${appLink ? `<div style="margin:0 0 22px;">${appLink}</div>` : ""}
              <p style="margin:0;color:#667085;font-size:12px;line-height:19px;">If you did not create this account, please contact our support team immediately.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eaecf0;">
              <p style="margin:0 0 6px;color:#344054;font-size:12px;line-height:18px;font-weight:700;">With gratitude, e-Blood Support Team</p>
              <p style="margin:0;color:#667085;font-size:11px;line-height:17px;">Connecting Donors. Saving Lives.</p>
              <p style="margin:12px 0 0;color:#98a2b3;font-size:10px;line-height:16px;">Please do not reply to this automated message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: "Welcome to e-Blood - Join our donor community",
    text,
    html,
  };
}

export async function sendRegistrationEmail(data: RegistrationEmailData) {
  const mailer = getMailer();
  if (!mailer) return false;

  const email = buildRegistrationEmail(data);
  await mailer.transporter.sendMail({
    from: mailer.from,
    to: data.recipientEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: [getBrandLogoAttachment(REGISTRATION_LOGO_CID)],
  });
  return true;
}
