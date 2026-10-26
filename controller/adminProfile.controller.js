import User from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { getActiveCategoryNames, writeAuditLog } from "../utils/adminHelpers.js";
import { applyProfileChanges, saveProfileWithImages } from "../utils/profileHelpers.js";

const findTradesman = async (id) => {
  const user = await User.findById(id);
  if (!user || user.role !== "tradesman") throw new AppError(404, "Tradesman not found");
  const profile = await TradesmanProfile.findOne({ user: id });
  if (!profile) throw new AppError(404, "Tradesman profile not found");
  return { user, profile };
};

const respond = (res, user, profile, message) => sendResponse(res, {
  statusCode: 200, success: true, message,
  data: { ...user.toJSON(), tradesmanProfile: profile.toJSON() },
});

export const updateTradesmanAdmin = catchAsync(async (req, res) => {
  const { user, profile } = await findTradesman(req.params.userId);
  const allowed = ["firstName", "lastName", "phoneNumber", "area", "mainSkill", "extraSkills", "homeArea", "travelRange", "pitch", "rateAmount", "rateUnit"];
  const invalid = Object.keys(req.body).filter((key) => !allowed.includes(key));
  if (invalid.length) throw new AppError(400, `Unsupported fields: ${invalid.join(", ")}`);
  for (const field of ["firstName", "lastName", "phoneNumber", "area"]) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== "string") throw new AppError(400, `${field} must be text`);
      if (["firstName", "phoneNumber"].includes(field) && !req.body[field].trim()) throw new AppError(400, `${field} cannot be empty`);
      user[field] = req.body[field].trim();
    }
  }
  applyProfileChanges(profile, req.body, await getActiveCategoryNames());
  await saveProfileWithImages({ user, profile, avatar: req.file, workPhotos: req.workPhotoFiles || [] });
  await writeAuditLog(req, { action: "tradesman.profile.updated", entityType: "tradesman", entityId: profile._id, summary: "Tradesman profile updated", metadata: { fields: Object.keys(req.body), avatarUpdated: Boolean(req.file), workPhotosAdded: req.workPhotoFiles?.length || 0 } });
  respond(res, user, profile, "Tradesman profile updated");
});

export const resolveContactChangeAdmin = catchAsync(async (req, res) => {
  const { action, note = "", requestedAt } = req.body;
  if (!["approve", "reject"].includes(action)) throw new AppError(400, "Action must be approve or reject");
  const { user, profile } = await findTradesman(req.params.userId);
  const request = profile.contactChangeRequest;
  if (request.status !== "pending") throw new AppError(409, "There is no pending contact change request");
  if (!requestedAt || new Date(requestedAt).getTime() !== request.requestedAt?.getTime()) {
    throw new AppError(409, "This request has changed. Refresh and review it again");
  }
  if (action === "approve") {
    if (request.requestedName?.trim()) {
      const [first, ...rest] = request.requestedName.trim().split(/\s+/);
      user.firstName = first;
      user.lastName = rest.join(" ");
    }
    if (request.requestedPhoneNumber?.trim()) user.phoneNumber = request.requestedPhoneNumber.trim();
  }
  request.status = action === "approve" ? "resolved" : "rejected";
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.reviewNote = String(note).trim();
  await saveProfileWithImages({ user, profile });
  await writeAuditLog(req, { action: `tradesman.contact-change.${action === "approve" ? "approved" : "rejected"}`, entityType: "tradesman", entityId: profile._id, summary: `Contact change ${action}d` });
  respond(res, user, profile, action === "approve" ? "Contact details updated" : "Contact change rejected");
});
