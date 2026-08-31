 import AuditLog from "../model/auditLog.model.js";
import Category from "../model/category.model.js";
import PlatformSettings from "../model/platformSettings.model.js";
import { CATEGORY_ICONS, SKILLS } from "../constants/skills.js";

export const slugify = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export const ensureDefaultCategories = async () => {
  const count = await Category.estimatedDocumentCount();
  if (!count) {
    await Category.insertMany(SKILLS.map((name, order) => ({
      name,
      slug: slugify(name),
      icon: CATEGORY_ICONS[name] || "",
      order,
      newUntil: null,
    })));
  }
};

export const getActiveCategoryNames = async () => {
  await ensureDefaultCategories();
  const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).select("name");
  return categories.map((category) => category.name);
};

export const normalizeCategoryIcon = (value) => {
  const icon = String(value || "").trim();
  if (!icon) return "";

  try {
    const url = new URL(icon);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    if (/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D)+$/u.test(icon) && icon.length <= 16) return icon;
    throw new Error("Category icon must be an emoji or a valid HTTPS URL");
  }
};

export const categoryJson = (category) => {
  const value = typeof category.toJSON === "function" ? category.toJSON() : category;
  return {
    ...value,
    isNew: Boolean(value.newUntil && new Date(value.newUntil) > new Date()),
  };
};

export const getPlatformSettings = async () => PlatformSettings.findOneAndUpdate(
  { key: "platform" },
  { $setOnInsert: { key: "platform" } },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);

const redact = (value) => {
  if (!value || typeof value !== "object") return value;
  const clone = JSON.parse(JSON.stringify(value));
  for (const key of ["password", "confirmPassword", "otp", "refreshToken", "accessToken"]) {
    if (key in clone) clone[key] = "[REDACTED]";
  }
  return clone;
};

export const writeAuditLog = async (req, details) => {
  try {
    const actor = req?.user;
    await AuditLog.create({
      actor: actor?._id || null,
      actorName: actor?.name || `${actor?.firstName || ""} ${actor?.lastName || ""}`.trim() || "System",
      actorEmail: actor?.email || "",
      action: details.action,
      entityType: details.entityType,
      entityId: String(details.entityId || ""),
      summary: details.summary || "",
      metadata: redact(details.metadata || {}),
      ip: req?.ip || "",
      userAgent: req?.get?.("user-agent") || "",
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
};
