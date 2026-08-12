import httpStatus from "http-status";
import User, { ADMIN_PERMISSIONS } from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import Advertisement from "../model/advertisement.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { generateOTP } from "../utils/commonMethod.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export const getDashboardOverview = catchAsync(async (req, res) => {
  const [totalUser, totalClient, totalTradesman, totalAdvertisement] =
    await Promise.all([
      User.countDocuments({ role: { $in: ["client", "tradesman"] } }),
      User.countDocuments({ role: "client" }),
      User.countDocuments({ role: "tradesman" }),
      Advertisement.countDocuments({}),
    ]);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekProfiles = await TradesmanProfile.find({
    createdAt: { $gte: startOfWeek },
  });

  const occupancyByDay = WEEKDAYS.map((day, idx) => {
    const dayProfiles = weekProfiles.filter(
      (p) => new Date(p.createdAt).getDay() === idx
    );
    const live = dayProfiles.filter((p) => p.isLive).length;
    const rate = dayProfiles.length
      ? Math.round((live / dayProfiles.length) * 100)
      : 0;
    return { day, rate };
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
      monthlyOccupancyRate: occupancyByDay,
      userRegistrationRate: registrationByMonth,
    },
  });
});

export const getUserList = catchAsync(async (req, res) => {
  const { type = "all", page = 1, limit = 20 } = req.query;

  let userFilter = { role: { $in: ["client", "tradesman"] } };
  if (type === "client") userFilter.role = "client";
  if (type === "tradesman") userFilter.role = "tradesman";

  let userIds = null;
  if (type === "vip") {
    const vipProfiles = await TradesmanProfile.find({ isVip: true }).select("user");
    userIds = vipProfiles.map((p) => p.user);
    userFilter._id = { $in: userIds };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
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
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
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

  await TradesmanProfile.findOneAndDelete({ user: user._id });
  await user.deleteOne();

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

  if (mainSkill) profile.mainSkill = mainSkill;
  if (homeArea) profile.homeArea = homeArea;
  if (travelRange) profile.travelRange = travelRange;
  if (pitch !== undefined) profile.pitch = pitch;
  if (rateAmount !== undefined) profile.typicalRate.amount = Number(rateAmount);
  if (rateUnit) profile.typicalRate.unit = rateUnit;

  profile.isVip = true;
  profile.isLive = true;
  profile.verificationStatus = "verified";

  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "VIP member created",
    data: { user, profile },
  });
});

export const createAdvertisement = catchAsync(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    throw new AppError(httpStatus.BAD_REQUEST, "Title and description are required");
  }

  const ad = await Advertisement.create({
    title,
    description,
    createdBy: req.user._id,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Advertisement created",
    data: ad,
  });
});

export const getAdvertisements = catchAsync(async (req, res) => {
  const filter = req.query.activeOnly === "true" ? { isActive: true } : {};
  const ads = await Advertisement.find(filter).sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Advertisements fetched",
    data: ads,
  });
});

export const updateAdvertisement = catchAsync(async (req, res) => {
  const { title, description, isActive } = req.body;

  const ad = await Advertisement.findById(req.params.id);
  if (!ad) throw new AppError(httpStatus.NOT_FOUND, "Advertisement not found");

  if (title) ad.title = title;
  if (description) ad.description = description;
  if (isActive !== undefined) ad.isActive = isActive;

  await ad.save();

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

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Advertisement deleted",
  });
});

export const updateVerificationStatus = catchAsync(async (req, res) => {
  const { status } = req.body;

  if (!["verified", "rejected"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "status must be 'verified' or 'rejected'");
  }

  const profile = await TradesmanProfile.findById(req.params.id);
  if (!profile) throw new AppError(httpStatus.NOT_FOUND, "Tradesman profile not found");

  profile.verificationStatus = status;
  if (status === "rejected") profile.isLive = false;

  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Tradesman ${status}`,
    data: profile,
  });
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
  const { firstName, lastName, email, phoneNumber = "", password, role = "admin" } = req.body;

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
    throw new AppError(httpStatus.BAD_REQUEST, "First name, last name, email and password are required");
  }
  if (password.length < 8) {
    throw new AppError(httpStatus.BAD_REQUEST, "Password must be at least 8 characters");
  }
  if (!["admin", "super-admin"].includes(role)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid administrator role");
  }

  const permissions = role === "super-admin"
    ? ADMIN_PERMISSIONS
    : normalizePermissions(req.body.permissions ?? []);

  const admin = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.toLowerCase().trim(),
    phoneNumber: phoneNumber.trim(),
    password,
    role,
    adminPermissions: permissions,
    isEmailVerified: true,
    isProfileComplete: true,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Administrator account created",
    data: admin,
  });
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

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: admin.isBlocked ? "Administrator access revoked" : "Administrator updated",
    data: admin,
  });
});

