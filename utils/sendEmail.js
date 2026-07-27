import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, html) => {
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[sendEmail skipped - no SMTP config] To: ${to} | ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: subject || "Aturservicett",
    html,
  });
};
