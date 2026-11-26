import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import env from "../config";

const logoPath = path.resolve(__dirname, "..", "..", "assets", "eblood-logo.png");
let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

export function getMailer() {
  if (!env.SMTP_HOST) return null;
  if (!env.MAIL_FROM) {
    throw new Error("MAIL_FROM is required when SMTP_HOST is configured");
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together");
  }

  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    pool: true,
    maxConnections: 3,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });

  return { transporter, from: env.MAIL_FROM };
}

export function getBrandLogoAttachment(cid: string) {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`eBlood email logo asset is missing: ${logoPath}`);
  }

  return {
    filename: "eblood-logo.png",
    path: logoPath,
    cid,
    contentDisposition: "inline" as const,
  };
}
