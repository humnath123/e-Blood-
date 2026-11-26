// dotenv configuration
require('dotenv').config();

const { runQuery } = require('./dist/database/pool');
const nodemailer = require('nodemailer');

// Use configured SMTP settings from .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER || 'sachinpokharel40k@gmail.com', pass: process.env.SMTP_PASSWORD || 'pbqjsoiimqfmkuzm' }
});

async function main() {
  // Generate eligibility report data
  const query = `
    SELECT 
      u.username,
      u.blood_group,
      u.is_available,
      u.eligibility_status,
      u.has_fever,
      u.has_anaemia,
      u.has_jaundice,
      u.is_pregnant,
      d.collected_at as last_donation
    FROM users u
    LEFT JOIN donations d ON u.user_id = d.user_id
    WHERE u.role = 'donor'
    ORDER BY u.eligibility_status, u.last_donated_at NULLS FIRST
  `;
  
  const donors = await runQuery(query);
  
  // Build summary
  const summary = {
    total: donors.length,
    eligible: 0,
    pending: 0,
    not_eligible: 0,
    not_available: 0,
    byStatus: {},
    commonIssues: {
      fever: 0,
      anaemia: 0,
      jaundice: 0,
      pregnancy: 0,
      heart_disease: 0,
      diabetes: 0
    }
  };
  
  donors.forEach(donor => {
    const status = donor.eligibility_status;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    
    switch (status) {
      case 'eligible': summary.eligible++; break;
      case 'pending': summary.pending++; break;
      case 'not_eligible': summary.not_eligible++; break;
      case 'not_available': summary.not_available++; break;
    }
    
    if (donor.has_fever === 1) summary.commonIssues.fever++;
    if (donor.has_anaemia === 1) summary.commonIssues.anaemia++;
    if (donor.has_jaundice === 1) summary.commonIssues.jaundice++;
    if (donor.is_pregnant === 1) summary.commonIssues.pregnancy++;
  });
  
  // Build email subject
  const subject = 'Donor Eligibility Report - e-Blood';
  
  // Build plain text
  let text = 'Donor Eligibility Report - e-Blood\n';
  text += '========================================\n\n';
  text += 'Total Donors: ' + summary.total + '\n';
  text += 'Eligible to Donate: ' + summary.eligible + '\n';
  text += 'Pending Assessment: ' + summary.pending + '\n';
  text += 'Not Eligible: ' + summary.not_eligible + '\n';
  text += 'Not Available: ' + summary.not_available + '\n\n';
  text += 'Eligibility Breakdown:\n';
  text += '- Eligible: ' + summary.eligible + ' (' + ((summary.eligible / summary.total * 100).toFixed(1)) + '%)\n';
  text += '- Pending: ' + summary.pending + ' (' + ((summary.pending / summary.total * 100).toFixed(1)) + '%)\n';
  text += '- Not Eligible: ' + summary.not_eligible + ' (' + ((summary.not_eligible / summary.total * 100).toFixed(1)) + '%)\n';
  text += '- Not Available: ' + summary.not_available + ' (' + ((summary.not_available / summary.total * 100).toFixed(1)) + '%)\n\n';
  text += 'Common Issues:\n';
  text += '- Fever/Active Infection: ' + summary.commonIssues.fever + '\n';
  text += '- Anaemia/Low Hb: ' + summary.commonIssues.anaemia + '\n';
  text += '- Jaundice: ' + summary.commonIssues.jaundice + '\n';
  text += '- Pregnancy: ' + summary.commonIssues.pregnancy + '\n\n';
  text += 'This report was generated automatically by the e-Blood donor management system.\n';
  
  // Build HTML
  let html = '<!DOCTYPE html>';
  html += '<html lang="en">';
  html += '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Donor Eligibility Report</title></head>';
  html += '<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #eaecf0;border-radius:12px;overflow:hidden;">';
  html += '<tr><td style="padding:28px 32px;text-align:center;border-bottom:1px solid #eaecf0;">';
  html += '<img src="cid:eblood-certificate-logo" alt="e-Blood Logo" style="display:block;width:120px;height:auto;margin:0 auto 12px;"><br>';
  html += '<h2 style="margin:0;color:#E60023;font-size:14;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Donor Eligibility Report</h2>';
  html += '</td></tr>';
  html += '<tr><td style="padding:32px 32px 20px;">';
  html += '<h1 style="margin:0 0 24px;color:#1A1A2E;font-size:28;font-weight:700;line-height:1.3;">Donor Eligibility Summary</h1>';
  html += '<p style="margin:0 0 20px;font-size:16;color:#333333;line-height:1.7;">Dear e-Blood Team,</p>';
  html += '<p style="margin:0 0 20px;font-size:16;color:#333333;line-height:1.7;">Please find below the donor eligibility report generated for the e-Blood donation system.</p>';
  html += '<div style="background:#f8f9fa;padding:20px;border-radius:8;margin:20px 0;">';
  html += '<h3 style="margin:0 0 16px;color:#1A1A2E;">Report Summary</h3>';
  html += '<p style="margin:0;font-size:16;color:#333333;"><strong>Total Donors:</strong> ' + summary.total + '<br>';
  html += '<strong>Eligible to Donate:</strong> ' + summary.eligible + '<br>';
  html += '<strong>Pending Assessment:</strong> ' + summary.pending + '<br>';
  html += '<strong>Not Eligible:</strong> ' + summary.not_eligible + '<br>';
  html += '<strong>Not Available:</strong> ' + summary.not_available + '</p>';
  html += '</div>';
  html += '<div style="background:#f8f9fa;padding:20px;border-radius:8;margin:20px 0;">';
  html += '<h3 style="margin:0 0 16px;color:#1A1A2E;">Eligibility Breakdown</h3>';
  html += '<p style="margin:0;font-size:16;color:#333333;"><strong>Eligible:</strong> ' + summary.eligible + ' (' + (summary.eligible / summary.total * 100).toFixed(1) + '%)<br>';
  html += '<strong>Pending:</strong> ' + summary.pending + ' (' + (summary.pending / summary.total * 100).toFixed(1) + '%)<br>';
  html += '<strong>Not Eligible:</strong> ' + summary.not_eligible + ' (' + (summary.not_eligible / summary.total * 100).toFixed(1) + '%)<br>';
  html += '<strong>Not Available:</strong> ' + summary.not_available + ' (' + (summary.not_available / summary.total * 100).toFixed(1) + '%)</p>';
  html += '</div>';
  html += '<div style="background:#f8f9fa;padding:20px;border-radius:8;margin:20px 0;">';
  html += '<h3 style="margin:0 0 16px;color:#1A1A2E;">Common Issues</h3>';
  html += '<p style="margin:0;font-size:16;color:#333333;"><strong>Fever/Active Infection:</strong> ' + summary.commonIssues.fever + '<br>';
  html += '<strong>Anaemia/Low Hb:</strong> ' + summary.commonIssues.anaemia + '<br>';
  html += '<strong>Jaundice:</strong> ' + summary.commonIssues.jaundice + '<br>';
  html += '<strong>Pregnancy:</strong> ' + summary.commonIssues.pregnancy + '</p>';
  html += '</div>';
  html += '<p style="margin:24px 0;font-size:16;color:#666666;line-height:1.7;">This report was generated automatically by the e-Blood donor management system.</p>';
  html += '<p style="margin:24px 0;font-size:16;color:#666666;line-height:1.7;">With regards,\\n e-Blood Donor Management System</p>';
  html += '</div>';
  html += '<tr><td style="padding:0 32px 32px;"><p style="margin:0 0 8px;font-size:14;color:#666666;line-height:1.6;">With heartfelt gratitude,</p>';
  html += '<p style="margin:0;font-size:15;color:#1A1A2E;font-weight:600;line-height:1.6;">Humnath Pokharel and Surav Bogati</p>';
  html += '<p style="margin:4px 0 0;font-size:14;color:#666666;line-height:1.6;">CEOs, e-Blood</p>';
  html += '<p style="margin:12px 0 0;font-size:13;color:#666666;line-height:1.6;">Connecting Donors. Saving Lives.</p></td></tr>';
  html += '</table>';
  html += '</body></html>';
  
  // Send email
  await transporter.sendMail({
    from: 'eBlood Alerts <sachinpokharel40k@gmail.com>',
    to: 'godavid914@gmail.com',
    subject: subject,
    text: text,
    html: html,
    attachments: [{
      filename: 'eblood-logo.png',
      path: './assets/eblood-logo.png',
      cid: 'eblood-certificate-logo',
      contentDisposition: 'inline',
    }]
  });
  
  console.log('Donor eligibility report sent to godavid914@gmail.com');
  
  // Close transporter
  transporter.close();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });