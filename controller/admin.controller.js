import httpStatus from "http-status";
import User from "../model/user.model.js";
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

// "Dashboard Overview" - totals + charts
export const getDashboardOverview = catchAsync(async (req, res) => {
  const [totalUser, totalClient, totalTradesman, totalAdvertisement] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "client" }),
      User.countDocuments({ role: "tradesman" }),
      Advertisement.countDocuments({}),
    ]);

  // Monthly occupancy rate: % of this week's signups (by weekday) that are live tradesmen
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

  // User registration rate - signups per month, this year
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

// "User list" - All Users / Client / Tradesman / VIP tabs
export const getUserList = catchAsync(async (req, res) => {
  const { type = "all", page = 1, limit = 20 } = req.query;

  let userFilter = {};
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

// green dot / red dot in Actions - activate or block a user
export const toggleUserBlock = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  user.isBlocked = !user.isBlocked;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: user.isBlocked ? "User blocked" : "User activated",
    data: user,
  });
});

// red trash icon in Actions
export const deleteUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  await TradesmanProfile.findOneAndDelete({ user: user._id });
  await user.deleteOne();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User deleted",
  });
});

// "Add VIP Member" modal
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

// ---- Advertisement CRUD ----

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


// admin approves/rejects a tradesman's verification (pending -> verified/rejected)
export const updateVerificationStatus = catchAsync(async (req, res) => {
  const { status } = req.body; // "verified" | "rejected"

  if (!["verified", "rejected"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "status must be 'verified' or 'rejected'");
  }

  const profile = await TradesmanProfile.findById(req.params.id);
  if (!profile) throw new AppError(httpStatus.NOT_FOUND, "Tradesman profile not found");

  profile.verificationStatus = status;
  // a rejected tradesman shouldn't stay visible in search until re-approved
  if (status === "rejected") profile.isLive = false;

  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Tradesman ${status}`,
    data: profile,
  });
});

