export const BLOOD_ALERT_LOGO_CID = "eblood-logo";

export type BloodRequestEmailData = {
  requestId: number;
  bloodGroup: string;
  component: string;
  unitsNeeded: number;
  urgency: string;
};

export type BloodRequestEmailRecipient = {
  recipient_name: string;
  recipient_type: string;
  distance_km: number;
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

export function buildBloodRequestEmail(
  alert: BloodRequestEmailData,
  recipient: BloodRequestEmailRecipient,
  appBaseUrl?: string
) {
  const name = escapeHtml(recipient.recipient_name || "there");
  const resourceType = escapeHtml(recipient.recipient_type);
  const bloodGroup = escapeHtml(alert.bloodGroup);
  const component = escapeHtml(alert.component.replaceAll("_", " "));
  const urgency = escapeHtml(alert.urgency);
  const urgencyColors: Record<string, string> = {
    normal: "#027a48",
    urgent: "#b54708",
    critical: "#b42318",
  };
  const urgencyColor = urgencyColors[alert.urgency] ?? "#475467";
  const distance = `${Number(recipient.distance_km).toFixed(1)} km`;
  const appLink = appBaseUrl
    ? `<a href="${escapeHtml(appBaseUrl)}" style="display:inline-block;background:#c8102e;border-radius:6px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:14px 24px;text-decoration:none;">Open eBlood</a>`
    : "";
  const appInstruction = appBaseUrl
    ? "Open eBlood to review the request and coordinate safely."
    : "Open the eBlood app to review the request and coordinate safely.";

  const text = [
    `Hello ${recipient.recipient_name || "there"},`,
    "",
    `A nearby ${alert.bloodGroup} blood request may need your help.`,
    "",
    `Request: #${alert.requestId}`,
    `Blood group: ${alert.bloodGroup}`,
    `Component: ${alert.component.replaceAll("_", " ")}`,
    `Units needed: ${alert.unitsNeeded}`,
    `Urgency: ${alert.urgency.toUpperCase()}`,
    `Approximate distance: ${Number(recipient.distance_km).toFixed(1)} km`,
    "",
    appInstruction,
    "Please confirm availability with the facility before traveling. Do not reply with sensitive patient information.",
    "",
    "You received this message because your profile or facility is eligible for nearby eBlood alerts.",
    "eBlood | One Drop. One Hope. One Life.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Nearby blood request | eBlood</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell { width: 100% !important; }
      .email-content { padding: 28px 20px !important; }
      .detail-cell { display: block !important; width: auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;color:#101828;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    A nearby ${bloodGroup} blood request may need your help.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f4f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table class="email-shell" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #eaecf0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="height:5px;background:#c8102e;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 24px 18px;background:#ffffff;">
              <img src="cid:${BLOOD_ALERT_LOGO_CID}" width="176" alt="eBlood - One Drop. One Hope. One Life." style="display:block;width:176px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:34px 42px 38px;border-top:1px solid #f2f4f7;">
              <p style="margin:0 0 10px;color:#c8102e;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Nearby blood request</p>
              <h1 style="margin:0 0 14px;color:#101828;font-size:26px;line-height:34px;font-weight:700;">A request may need your help</h1>
              <p style="margin:0 0 24px;color:#475467;font-size:15px;line-height:24px;">Hello ${name}, a blood request has been raised near you. As a ${resourceType}, your support could make a meaningful difference.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background:#fff8f8;border:1px solid #fecdca;border-radius:8px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 5px;color:#667085;font-size:12px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">Blood group</p>
                    <p style="margin:0;color:#b42318;font-size:30px;line-height:36px;font-weight:700;">${bloodGroup}</p>
                  </td>
                  <td align="right" style="padding:18px 20px;">
                    <span style="display:inline-block;padding:7px 10px;background:${urgencyColor};border-radius:20px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;">${urgency}</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td class="detail-cell" width="50%" valign="top" style="padding:10px 8px 10px 0;border-bottom:1px solid #eaecf0;">
                    <span style="display:block;color:#667085;font-size:12px;line-height:18px;">Component</span>
                    <strong style="display:block;color:#101828;font-size:14px;line-height:22px;">${component}</strong>
                  </td>
                  <td class="detail-cell" width="50%" valign="top" style="padding:10px 0 10px 8px;border-bottom:1px solid #eaecf0;">
                    <span style="display:block;color:#667085;font-size:12px;line-height:18px;">Units required</span>
                    <strong style="display:block;color:#101828;font-size:14px;line-height:22px;">${alert.unitsNeeded}</strong>
                  </td>
                </tr>
                <tr>
                  <td class="detail-cell" width="50%" valign="top" style="padding:10px 8px 10px 0;">
                    <span style="display:block;color:#667085;font-size:12px;line-height:18px;">Approx. distance</span>
                    <strong style="display:block;color:#101828;font-size:14px;line-height:22px;">${distance}</strong>
                  </td>
                  <td class="detail-cell" width="50%" valign="top" style="padding:10px 0 10px 8px;">
                    <span style="display:block;color:#667085;font-size:12px;line-height:18px;">Request reference</span>
                    <strong style="display:block;color:#101828;font-size:14px;line-height:22px;">#${alert.requestId}</strong>
                  </td>
                </tr>
              </table>
              ${appLink ? `<div style="margin:0 0 22px;">${appLink}</div>` : ""}
              <p style="margin:0 0 12px;color:#344054;font-size:14px;line-height:22px;">${escapeHtml(appInstruction)}</p>
              <p style="margin:0;color:#667085;font-size:12px;line-height:19px;">Please confirm availability with the facility before traveling. Never share sensitive patient information by replying to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eaecf0;">
              <p style="margin:0 0 6px;color:#344054;font-size:12px;line-height:18px;font-weight:700;">One Drop. One Hope. One Life.</p>
              <p style="margin:0;color:#667085;font-size:11px;line-height:17px;">You received this message because your donor profile or verified facility is eligible for nearby eBlood alerts. If you believe this is an error, contact eBlood support.</p>
              <p style="margin:12px 0 0;color:#98a2b3;font-size:10px;line-height:16px;">© ${new Date().getFullYear()} eBlood. Please do not reply to this automated message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: `Nearby ${alert.bloodGroup} blood request (${alert.urgency})`, text, html };
}
