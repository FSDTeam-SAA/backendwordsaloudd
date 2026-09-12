import httpStatus from "http-status";
import User, { ADMIN_PERMISSIONS } from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import Advertisement from "../model/advertisement.model.js";
import Review from "../model/review.model.js";
import AdInquiry from "../model/adInquiry.model.js";
import Category from "../model/category.model.js";
import AuditLog from "../model/auditLog.model.js";
import AdminInvitation from "../model/adminInvitation.model.js";
import validator from "validator";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { generateOTP } from "../utils/commonMethod.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/commonMethod.js";
import {
  ensureDefaultCategories,
  categoryJson,
  getActiveCategoryNames,
  getPlatformSettings,
  normalizeCategoryIcon,
  slugify,
  writeAuditLog,
} from "../utils/adminHelpers.js";
import { sendAdminInvitation } from "../utils/adminInvitation.js";
import { queryVerificationQueue } from "../utils/verificationQueue.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const bulkIds = (value) => {
  if (!Array.isArray(value) || !value.length || value.length > 100) {
    throw new AppError(httpStatus.BAD_REQUEST, "Select between 1 and 100 records");
  }
  return [...new Set(value.map(String))];
};

const refreshTradesmanRatings = async (profileIds) => {
  for (const profileId of [...new Set(profileIds.map(String))]) {
    const reviews = await Review.find({ tradesman: profileId, $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }] }).select("rating");
    const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
    await TradesmanProfile.findByIdAndUpdate(profileId, {
      ratingAverage: Math.round(average * 10) / 10,
      ratingCount: reviews.length,
    });
  }
};

const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const removeUserData = async (user) => {
  if (user.role === "tradesman") {
    const profile = await TradesmanProfile.findOne({ user: user._id });
    if (profile) await Review.deleteMany({ tradesman: profile._id });
    await TradesmanProfile.deleteOne({ user: user._id });
  }
  if (user.role === "client") {
    const reviews = await Review.find({ reviewer: user._id }).select("tradesman");
    await Review.deleteMany({ reviewer: user._id });
    for (const { tradesman } of reviews) {
      const stats = await Review.aggregate([
        { $match: { tradesman } },
        { $group: { _id: "$tradesman", average: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]);
      await TradesmanProfile.findByIdAndUpdate(tradesman, {
        ratingAverage: Math.round((stats[0]?.average || 0) * 10) / 10,
        ratingCount: stats[0]?.count || 0,
      });
    }
  }
  await user.deleteOne();
};

export const getDashboardOverview = catchAsync(async (req, res) => {
  const [totalUser, totalClient, totalTradesman, totalAdvertisement] =
    await Promise.all([
      User.countDocuments({ role: { $in: ["client", "tradesman"] } }),
      User.countDocuments({ role: "client" }),
      User.countDocuments({ role: "tradesman" }),
      Advertisement.countDocuments({}),
    ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const weekProfiles = await TradesmanProfile.find({ createdAt: { $gte: sevenDaysAgo } }).select("createdAt");
  const dailyTradesmanSignups = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + offset);
    const count = weekProfiles.filter((profile) => {
      const created = new Date(profile.createdAt);
      return created.getFullYear() === date.getFullYear()
        && created.getMonth() === date.getMonth()
        && created.getDate() === date.getDate();
    }).length;
    return { day: WEEKDAYS[date.getDay()], date: date.toISOString().slice(0, 10), count };
  });

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const yearUsers = await User.find({ createdAt: { $gte: startOfYear } }).select(
    "createdAt"
  );

  const registrationByMonth = MONTHS.map((month, idx) => {
    const count = yearUsers.filter(
      (u) => new Date(u.createdAt).getMonth() === idx
    ).length;
    return { month, count };
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard overview fetched",
    data: {
      totalUser,
      totalClient,
      totalTradesman,
      totalAdvertisement,
      dailyTradesmanSignups,
      userRegistrationRate: registrationByMonth,
    },
  });
});

export const getUserList = catchAsync(async (req, res) => {
  const { type = "all", search = "", verificationStatus = "" } = req.query;
  const page = clamp(req.query.page, 1, 100000, 1);
  const limit = clamp(req.query.limit, 1, 100, 20);
  if (["pending", "verified", "rejected"].includes(verificationStatus)) {
    const result = await queryVerificationQueue({ status: verificationStatus, search, page, limit });
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Verification queue fetched",
      data: result.users,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  }
  const userFilter = { role: { $in: ["client", "tradesman"] } };
  if (type === "client") userFilter.role = "client";
  if (type === "tradesman") userFilter.role = "tradesman";

  let profileUserIds = null;
  if (type === "vip") {
    const vipProfiles = await TradesmanProfile.find({
      isVip: true,
      vipBySkill: { $nin: [null, ""] },
    }).select("user");
    profileUserIds = vipProfiles.map((profile) => profile.user);
  }
  const normalizedSearch = String(search).trim();
  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    const skillProfiles = await TradesmanProfile.find({
      $or: [{ mainSkill: regex }, { extraSkills: regex }, { vipBySkill: regex }],
    }).select("user");
    const searchConditions = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phoneNumber: regex },
      { _id: { $in: skillProfiles.map((profile) => profile.user) } },
    ];
    userFilter.$or = searchConditions;
  }

  if (profileUserIds) userFilter._id = { $in: profileUserIds };
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(userFilter),
  ]);

  const profiles = await TradesmanProfile.find({
    user: { $in: users.map((u) => u._id) },
  });
  const profileMap = profiles.reduce((acc, p) => {
    acc[p.user.toString()] = p;
    return acc;
  }, {});

  const results = users.map((u) => ({
    ...u.toJSON(),
    tradesmanProfile: profileMap[u._id.toString()] || null,
  }));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User list fetched",
    data: results,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getVerificationQueue = catchAsync(async (req, res) => {
  const status = String(req.query.status || "pending");
  if (!["pending", "verified", "rejected"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "status must be 'pending', 'verified' or 'rejected'");
  }
  const page = clamp(req.query.page, 1, 100000, 1);
  const limit = clamp(req.query.limit, 1, 100, 20);
  const result = await queryVerificationQueue({
    status,
    search: req.query.search,
    page,
    limit,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Verification queue fetched",
    data: result.users,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  });
});

export const toggleUserBlock = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (["admin", "super-admin"].includes(user.role)) {
    throw new AppError(httpStatus.FORBIDDEN, "Manage administrators from the Admin Management section");
  }

  user.isBlocked = !user.isBlocked;
  await user.save();
  await writeAuditLog(req, {
    action: user.isBlocked ? "user.blocked" : "user.activated",
    entityType: "user",
    entityId: user._id,
    summary: `${user.email} ${user.isBlocked ? "blocked" : "activated"}`,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: user.isBlocked ? "User blocked" : "User activated",
    data: user,
  });
});

export const deleteUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (["admin", "super-admin"].includes(user.role)) {
    throw new AppError(httpStatus.FORBIDDEN, "Administrator accounts cannot be deleted from the user list");
  }

  await removeUserData(user);
  await writeAuditLog(req, {
    action: "user.deleted",
    entityType: "user",
    entityId: user._id,
    summary: `${user.email} deleted`,
    metadata: { role: user.role },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User deleted",
  });
});

export const addVipMember = catchAsync(async (req, res) => {
  const {
    userId,
    firstName,
    lastName,
    email,
    phoneNumber,
    homeArea,
    travelRange,
    pitch,
    rateAmount,
    rateUnit,
    mainSkill,
    vipBySkill,
  } = req.body;

  let user;

  if (userId) {
    user = await User.findById(userId);
    if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  } else {
    if (!firstName || !lastName || !email || !phoneNumber) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "firstName, lastName, email and phoneNumber are required to create a new VIP member"
      );
    }
    const randomPassword = generateOTP(8);
    user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      phoneNumber,
      password: randomPassword,
      role: "tradesman",
      isEmailVerified: true,
    });
  }

  let profile = await TradesmanProfile.findOne({ user: user._id });
  if (!profile) {
    if (!mainSkill) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "mainSkill is required when this user has no tradesman profile yet"
      );
    }
    profile = new TradesmanProfile({ user: user._id, mainSkill });
  }

  const activeCategories = await getActiveCategoryNames();
  const selectedSkill = String(vipBySkill || "").trim();
  const profileSkills = [...new Set([profile.mainSkill, ...(profile.extraSkills || [])].filter(Boolean))];
  if (!selectedSkill) {
    throw new AppError(httpStatus.BAD_REQUEST, "vipBySkill is required");
  }
  if (!activeCategories.includes(selectedSkill) || !profileSkills.includes(selectedSkill)) {
    throw new AppError(httpStatus.BAD_REQUEST, "VIP skill must be an active main or extra skill for this tradesman");
  }
  const settings = await getPlatformSettings();
  const existingVipCount = await TradesmanProfile.countDocuments({
    _id: { $ne: profile._id },
    isVip: true,
    vipBySkill: selectedSkill,
  });
  if (existingVipCount >= settings.vipSlotsPerCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, `The VIP limit for ${selectedSkill} has been reached`);
  }

  profile.vipBySkill = selectedSkill;
  if (homeArea) profile.homeArea = homeArea;
  if (travelRange) profile.travelRange = travelRange;
  if (pitch !== undefined) profile.pitch = pitch;
  if (rateAmount !== undefined) profile.typicalRate.amount = Number(rateAmount);
  if (rateUnit) profile.typicalRate.unit = rateUnit;

  profile.isVip = true;
  profile.isLive = true;
  profile.verificationStatus = "verified";

  await profile.save();
  await writeAuditLog(req, {
    action: "vip.granted",
    entityType: "tradesman",
    entityId: profile._id,
    summary: `VIP status granted to ${user.email}`,
    metadata: { vipBySkill: selectedSkill },
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "VIP member created",
    data: { user, profile },
  });
});

const parseCategories = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
};

const validateUrl = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, "Target URL must be a valid HTTP or HTTPS URL");
  }
};

const uploadAdvertisementMedia = async (file) => {
  if (!file) return null;
  const isImage = ["image/jpeg", "image/png"].includes(file.mimetype);
  const isVideo = file.mimetype === "video/mp4";
  if (!isImage && !isVideo) {
    throw new AppError(httpStatus.BAD_REQUEST, "Advertisement media must be JPG, PNG, or MP4");
  }
  let result;
  try {
    result = await uploadOnCloudinary(file.buffer, {
      folder: "aturservicett/advertisements",
      resource_type: isVideo ? "video" : "image",
    });
  } catch {
    throw new AppError(httpStatus.BAD_GATEWAY, "Advertisement media could not be uploaded. Please try again");
  }
  if (isImage && (result.width < 600 || result.height < 338 || Math.abs(result.width / result.height - 16 / 9) > 0.03)) {
    await deleteFromCloudinary(result.public_id, "image");
    throw new AppError(httpStatus.BAD_REQUEST, "Image must be at least 600×338 pixels and use a 16:9 aspect ratio");
  }
  if (isVideo && Number(result.duration || 0) > 15) {
    await deleteFromCloudinary(result.public_id, "video");
    throw new AppError(httpStatus.BAD_REQUEST, "Video must be 15 seconds or shorter");
  }
  return {
    mediaType: isVideo ? "video" : "image",
    public_id: result.public_id,
    url: result.secure_url,
    width: result.width || 0,
    height: result.height || 0,
    duration: result.duration || 0,
  };
};

export const createAdvertisement = catchAsync(async (req, res) => {
  const { title, description, startDate, endDate, advertiserName, advertiserEmail, advertiserPhone } = req.body;
  if (!title || !description) {
    throw new AppError(httpStatus.BAD_REQUEST, "Title and description are required");
  }

  const categories = parseCategories(req.body.categories);
  const activeCategories = await getActiveCategoryNames();
  if (categories.some((category) => !activeCategories.includes(category))) {
    throw new AppError(httpStatus.BAD_REQUEST, "One or more advertisement categories are invalid");
  }
  const parsedStart = startDate ? new Date(startDate) : new Date();
  const parsedEnd = endDate ? new Date(endDate) : null;
  if (Number.isNaN(parsedStart.getTime()) || (parsedEnd && Number.isNaN(parsedEnd.getTime()))) {
    throw new AppError(httpStatus.BAD_REQUEST, "Advertisement dates are invalid");
  }
  if (parsedEnd && parsedEnd <= parsedStart) {
    throw new AppError(httpStatus.BAD_REQUEST, "End date must be after the start date");
  }
  const media = await uploadAdvertisementMedia(req.file);
  if (!media) throw new AppError(httpStatus.BAD_REQUEST, "An advertisement image or MP4 video is required");
  let ad;
  try {
    ad = await Advertisement.create({
      title,
      description,
      createdBy: req.user._id,
      media,
      targetUrl: validateUrl(req.body.targetUrl),
      categories,
      startDate: parsedStart,
      endDate: parsedEnd,
      priority: clamp(req.body.priority, 0, 1000, 0),
      advertiser: { name: advertiserName || "", email: advertiserEmail || "", phone: advertiserPhone || "" },
    });
  } catch (error) {
    await deleteFromCloudinary(media.public_id, media.mediaType);
    throw error;
  }
  await writeAuditLog(req, { action: "advertisement.created", entityType: "advertisement", entityId: ad._id, summary: ad.title });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Advertisement created",
    data: ad,
  });
});

export const getAdvertisements = catchAsync(async (req, res) => {
  const publicRequest = req.query.activeOnly === "true";
  const now = new Date();
  const filter = publicRequest
    ? {
        isActive: true,
        startDate: { $lte: now },
        $and: [
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
          ...(req.query.category ? [{ $or: [{ categories: { $size: 0 } }, { categories: req.query.category }] }] : []),
        ],
      }
    : {};
  let query = Advertisement.find(filter).sort({ priority: -1, createdAt: -1 });
  if (publicRequest) query = query.select("-advertiser -createdBy");
  let ads = await query;
  if (publicRequest && ads.length > 1) {
    const settings = await getPlatformSettings();
    if (settings.sponsoredRotation === "random") ads = [...ads].sort(() => Math.random() - 0.5);
    if (settings.sponsoredRotation === "round-robin") {
      const offset = Math.floor(Date.now() / 86400000) % ads.length;
      ads = [...ads.slice(offset), ...ads.slice(0, offset)];
    }
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Advertisements fetched",
    data: ads,
  });
});

export const updateAdvertisement = catchAsync(async (req, res) => {
  const { title, description, isActive, startDate, endDate, advertiserName, advertiserEmail, advertiserPhone } = req.body;

  const ad = await Advertisement.findById(req.params.id);
  if (!ad) throw new AppError(httpStatus.NOT_FOUND, "Advertisement not found");

  if (title) ad.title = title;
  if (description) ad.description = description;
  if (isActive !== undefined) ad.isActive = isActive;
  if (req.body.targetUrl !== undefined) ad.targetUrl = validateUrl(req.body.targetUrl);
  if (req.body.categories !== undefined) {
    const categories = parseCategories(req.body.categories);
    const activeCategories = await getActiveCategoryNames();
    if (categories.some((category) => !activeCategories.includes(category))) {
      throw new AppError(httpStatus.BAD_REQUEST, "One or more advertisement categories are invalid");
    }
    ad.categories = categories;
  }
  if (startDate) ad.startDate = new Date(startDate);
  if (endDate !== undefined) ad.endDate = endDate ? new Date(endDate) : null;
  if (ad.endDate && ad.endDate <= ad.startDate) throw new AppError(httpStatus.BAD_REQUEST, "End date must be after the start date");
  if (req.body.priority !== undefined) ad.priority = clamp(req.body.priority, 0, 1000, 0);
  if ([advertiserName, advertiserEmail, advertiserPhone].some((value) => value !== undefined)) {
    ad.advertiser = {
      name: advertiserName ?? ad.advertiser?.name ?? "",
      email: advertiserEmail ?? ad.advertiser?.email ?? "",
      phone: advertiserPhone ?? ad.advertiser?.phone ?? "",
    };
  }
  const newMedia = await uploadAdvertisementMedia(req.file);
  if (newMedia) {
    if (ad.media?.public_id) await deleteFromCloudinary(ad.media.public_id, ad.media.mediaType);
    ad.media = newMedia;
  }

  await ad.save();
  await writeAuditLog(req, { action: "advertisement.updated", entityType: "advertisement", entityId: ad._id, summary: ad.title });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Advertisement updated",
    data: ad,
  });
});

export const deleteAdvertisement = catchAsync(async (req, res) => {
  const ad = await Advertisement.findByIdAndDelete(req.params.id);
  if (!ad) throw new AppError(httpStatus.NOT_FOUND, "Advertisement not found");
  if (ad.media?.public_id) await deleteFromCloudinary(ad.media.public_id, ad.media.mediaType);
  await writeAuditLog(req, { action: "advertisement.deleted", entityType: "advertisement", entityId: ad._id, summary: ad.title });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Advertisement deleted",
  });
});

export const updateVerificationStatus = catchAsync(async (req, res) => {
  const { status, reason = "" } = req.body;

  if (!["verified", "rejected"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "status must be 'verified' or 'rejected'");
  }

  const profile = await TradesmanProfile.findById(req.params.id);
  if (!profile) throw new AppError(httpStatus.NOT_FOUND, "Tradesman profile not found");

  profile.verificationStatus = status;
  profile.verification = {
    ...profile.verification?.toObject?.(),
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    rejectionReason: status === "rejected" ? String(reason).trim() : "",
    submittedAt: profile.verification?.submittedAt || profile.createdAt,
  };
  if (status === "rejected" && !String(reason).trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "A rejection reason is required");
  }
  if (status === "rejected") profile.isLive = false;

  await profile.save();
  await writeAuditLog(req, {
    action: `tradesman.${status}`,
    entityType: "tradesman",
    entityId: profile._id,
    summary: `Tradesman ${status}`,
    metadata: { reason: status === "rejected" ? String(reason).trim() : "" },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Tradesman ${status}`,
    data: profile,
  });
});

export const bulkDeleteAdvertisements = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const ads = await Advertisement.find({ _id: { $in: ids } });
  await Advertisement.deleteMany({ _id: { $in: ads.map((ad) => ad._id) } });
  await Promise.all(ads.filter((ad) => ad.media?.public_id).map((ad) => deleteFromCloudinary(ad.media.public_id, ad.media.mediaType)));
  await writeAuditLog(req, { action: "advertisement.bulk-deleted", entityType: "advertisement", summary: `${ads.length} advertisements deleted`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${ads.length} advertisements deleted`, data: { affected: ads.length } });
});

export const bulkUserAction = catchAsync(async (req, res) => {
  const { ids, action, reason = "" } = req.body;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) {
    throw new AppError(httpStatus.BAD_REQUEST, "Select between 1 and 100 records");
  }
  if (!["verify", "reject", "block", "unblock", "delete"].includes(action)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid bulk action");
  }
  if (action === "reject" && !String(reason).trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "A rejection reason is required");
  }

  let affected = 0;
  if (["verify", "reject"].includes(action)) {
    const status = action === "verify" ? "verified" : "rejected";
    const result = await TradesmanProfile.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          verificationStatus: status,
          ...(status === "rejected" ? { isLive: false } : {}),
          "verification.reviewedBy": req.user._id,
          "verification.reviewedAt": new Date(),
          "verification.rejectionReason": status === "rejected" ? String(reason).trim() : "",
        },
      }
    );
    affected = result.modifiedCount;
  } else if (["block", "unblock"].includes(action)) {
    const result = await User.updateMany(
      { _id: { $in: ids }, role: { $in: ["client", "tradesman"] } },
      { $set: { isBlocked: action === "block" } }
    );
    affected = result.modifiedCount;
  } else {
    const users = await User.find({ _id: { $in: ids }, role: { $in: ["client", "tradesman"] } });
    for (const user of users) await removeUserData(user);
    affected = users.length;
  }
  await writeAuditLog(req, {
    action: `bulk.${action}`,
    entityType: "user",
    summary: `${affected} records affected`,
    metadata: { ids, reason: String(reason).trim() },
  });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${affected} records updated`, data: { affected } });
});

export const exportUsersCsv = catchAsync(async (req, res) => {
  const type = req.query.type || "all";
  const search = String(req.query.search || "").trim();
  const filter = { role: { $in: ["client", "tradesman"] } };
  if (type === "client") filter.role = "client";
  if (type === "tradesman") filter.role = "tradesman";
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { phoneNumber: regex }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).lean();
  const profiles = await TradesmanProfile.find({ user: { $in: users.map((user) => user._id) } }).lean();
  const profileMap = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const headers = ["User ID", "First Name", "Last Name", "Email", "Phone", "Role", "Area", "Blocked", "Email Verified", "Joined", "Main Skill", "VIP Skill", "Verification", "VIP", "Live", "Rating"];
  const rows = users.map((user) => {
    const profile = profileMap.get(String(user._id));
    return [user._id, user.firstName, user.lastName, user.email, user.phoneNumber, user.role, user.area, user.isBlocked, user.isEmailVerified, user.createdAt?.toISOString(), profile?.mainSkill, profile?.vipBySkill || "", profile?.verificationStatus, profile?.isVip, profile?.isLive, profile?.ratingAverage].map(csvCell).join(",");
  });
  await writeAuditLog(req, { action: "users.exported", entityType: "user", summary: `${users.length} users exported`, metadata: { type, search } });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(httpStatus.OK).send(`\uFEFF${headers.map(csvCell).join(",")}\n${rows.join("\n")}`);
});

export const exportReviewsCsv = catchAsync(async (req, res) => {
  const reviews = await Review.find()
    .populate("reviewer", "firstName lastName email")
    .populate({ path: "tradesman", populate: { path: "user", select: "firstName lastName email" } })
    .sort({ createdAt: -1 });
  const headers = ["Review ID", "Reviewer", "Reviewer Email", "Tradesman", "Tradesman Email", "Rating", "Label", "Review", "Moderation Status", "Created"];
  const rows = reviews.map((review) => [
    review._id,
    `${review.reviewer?.firstName || ""} ${review.reviewer?.lastName || ""}`.trim(),
    review.reviewer?.email,
    `${review.tradesman?.user?.firstName || ""} ${review.tradesman?.user?.lastName || ""}`.trim(),
    review.tradesman?.user?.email,
    review.rating,
    review.ratingLabel,
    review.reviewText,
    review.moderationStatus || "approved",
    review.createdAt?.toISOString(),
  ].map(csvCell).join(","));
  await writeAuditLog(req, { action: "reviews.exported", entityType: "review", summary: `${reviews.length} reviews exported` });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="reviews-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(httpStatus.OK).send(`\uFEFF${headers.map(csvCell).join(",")}\n${rows.join("\n")}`);
});

export const getCategoriesAdmin = catchAsync(async (req, res) => {
  await ensureDefaultCategories();
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;
  const page = clamp(req.query.page, 1, 100000, 1);
  const limit = clamp(req.query.limit, 1, 100, 10);
  const [categories, counts, vipCounts, total] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }).skip(paginated ? (page - 1) * limit : 0).limit(paginated ? limit : 0),
    TradesmanProfile.aggregate([{ $group: { _id: "$mainSkill", count: { $sum: 1 } } }]),
    TradesmanProfile.aggregate([
      { $match: { isVip: true, vipBySkill: { $nin: [null, ""] } } },
      { $group: { _id: "$vipBySkill", count: { $sum: 1 } } },
    ]),
    Category.countDocuments(),
  ]);
  const countMap = new Map(counts.map((item) => [item._id, item.count]));
  const vipCountMap = new Map(vipCounts.map((item) => [item._id, item.count]));
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Categories fetched", data: categories.map((category) => ({ ...categoryJson(category), tradesmanCount: countMap.get(category.name) || 0, vipCount: vipCountMap.get(category.name) || 0 })), ...(paginated ? { meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } } : {}) });
});

export const createCategory = catchAsync(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
  if (await Category.exists({ $or: [{ name }, { slug: slugify(name) }] })) {
    throw new AppError(httpStatus.CONFLICT, "A category with this name already exists");
  }
  let icon;
  try {
    icon = normalizeCategoryIcon(req.body.icon);
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, error.message);
  }
  await Category.updateMany({}, { $inc: { order: 1 } });
  const category = await Category.create({
    name,
    slug: slugify(name),
    icon,
    order: 0,
    isActive: req.body.isActive !== false,
    newUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await writeAuditLog(req, { action: "category.created", entityType: "category", entityId: category._id, summary: category.name });
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Category created", data: categoryJson(category) });
});

export const updateCategory = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  const previousName = category.name;
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
    category.name = name;
    category.slug = slugify(name);
  }
  if (req.body.icon !== undefined) {
    try {
      category.icon = normalizeCategoryIcon(req.body.icon);
    } catch (error) {
      throw new AppError(httpStatus.BAD_REQUEST, error.message);
    }
  }
  if (req.body.order !== undefined) {
    const total = await Category.countDocuments();
    const nextOrder = clamp(req.body.order, 0, Math.max(0, total - 1), category.order);
    if (nextOrder < category.order) {
      await Category.updateMany(
        { _id: { $ne: category._id }, order: { $gte: nextOrder, $lt: category.order } },
        { $inc: { order: 1 } },
      );
    } else if (nextOrder > category.order) {
      await Category.updateMany(
        { _id: { $ne: category._id }, order: { $gt: category.order, $lte: nextOrder } },
        { $inc: { order: -1 } },
      );
    }
    category.order = nextOrder;
  }
  if (typeof req.body.isActive === "boolean") category.isActive = req.body.isActive;
  await category.save();
  if (previousName !== category.name) {
    await Promise.all([
      TradesmanProfile.updateMany({ mainSkill: previousName }, { $set: { mainSkill: category.name } }),
      TradesmanProfile.updateMany({ extraSkills: previousName }, { $set: { "extraSkills.$[skill]": category.name } }, { arrayFilters: [{ skill: previousName }] }),
      TradesmanProfile.updateMany({ vipBySkill: previousName }, { $set: { vipBySkill: category.name } }),
      Advertisement.updateMany({ categories: previousName }, { $set: { "categories.$[category]": category.name } }, { arrayFilters: [{ category: previousName }] }),
    ]);
  }
  await writeAuditLog(req, { action: "category.updated", entityType: "category", entityId: category._id, summary: category.name, metadata: { previousName } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Category updated", data: categoryJson(category) });
});

const removeCategories = async (ids) => {
  const categories = await Category.find({ _id: { $in: ids } });
  if (!categories.length) return [];
  const total = await Category.countDocuments();
  if (categories.length >= total) throw new AppError(httpStatus.BAD_REQUEST, "At least one category must remain");
  const names = categories.map((category) => category.name);
  const [mainSkillsInUse, vipSkillsInUse] = await Promise.all([
    TradesmanProfile.distinct("mainSkill", { mainSkill: { $in: names } }),
    TradesmanProfile.distinct("vipBySkill", { isVip: true, vipBySkill: { $in: names } }),
  ]);
  const inUse = [...new Set([...mainSkillsInUse, ...vipSkillsInUse])];
  if (inUse.length) throw new AppError(httpStatus.CONFLICT, `Deactivate categories used by tradesmen instead: ${inUse.join(", ")}`);
  await Promise.all([
    Category.deleteMany({ _id: { $in: categories.map((category) => category._id) } }),
    TradesmanProfile.updateMany({}, { $pull: { extraSkills: { $in: names } } }),
    Advertisement.updateMany({}, { $pull: { categories: { $in: names } } }),
  ]);
  const remaining = await Category.find().sort({ order: 1, name: 1 }).select("_id");
  await Promise.all(remaining.map((category, order) => Category.updateOne({ _id: category._id }, { $set: { order } })));
  return categories;
};

export const deleteCategory = catchAsync(async (req, res) => {
  const categories = await removeCategories([req.params.id]);
  if (!categories.length) throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  await writeAuditLog(req, { action: "category.deleted", entityType: "category", entityId: categories[0]._id, summary: categories[0].name });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Category deleted", data: { affected: 1 } });
});

export const bulkDeleteCategories = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const categories = await removeCategories(ids);
  await writeAuditLog(req, { action: "category.bulk-deleted", entityType: "category", summary: `${categories.length} categories deleted`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${categories.length} categories deleted`, data: { affected: categories.length } });
});

export const getSettingsAdmin = catchAsync(async (req, res) => {
  const settings = await getPlatformSettings();
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Platform settings fetched", data: settings });
});

export const updateSettingsAdmin = catchAsync(async (req, res) => {
  const settings = await getPlatformSettings();
  if (req.body.vipSlotsPerCategory !== undefined) settings.vipSlotsPerCategory = clamp(req.body.vipSlotsPerCategory, 1, 20, settings.vipSlotsPerCategory);
  if (req.body.sponsoredRotation !== undefined) settings.sponsoredRotation = req.body.sponsoredRotation;
  if (req.body.reviewModerationMode !== undefined) settings.reviewModerationMode = req.body.reviewModerationMode;
  settings.updatedBy = req.user._id;
  await settings.save();
  await writeAuditLog(req, { action: "settings.updated", entityType: "settings", entityId: settings._id, summary: "Platform settings updated", metadata: req.body });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Platform settings updated", data: settings });
});

export const getAuditLogs = catchAsync(async (req, res) => {
  const page = clamp(req.query.page, 1, 100000, 1);
  const limit = clamp(req.query.limit, 1, 100, 20);
  const filter = {};
  if (req.query.action) filter.action = new RegExp(escapeRegex(req.query.action), "i");
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ actorName: regex }, { actorEmail: regex }, { summary: regex }, { entityId: regex }];
  }
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Audit logs fetched", data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const deleteAuditLog = catchAsync(async (req, res) => {
  const log = await AuditLog.findByIdAndDelete(req.params.id);
  if (!log) throw new AppError(httpStatus.NOT_FOUND, "Audit entry not found");
  await writeAuditLog(req, { action: "audit-log.deleted", entityType: "audit-log", entityId: log._id, summary: "Audit entry deleted" });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Audit entry deleted", data: { affected: 1 } });
});

export const bulkDeleteAuditLogs = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const result = await AuditLog.deleteMany({ _id: { $in: ids } });
  await writeAuditLog(req, { action: "audit-log.bulk-deleted", entityType: "audit-log", summary: `${result.deletedCount} audit entries deleted`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${result.deletedCount} audit entries deleted`, data: { affected: result.deletedCount } });
});

export const getNotifications = catchAsync(async (req, res) => {
  const [verificationQueue, newInquiries, pendingReviews] = await Promise.all([
    queryVerificationQueue({ status: "pending", page: 1, limit: 5 }),
    AdInquiry.countDocuments({ status: "new" }),
    Review.countDocuments({ moderationStatus: "pending" }),
  ]);
  const items = verificationQueue.users.map((user) => ({
    id: String(user.tradesmanProfile._id),
    type: "verification",
    title: "Tradesman awaiting verification",
    message: user.name || user.email || "Tradesman",
    createdAt: user.tradesmanProfile.verification?.submittedAt || user.tradesmanProfile.updatedAt,
    href: "/verification",
  }));
  if (pendingReviews) items.push({ id: "pending-reviews", type: "review", title: "Reviews awaiting moderation", message: `${pendingReviews} pending review${pendingReviews === 1 ? "" : "s"}`, createdAt: new Date(), href: "/reviews" });
  if (newInquiries) items.push({ id: "new-inquiries", type: "inquiry", title: "New advertiser inquiries", message: `${newInquiries} new advertiser inquir${newInquiries === 1 ? "y" : "ies"}`, createdAt: new Date(), href: "/advertisements" });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Notifications fetched", data: { unreadCount: verificationQueue.total + newInquiries + pendingReviews, counts: { verification: verificationQueue.total, inquiries: newInquiries, reviews: pendingReviews }, items } });
});

export const getReviewsAdmin = catchAsync(async (req, res) => {
  const page = clamp(req.query.page, 1, 100000, 1);
  const limit = clamp(req.query.limit, 1, 100, 20);
  const filter = {};
  if (req.query.status === "approved") filter.$or = [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }];
  else if (["pending", "rejected"].includes(req.query.status)) filter.moderationStatus = req.query.status;
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate("reviewer", "firstName lastName email").populate({ path: "tradesman", populate: { path: "user", select: "firstName lastName email" } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
  ]);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Reviews fetched", data: reviews, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

export const moderateReview = catchAsync(async (req, res) => {
  const { status, note = "" } = req.body;
  if (!["approved", "rejected"].includes(status)) throw new AppError(httpStatus.BAD_REQUEST, "Review status must be approved or rejected");
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  review.moderationStatus = status;
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  review.moderationNote = String(note).trim();
  await review.save();
  const stats = await Review.aggregate([{ $match: { tradesman: review.tradesman, $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }] } }, { $group: { _id: "$tradesman", average: { $avg: "$rating" }, count: { $sum: 1 } } }]);
  await TradesmanProfile.findByIdAndUpdate(review.tradesman, { ratingAverage: Math.round((stats[0]?.average || 0) * 10) / 10, ratingCount: stats[0]?.count || 0 });
  await writeAuditLog(req, { action: `review.${status}`, entityType: "review", entityId: review._id, summary: `Review ${status}`, metadata: { note } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `Review ${status}`, data: review });
});

export const deleteReviewAdmin = catchAsync(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  await refreshTradesmanRatings([review.tradesman]);
  await writeAuditLog(req, { action: "review.deleted", entityType: "review", entityId: review._id, summary: "Review deleted" });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Review deleted", data: { affected: 1 } });
});

export const bulkDeleteReviews = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const reviews = await Review.find({ _id: { $in: ids } }).select("tradesman");
  const result = await Review.deleteMany({ _id: { $in: reviews.map((review) => review._id) } });
  await refreshTradesmanRatings(reviews.map((review) => review.tradesman));
  await writeAuditLog(req, { action: "review.bulk-deleted", entityType: "review", summary: `${result.deletedCount} reviews deleted`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${result.deletedCount} reviews deleted`, data: { affected: result.deletedCount } });
});

export const getAdInquiriesAdmin = catchAsync(async (req, res) => {
  const inquiries = await AdInquiry.find().sort({ createdAt: -1 });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Advertiser inquiries fetched", data: inquiries });
});

export const updateAdInquiry = catchAsync(async (req, res) => {
  if (!["new", "contacted", "closed"].includes(req.body.status)) throw new AppError(httpStatus.BAD_REQUEST, "Invalid inquiry status");
  const inquiry = await AdInquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!inquiry) throw new AppError(httpStatus.NOT_FOUND, "Inquiry not found");
  await writeAuditLog(req, { action: "inquiry.updated", entityType: "inquiry", entityId: inquiry._id, summary: `${inquiry.businessName}: ${inquiry.status}` });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Inquiry updated", data: inquiry });
});

export const deleteAdInquiry = catchAsync(async (req, res) => {
  const inquiry = await AdInquiry.findByIdAndDelete(req.params.id);
  if (!inquiry) throw new AppError(httpStatus.NOT_FOUND, "Inquiry not found");
  await writeAuditLog(req, { action: "inquiry.deleted", entityType: "inquiry", entityId: inquiry._id, summary: inquiry.businessName });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Inquiry deleted", data: { affected: 1 } });
});

export const bulkDeleteAdInquiries = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const result = await AdInquiry.deleteMany({ _id: { $in: ids } });
  await writeAuditLog(req, { action: "inquiry.bulk-deleted", entityType: "inquiry", summary: `${result.deletedCount} inquiries deleted`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${result.deletedCount} inquiries deleted`, data: { affected: result.deletedCount } });
});

const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new AppError(httpStatus.BAD_REQUEST, "permissions must be an array");
  }

  const uniquePermissions = [...new Set(permissions)];
  if (uniquePermissions.some((permission) => !ADMIN_PERMISSIONS.includes(permission))) {
    throw new AppError(httpStatus.BAD_REQUEST, "One or more permissions are invalid");
  }
  return uniquePermissions;
};

export const getAdminList = catchAsync(async (req, res) => {
  const admins = await User.find({ role: { $in: ["admin", "super-admin"] } })
    .select("firstName lastName email phoneNumber role adminPermissions isBlocked createdAt updatedAt")
    .sort({ role: -1, createdAt: 1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Administrator list fetched",
    data: admins,
  });
});

export const createAdmin = catchAsync(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!validator.isEmail(email)) {
    throw new AppError(httpStatus.BAD_REQUEST, "A valid administrator email is required");
  }
  if (await User.exists({ email })) {
    throw new AppError(httpStatus.CONFLICT, "An account already exists for this email");
  }

  let invitation = await AdminInvitation.findOne({ email }).select("+tokenHash");
  if (!invitation) {
    invitation = new AdminInvitation({
      email,
      invitedBy: req.user._id,
      role: "admin",
      permissions: ["dashboard"],
      tokenHash: "pending",
      expiresAt: new Date(),
    });
  } else {
    invitation.invitedBy = req.user._id;
    invitation.role = "admin";
    invitation.permissions = ["dashboard"];
  }
  const delivery = await sendAdminInvitation(invitation);
  await writeAuditLog(req, {
    action: "administrator.invited",
    entityType: "admin-invitation",
    entityId: invitation._id,
    summary: `${email} invited`,
    metadata: { expiresAt: invitation.expiresAt },
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Administrator invitation sent",
    data: {
      _id: invitation._id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      ...(process.env.NODE_ENV === "production" ? {} : { acceptUrl: delivery.acceptUrl }),
    },
  });
});

export const getAdminInvitations = catchAsync(async (req, res) => {
  await AdminInvitation.updateMany(
    { status: "pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } },
  );
  const invitations = await AdminInvitation.find({ status: { $in: ["pending", "expired"] } })
    .select("email status expiresAt invitedBy createdAt updatedAt")
    .populate("invitedBy", "firstName lastName email")
    .sort({ createdAt: -1 });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Administrator invitations fetched",
    data: invitations,
  });
});

export const resendAdminInvitation = catchAsync(async (req, res) => {
  const invitation = await AdminInvitation.findById(req.params.invitationId).select("+tokenHash");
  if (!invitation || invitation.status === "accepted") {
    throw new AppError(httpStatus.NOT_FOUND, "Administrator invitation not found");
  }
  if (await User.exists({ email: invitation.email })) {
    throw new AppError(httpStatus.CONFLICT, "An account already exists for this email");
  }
  invitation.invitedBy = req.user._id;
  const delivery = await sendAdminInvitation(invitation);
  await writeAuditLog(req, {
    action: "administrator.invitation.resent",
    entityType: "admin-invitation",
    entityId: invitation._id,
    summary: invitation.email,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Administrator invitation resent",
    data: {
      _id: invitation._id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      ...(process.env.NODE_ENV === "production" ? {} : { acceptUrl: delivery.acceptUrl }),
    },
  });
});

export const revokeAdminInvitation = catchAsync(async (req, res) => {
  const invitation = await AdminInvitation.findOneAndUpdate(
    { _id: req.params.invitationId, status: { $ne: "accepted" } },
    { $set: { status: "revoked" } },
    { new: true },
  );
  if (!invitation) throw new AppError(httpStatus.NOT_FOUND, "Administrator invitation not found");
  await writeAuditLog(req, {
    action: "administrator.invitation.revoked",
    entityType: "admin-invitation",
    entityId: invitation._id,
    summary: invitation.email,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Administrator invitation revoked",
    data: invitation,
  });
});

export const bulkRevokeAdminInvitations = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const result = await AdminInvitation.updateMany(
    { _id: { $in: ids }, status: { $ne: "accepted" } },
    { $set: { status: "revoked" } },
  );
  await writeAuditLog(req, { action: "administrator.invitation.bulk-revoked", entityType: "admin-invitation", summary: `${result.modifiedCount} invitations revoked`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${result.modifiedCount} invitations revoked`, data: { affected: result.modifiedCount } });
});

export const deleteAdmin = catchAsync(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.adminId, role: "admin" });
  if (!admin) throw new AppError(httpStatus.NOT_FOUND, "Deletable administrator not found");
  if (admin._id.equals(req.user._id)) throw new AppError(httpStatus.BAD_REQUEST, "You cannot delete your own account");
  await admin.deleteOne();
  await writeAuditLog(req, { action: "administrator.deleted", entityType: "administrator", entityId: admin._id, summary: admin.email });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Administrator deleted", data: { affected: 1 } });
});

export const bulkDeleteAdmins = catchAsync(async (req, res) => {
  const ids = bulkIds(req.body.ids);
  const result = await User.deleteMany({ _id: { $in: ids, $ne: req.user._id }, role: "admin" });
  await writeAuditLog(req, { action: "administrator.bulk-deleted", entityType: "administrator", summary: `${result.deletedCount} administrators deleted`, metadata: { ids } });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: `${result.deletedCount} administrators deleted`, data: { affected: result.deletedCount } });
});

export const updateAdmin = catchAsync(async (req, res) => {
  const admin = await User.findOne({
    _id: req.params.adminId,
    role: { $in: ["admin", "super-admin"] },
  });
  if (!admin) throw new AppError(httpStatus.NOT_FOUND, "Administrator not found");

  const nextRole = req.body.role ?? admin.role;
  if (!["admin", "super-admin"].includes(nextRole)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid administrator role");
  }

  const revokesSuperAdmin = admin.role === "super-admin" && !admin.isBlocked && (
    nextRole !== "super-admin" || req.body.isBlocked === true
  );
  if (revokesSuperAdmin) {
    const activeSuperAdmins = await User.countDocuments({ role: "super-admin", isBlocked: false });
    if (activeSuperAdmins <= 1) {
      throw new AppError(httpStatus.BAD_REQUEST, "At least one active super-admin is required");
    }
  }

  if (admin._id.equals(req.user._id) && req.body.isBlocked === true) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot revoke your own access");
  }
  if (admin._id.equals(req.user._id) && nextRole !== "super-admin") {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot remove your own super-admin role");
  }

  admin.role = nextRole;
  admin.adminPermissions = nextRole === "super-admin"
    ? ADMIN_PERMISSIONS
    : normalizePermissions(req.body.permissions ?? admin.adminPermissions);
  if (typeof req.body.isBlocked === "boolean") admin.isBlocked = req.body.isBlocked;
  await admin.save();
  await writeAuditLog(req, { action: admin.isBlocked ? "administrator.revoked" : "administrator.updated", entityType: "administrator", entityId: admin._id, summary: admin.email, metadata: { role: admin.role, permissions: admin.adminPermissions } });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: admin.isBlocked ? "Administrator access revoked" : "Administrator updated",
    data: admin,
  });
});

