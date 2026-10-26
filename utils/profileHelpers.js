import AppError from "../errors/AppError.js";
import { normalizeRateUnit, normalizeTravelRange } from "../constants/skills.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "./commonMethod.js";

export const MAX_WORK_PHOTOS = 6;

export const applyProfileChanges = (profile, body, activeSkills) => {
  if (body.mainSkill !== undefined) {
    if (!activeSkills.includes(body.mainSkill)) throw new AppError(400, "A valid main skill is required");
    profile.mainSkill = body.mainSkill;
  }
  if (body.extraSkills !== undefined) {
    let extras = body.extraSkills;
    if (typeof extras === "string") {
      try { extras = JSON.parse(extras); } catch { throw new AppError(400, "Extra skills must be a JSON array"); }
    }
    if (!Array.isArray(extras) || extras.length > 2 || extras.some((skill) => !activeSkills.includes(skill))) {
      throw new AppError(400, "Choose at most two valid extra skills");
    }
    profile.extraSkills = [...new Set(extras)];
  }
  if (profile.isVip && profile.vipBySkill && ![profile.mainSkill, ...(profile.extraSkills || [])].includes(profile.vipBySkill)) {
    throw new AppError(400, "The assigned VIP skill cannot be removed");
  }
  if (body.homeArea !== undefined) profile.homeArea = body.homeArea;
  if (body.travelRange !== undefined) {
    const range = normalizeTravelRange(body.travelRange);
    if (!range) throw new AppError(400, "A valid travel range is required");
    profile.travelRange = range;
  }
  if (body.pitch !== undefined) profile.pitch = body.pitch;
  if (body.rateAmount !== undefined) {
    if (String(body.rateAmount).trim() === "" || !Number.isFinite(Number(body.rateAmount)) || Number(body.rateAmount) < 0) {
      throw new AppError(400, "Rate must be a non-negative number");
    }
    profile.typicalRate.amount = Number(body.rateAmount);
  }
  if (body.rateUnit !== undefined) {
    const unit = normalizeRateUnit(body.rateUnit);
    if (!unit) throw new AppError(400, "A valid rate unit is required");
    profile.typicalRate.unit = unit;
  }
};

// Roll back new assets on upload/database failure. Delete old assets only after commit.
export const saveProfileWithImages = async ({ user, profile, avatar, workPhotos = [] }) => {
  if (workPhotos.length && (profile.workPhotos.length + workPhotos.length > MAX_WORK_PHOTOS)) {
    throw new AppError(400, `A maximum of ${MAX_WORK_PHOTOS} work photos is allowed. Remove an existing photo first`);
  }
  await user.validate();
  if (profile) await profile.validate();
  const oldImage = user.profileImage?.public_id;
  const newAssets = [];
  try {
    const files = [...(avatar ? [{ file: avatar, avatar: true }] : []), ...workPhotos.map((file) => ({ file, avatar: false }))];
    for (const item of files) {
      let result;
      try {
        result = await uploadOnCloudinary(item.file.buffer, {
          folder: item.avatar ? "aturservicett/avatars" : "aturservicett/work-photos",
          resource_type: "image",
          format: "jpg",
          timeout: 120000,
        });
      } catch {
        throw new AppError(502, "Photo could not be uploaded. Please check the image and try again");
      }
      if (result?.public_id) newAssets.push(result.public_id);
      if (!result?.public_id || !result?.secure_url) throw new AppError(502, "Photo upload failed. Please try again");
      const image = { public_id: result.public_id, url: result.secure_url };
      if (item.avatar) user.profileImage = image;
      else profile.workPhotos.push(image);
    }
    await user.db.transaction(async (session) => {
      await user.save({ session });
      if (profile) await profile.save({ session });
    });
  } catch (error) {
    await Promise.all(newAssets.map((id) => deleteFromCloudinary(id)));
    throw error;
  }
  if (avatar && oldImage) await deleteFromCloudinary(oldImage);
};
