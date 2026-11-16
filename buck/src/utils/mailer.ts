import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS?.trim() ?? "";
  const rawPort = Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 587;

  if (!host || !user || !pass) {
    return null;
  }

  const from =
    process.env.SMTP_FROM?.trim() || `Buck The Budget Tracker <${user}>`;

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
  };
}

export function isSmtpConfigured() {
  return getSmtpConfig() !== null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReadableDateTime(iso: string) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return iso;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(timestamp));
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const config = getSmtpConfig();
  if (!config) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    html,
    text,
  });

  return true;
}

export async function sendAccountDeletionConfirmationEmail({
  to,
  username,
  confirmUrl,
  expiresMinutes = 60,
}: {
  to: string;
  username?: string | null;
  confirmUrl: string;
  expiresMinutes?: number;
}) {
  const safeName = escapeHtml(username?.trim() || "Buck User");
  const safeEmail = escapeHtml(to);
  const safeUrl = escapeHtml(confirmUrl);

  return sendEmail({
    to,
    subject: "Confirm your Buck account deletion (Final Step)",
    html: `<div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px 28px;">
    <div style="text-align:center;margin-bottom:28px;">
      <img src="https://i.imgur.com/ZEElk1d.png" alt="Buck The Budget Tracker" width="170" style="max-width:170px;height:auto;">
    </div>
    <p style="margin:0 0 18px;line-height:1.7;">Good day, <strong>${safeName}</strong>!</p>
    <p style="margin:0 0 18px;line-height:1.7;">You completed the 3-step account deletion check in Buck for <strong>${safeEmail}</strong>. To complete the <strong>4th and final step</strong>, click the button below within ${expiresMinutes} minutes:</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${safeUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:8px;">Confirm Account Deletion</a>
    </p>
    <p style="margin:0 0 14px;line-height:1.7;">What happens next:</p>
    <ul style="margin:0 0 20px;padding-left:20px;line-height:1.7;">
      <li>Once confirmed, your account is scheduled for permanent deletion in <strong>10 days</strong>.</li>
      <li>If you sign back into Buck during those 10 days, deletion will be <strong>canceled automatically</strong>.</li>
    </ul>
    <p style="margin:0 0 12px;line-height:1.7;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 22px;word-break:break-all;line-height:1.6;"><a href="${safeUrl}" style="color:#0d7cff;">${safeUrl}</a></p>
    <p style="margin:0;line-height:1.7;">If you did not request this, you can safely ignore this email and keep using Buck.</p>
    <p style="margin:26px 0 0;line-height:1.7;">Thanks,<br>The <strong>Buck</strong> team</p>
  </div>
</div>`,
    text: `Good day, ${username?.trim() || "Buck User"}!\n\nYou completed the 3-step account deletion check in Buck for ${to}.\nOpen this link within ${expiresMinutes} minutes to complete the 4th and final confirmation step:\n${confirmUrl}\n\nAfter you confirm, your account will be permanently deleted in 10 days. If you sign back into Buck during those 10 days, deletion is canceled automatically.\n`,
  });
}

export async function sendAccountDeletionAutoCanceledEmail({
  to,
  username,
  canceledAtIso,
  scheduledPurgeIso,
}: {
  to: string;
  username?: string | null;
  canceledAtIso: string;
  scheduledPurgeIso: string;
}) {
  const safeName = escapeHtml(username?.trim() || "Buck User");
  const safeEmail = escapeHtml(to);
  const safeCanceled = escapeHtml(formatReadableDateTime(canceledAtIso));
  const safePurge = escapeHtml(formatReadableDateTime(scheduledPurgeIso));

  return sendEmail({
    to,
    subject: "Your Buck account deletion was canceled",
    html: `<div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px 28px;">
    <div style="text-align:center;margin-bottom:28px;">
      <img src="https://i.imgur.com/ZEElk1d.png" alt="Buck The Budget Tracker" width="170" style="max-width:170px;height:auto;">
    </div>
    <p style="margin:0 0 18px;line-height:1.7;">Good day, <strong>${safeName}</strong>!</p>
    <p style="margin:0 0 18px;line-height:1.7;">You signed back in to your Buck account (<strong>${safeEmail}</strong>) on <strong>${safeCanceled}</strong> (PHT) while your account was within the 10-day deletion window (previously scheduled for <strong>${safePurge}</strong>).</p>
    <p style="margin:0 0 18px;line-height:1.7;"><strong>Your account deletion has been automatically canceled.</strong> Your wallets, expenses, categories, and goals remain active.</p>
    <p style="margin:0;line-height:1.7;">If this sign-in wasn&apos;t you, please review your security settings immediately.</p>
    <p style="margin:26px 0 0;line-height:1.7;">Thanks,<br>The <strong>Buck</strong> team</p>
  </div>
</div>`,
    text: `Good day, ${username?.trim() || "Buck User"}!\n\nBecause you signed back in to ${to} on ${formatReadableDateTime(canceledAtIso)} (PHT), your scheduled account deletion (previously set for ${formatReadableDateTime(scheduledPurgeIso)}) has been automatically canceled.\n\nYour Buck account and financial data remain active.\n`,
  });
}
