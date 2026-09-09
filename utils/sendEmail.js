import nodemailer from "nodemailer";

const sendWithSmtp = async ({ to, subject, html }) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!host || !user || !pass) return null;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM || `Aturservicett <${user}>`,
    to,
    subject: subject || "Aturservicett",
    html: html || "",
  });
};

export const sendEmail = async (to, subject, html) => {
  const apiKey = process.env.RESEND_EMAIL_API_KEY;
  const from = process.env.RESEND_EMAIL_FROM || "Aturservicett <support@aturservicett.com>";

  if (!apiKey) {
    const smtpResult = await sendWithSmtp({ to, subject, html });
    if (smtpResult) return smtpResult;

    console.log(`[sendEmail skipped - no Resend or SMTP credentials] To: ${to} | ${subject}`);
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: subject || "Aturservicett",
      html: html || "",
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = result?.message || result?.error || "Unable to send email through Resend";
    throw new Error(`Resend email failed: ${message}`);
  }

  return result;
};
