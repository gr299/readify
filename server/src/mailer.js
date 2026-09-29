import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const MAIL_FROM = process.env.MAIL_FROM || 'Readify <no-reply@readify.app>';

let transport = null;
if (SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export function isSmtpConfigured() {
  return Boolean(transport);
}

export async function sendVerificationLink(to, link) {
  if (transport) {
    await transport.sendMail({
      from: MAIL_FROM,
      to,
      subject: 'Verify your new Readify email',
      text: `Click this link to confirm your new email address:\n\n${link}\n\nIf you did not request this change, you can safely ignore this email.`,
    });
    return { dev: false };
  }
  console.log(`[readify:mail] Verification link for ${to}: ${link}`);
  return { dev: true };
}
