export const sendEmail = async (to, subject, html) => {
  const apiKey = process.env.RESEND_EMAIL_API_KEY;
  const from = process.env.RESEND_EMAIL_FROM || "Aturservicett <support@aturservicett.com>";

  if (!apiKey) {
    console.log(`[sendEmail skipped - no Resend API key] To: ${to} | ${subject}`);
    return;
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
