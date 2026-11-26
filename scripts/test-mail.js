require("dotenv/config");

const nodemailer = require("nodemailer");

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
    const result = await transporter.sendMail({
      from: MAIL_FROM,
      to: recipient,
      subject: "eBlood SMTP configuration test",
      text: "This is a test email confirming the eBlood backend SMTP configuration.",
    });
    console.log(`SMTP accepted the test email (message id: ${result.messageId}).`);
  } finally {
    transporter.close();
  }
}

main().catch((error) => {
  console.error(error.message || "SMTP test failed.");
  process.exitCode = 1;
});
