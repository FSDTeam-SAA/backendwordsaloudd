import crypto from "crypto";
import { sendEmail } from "./sendEmail.js";

export const hashInvitationToken = (token) => crypto
  .createHash("sha256")
  .update(String(token || ""))
  .digest("hex");

const inviteExpiryHours = () => {
  const configured = Number(process.env.ADMIN_INVITE_EXPIRES_HOURS || 24);
  return Number.isFinite(configured) ? Math.min(168, Math.max(1, configured)) : 24;
};

export const sendAdminInvitation = async (invitation) => {
  const token = crypto.randomBytes(32).toString("hex");
  const hours = inviteExpiryHours();
  invitation.tokenHash = hashInvitationToken(token);
  invitation.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  invitation.status = "pending";
  invitation.acceptedBy = null;
  invitation.acceptedAt = null;
  await invitation.save();

  const dashboardUrl = String(process.env.ADMIN_DASHBOARD_URL || "http://localhost:3000").replace(/\/$/, "");
  const acceptUrl = `${dashboardUrl}/accept-admin-invite?token=${encodeURIComponent(token)}`;
  await sendEmail(
    invitation.email,
    "Accept your Aturservicett administrator invitation",
    `<p>You have been invited to the Aturservicett administration dashboard.</p>
     <p><a href="${acceptUrl}">Accept the invitation and set your password</a></p>
     <p>This single-use link expires in ${hours} hours. If you did not expect this invitation, you can ignore this email.</p>`,
  );

  return { acceptUrl, expiresAt: invitation.expiresAt };
};
