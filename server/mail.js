import nodemailer from 'nodemailer';
import { createBadRequest } from './lib/httpErrors.js';


function normalizeSecureMode(value) {
  const nextValue = String(value ?? '').trim().toLowerCase();
  if (!nextValue || nextValue === 'false' || nextValue === 'plain' || nextValue === 'none') {
    return {
      secure: false,
      requireTLS: false,
    };
  }

  if (nextValue === 'ssl' || nextValue === 'true') {
    return {
      secure: true,
      requireTLS: false,
    };
  }

  if (nextValue === 'tls' || nextValue === 'starttls') {
    return {
      secure: false,
      requireTLS: true,
    };
  }

  throw createBadRequest('SMTP secure mode is invalid.');
}

function createHtmlDocument(title, intro, actionLabel, actionUrl, closing) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f2eb;color:#111111;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid rgba(17,17,17,0.16);border-radius:16px;background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,244,237,0.82));box-shadow:inset 0 1px 0 rgba(255,255,255,0.96), 0 10px 24px rgba(17,17,17,0.05);overflow:hidden;">
            <tr>
              <td style="padding:32px;border-radius:16px;background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,244,237,0.82));">
                <p style="margin:0 0 12px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#6f6a63;">FinalFolio</p>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.05;font-weight:600;">${title}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3b342d;">${intro}</p>
                <p style="margin:0 0 24px;">
                  <a href="${actionUrl}" style="display:inline-block;min-height:38px;padding:0 14px;border-radius:5px;border:1px solid rgba(24,21,18,0.94);background:linear-gradient(180deg, rgba(53,48,42,0.96), rgba(18,16,14,0.98)), rgba(17,17,17,0.92);box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.32), 0 18px 36px rgba(17,17,17,0.2);color:#faf8f3;font-size:0.84rem;font-weight:600;line-height:38px;text-decoration:none;">${actionLabel}</a>
                </p>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6f6a63;">If the button does not open, use this link:</p>
                <p style="margin:0 0 20px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${actionUrl}" style="color:#111111;">${actionUrl}</a></p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6f6a63;">${closing}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createTextMessage({ title, intro, actionLabel, actionUrl, closing }) {
  return `${title}

${intro}

${actionLabel}: ${actionUrl}

${closing}`;
}

export function createMailService({
  host = process.env.FINALFOLIO_SMTP_HOST,
  port = process.env.FINALFOLIO_SMTP_PORT,
  user = process.env.FINALFOLIO_SMTP_USER,
  pass = process.env.FINALFOLIO_SMTP_PASS,
  secureMode = process.env.FINALFOLIO_SMTP_SECURE,
  from = process.env.FINALFOLIO_MAIL_FROM,
  fromName = process.env.FINALFOLIO_MAIL_FROM_NAME,
} = {}) {
  const missing = [
    ['FINALFOLIO_SMTP_HOST', host],
    ['FINALFOLIO_SMTP_PORT', port],
    ['FINALFOLIO_SMTP_USER', user],
    ['FINALFOLIO_SMTP_PASS', pass],
    ['FINALFOLIO_MAIL_FROM', from],
    ['FINALFOLIO_MAIL_FROM_NAME', fromName],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    const error = new Error(`Missing SMTP configuration: ${missing.map(([name]) => name).join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  const transportSecurity = normalizeSecureMode(secureMode);
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: transportSecurity.secure,
    requireTLS: transportSecurity.requireTLS,
    auth: {
      user,
      pass,
    },
  });

  async function sendVerificationEmail({ to, actionUrl }) {
    const title = 'Verify your FinalFolio account';
    const intro = 'Confirm this email address to activate your account and keep your project ownership tied to the right identity.';
    const actionLabel = 'Verify email';
    const closing = 'If you did not create this account, you can ignore this message.';

    await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject: title,
      text: createTextMessage({ title, intro, actionLabel, actionUrl, closing }),
      html: createHtmlDocument(title, intro, actionLabel, actionUrl, closing),
    });
  }

  async function sendPasswordResetEmail({ to, actionUrl }) {
    const title = 'Reset your FinalFolio password';
    const intro = 'Use the link below to set a new password for your FinalFolio account.';
    const actionLabel = 'Reset password';
    const closing = 'If you did not ask to reset your password, you can ignore this message.';

    await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject: title,
      text: createTextMessage({ title, intro, actionLabel, actionUrl, closing }),
      html: createHtmlDocument(title, intro, actionLabel, actionUrl, closing),
    });
  }

  return {
    sendVerificationEmail,
    sendPasswordResetEmail,
  };
}
