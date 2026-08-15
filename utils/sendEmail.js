import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, html) => {
  
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  if (!smtpUser || !smtpPass) {
    console.log(`[sendEmail skipped - no SMTP config] To: ${to} | ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || smtpUser,
    to,
    subject: subject || "Aturservicett",
    html,
  });
};
