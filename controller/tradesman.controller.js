import httpStatus from "http-status";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import User from "../model/user.model.js";
import Review from "../model/review.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import { SKILLS, TRAVEL_RANGES, normalizeTravelRange, normalizeRateUnit } from "../constants/skills.js";

const getOrCreateProfile = async (userId) => {
  let profile = await TradesmanProfile.findOne({ user: userId });
  if (!profile) {
    profile = new TradesmanProfile({ user: userId });
  }
  return profile;
};

export const setSkills = catchAsync(async (req, res) => {
  const { mainSkill, extraSkills } = req.body;

  if (!mainSkill || !SKILLS.includes(mainSkill)) {
    throw new AppError(httpStatus.BAD_REQUEST, "A valid main skill is required");
  }

  const extras = Array.isArray(extraSkills) ? extraSkills.slice(0, 2) : [];
  extras.forEach((s) => {
    if (!SKILLS.includes(s)) {
      throw new AppError(httpStatus.BAD_REQUEST, `Invalid skill: ${s}`);
    }
  });

  const profile = await getOrCreateProfile(req.user._id);
  profile.mainSkill = mainSkill;
  profile.extraSkills = extras;
  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Skills saved",
    data: profile,
  });
});

export const setWorkArea = catchAsync(async (req, res) => {
  const { homeArea, travelRange } = req.body;

  if (!homeArea) {
    throw new AppError(httpStatus.BAD_REQUEST, "Home area is required");
  }
  const normalizedRange = normalizeTravelRange(travelRange);
  if (!normalizedRange) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `A valid travel range is required. Accepted values: ${TRAVEL_RANGES.join(", ")}`
    );
  }

  const profile = await getOrCreateProfile(req.user._id);
  profile.homeArea = homeArea;
  profile.travelRange = normalizedRange;
  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work area saved",
    data: profile,
  });
});

export const setPitchAndRate = catchAsync(async (req, res) => {
  const { pitch, rateAmount, rateUnit } = req.body;

  const profile = await getOrCreateProfile(req.user._id);

  if (pitch !== undefined) {
    if (pitch.length > 140) {
      throw new AppError(httpStatus.BAD_REQUEST, "Pitch must be 140 characters or less");
    }
    profile.pitch = pitch;
  }

  if (rateAmount !== undefined) profile.typicalRate.amount = Number(rateAmount);
  if (rateUnit) {
    const normalizedUnit = normalizeRateUnit(rateUnit);
    if (!normalizedUnit) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid rate unit. Accepted values: Per day, Per hour, Per job`
      );
    }
    profile.typicalRate.unit = normalizedUnit;
  }

  if (req.files && req.files.length) {
    const uploads = await Promise.all(
      req.files.map((f) =>
        uploadOnCloudinary(f.buffer, { folder: "aturservicett/work-photos" })
      )
    );
    profile.workPhotos.push(
      ...uploads.map((r) => ({ public_id: r.public_id, url: r.secure_url }))
    );
  }

  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile details saved",
    data: profile,
  });
});

export const goLive = catchAsync(async (req, res) => {
  const profile = await TradesmanProfile.findOne({ user: req.user._id });
  if (!profile) {
    throw new AppError(httpStatus.BAD_REQUEST, "Complete your profile setup first");
  }
  if (!profile.mainSkill || !profile.homeArea || !profile.travelRange) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please complete all onboarding steps before going live"
    );
  }

  profile.isLive = true;
  if (profile.verificationStatus === "rejected") {
    profile.verificationStatus = "pending";
  }
  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your profile is now visible to clients in Trinidad and Tobago",
    data: profile,
  });
});

export const getMyProfile = catchAsync(async (req, res) => {
  const profile = await TradesmanProfile.findOne({ user: req.user._id }).populate(
    "user",
    "firstName lastName email phoneNumber area profileImage"
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched",
    data: profile,
  });
});

export const getCategories = catchAsync(async (req, res) => {
  const counts = await TradesmanProfile.aggregate([
    { $match: { isLive: true } },
    { $group: { _id: "$mainSkill", count: { $sum: 1 } } },
  ]);

  const countMap = counts.reduce((acc, c) => {
    acc[c._id] = c.count;
    return acc;
  }, {});

  const categories = SKILLS.map((skill) => ({
    skill,
    listedCount: countMap[skill] || 0,
  }));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Categories fetched",
    data: categories,
  });
});

export const browseTradesmen = catchAsync(async (req, res) => {
  const {
    skill,
    search,
    area,
    sort = "rating",
    page = 1,
    limit = 20,
  } = req.query;

  const filter = { isLive: true };
  if (skill) filter.mainSkill = skill;
  if (area) filter.homeArea = new RegExp(area, "i");

  let query = TradesmanProfile.find(filter).populate(
    "user",
    "firstName lastName profileImage area"
  );

  if (search) {
    const users = await User.find({
      $or: [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
      ],
    }).select("_id");
    filter.user = { $in: users.map((u) => u._id) };
    query = TradesmanProfile.find(filter).populate(
      "user",
      "firstName lastName profileImage area"
    );
  }

  const sortMap = {
    rating: { isVip: -1, ratingAverage: -1 },
    newest: { createdAt: -1 },
    priceLow: { "typicalRate.amount": 1 },
    priceHigh: { "typicalRate.amount": -1 },
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    query
      .clone()
      .sort(sortMap[sort] || sortMap.rating)
      .skip(skip)
      .limit(Number(limit)),
    TradesmanProfile.countDocuments(filter),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tradesmen fetched",
    data: items,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// tradesman detail page - about, recent work, reviews
// export const getTradesmanById = catchAsync(async (req, res) => {
//   const profile = await TradesmanProfile.findById(req.params.id).populate(
//     "user",
//     "firstName lastName phoneNumber area profileImage"
//   );

//   if (!profile) {
//     throw new AppError(httpStatus.NOT_FOUND, "Tradesman not found");
//   }

//   const reviews = await Review.find({ tradesman: profile._id })
//     .populate("reviewer", "firstName lastName")
//     .sort({ createdAt: -1 })
//     .limit(20);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Tradesman fetched",
//     data: { profile, reviews },
//   });
// });

export const getTradesmanById = catchAsync(async (req, res) => {
  const profile = await TradesmanProfile.findById(req.params.id).populate(
    "user",
    "firstName lastName phoneNumber area profileImage"
  );

  if (!profile) {
    throw new AppError(httpStatus.NOT_FOUND, "Tradesman not found");
  }

  if (!req.user || String(req.user._id) !== String(profile.user._id)) {
    await TradesmanProfile.updateOne(
      { _id: profile._id },
      { $push: { profileViews: new Date() } }
    );
  }

  const reviews = await Review.find({ tradesman: profile._id })
    .populate("reviewer", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(20);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tradesman fetched",
    data: { profile, reviews },
  });
});



// export const getMyDashboard = catchAsync(async (req, res) => {
//   const profile = await TradesmanProfile.findOne({ user: req.user._id })
//     .select("+profileViews")
//     .populate("user", "firstName lastName phoneNumber area profileImage createdAt");

//   if (!profile) {
//     throw new AppError(httpStatus.NOT_FOUND, "Tradesman profile not found. Please complete onboarding first.");
//   }

//   const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
//   const viewsThisWeek = profile.profileViews.filter((d) => d > sevenDaysAgo).length;

//   const tradesListed = 1 + (profile.extraSkills?.length || 0);

//   const breakdownAgg = await Review.aggregate([
//     { $match: { tradesman: profile._id } },
//     { $group: { _id: "$rating", count: { $sum: 1 } } },
//   ]);
//   const breakdownMap = breakdownAgg.reduce((acc, r) => {
//     acc[r._id] = r.count;
//     return acc;
//   }, {});
//   const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
//     star,
//     count: breakdownMap[star] || 0,
//   }));

//   const recentReviews = await Review.find({ tradesman: profile._id })
//     .populate("reviewer", "firstName lastName")
//     .sort({ createdAt: -1 })
//     .limit(10);

//   const daysOnPlatform = Math.floor(
//     (Date.now() - new Date(profile.user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
//   );

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Dashboard fetched",
//     data: {
//       profile,
//       viewsThisWeek,
//       tradesListed,
//       overallRating: profile.ratingAverage,
//       reviewsTotal: profile.ratingCount,
//       ratingBreakdown,
//       recentReviews,
//       daysOnPlatform,
//     },
//   });
// });


export const getMyDashboard = catchAsync(async (req, res) => {
  const profile = await TradesmanProfile.findOne({ user: req.user._id })
    .select("+profileViews")
    .populate("user", "firstName lastName phoneNumber area profileImage createdAt");

  if (!profile) {
    throw new AppError(httpStatus.NOT_FOUND, "Tradesman profile not found. Please complete onboarding first.");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const viewsThisWeek = profile.profileViews.filter((d) => d > sevenDaysAgo).length;

  const tradesListed = 1 + (profile.extraSkills?.length || 0);

  const breakdownAgg = await Review.aggregate([
    { $match: { tradesman: profile._id } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);
  const breakdownMap = breakdownAgg.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: breakdownMap[star] || 0,
  }));

  const recentReviews = await Review.find({ tradesman: profile._id })
    .populate("reviewer", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(10);

  const daysOnPlatform = Math.floor(
    (Date.now() - new Date(profile.user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
  );

  const verificationBadgeMap = {
    pending: { label: "Pending Verification"},
    verified: { label: "✓ Verified"},
    rejected: { label: "Rejected — please update your profile"},
  };
  const verification = {
    status: profile.verificationStatus, 
    ...verificationBadgeMap[profile.verificationStatus],
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard fetched",
    data: {
      profile,
      verification,
      viewsThisWeek,
      tradesListed,
      overallRating: profile.ratingAverage,
      reviewsTotal: profile.ratingCount,
      ratingBreakdown,
      recentReviews,
      daysOnPlatform,
    },
  });
});


export const requestContactChange = catchAsync(async (req, res) => {
  const { requestedName, requestedPhoneNumber, reason } = req.body;

  if (!requestedName && !requestedPhoneNumber) {
    throw new AppError(httpStatus.BAD_REQUEST, "Provide a new name or phone number to request a change");
  }

  const profile = await getOrCreateProfile(req.user._id);

  profile.contactChangeRequest = {
    requestedName: requestedName || "",
    requestedPhoneNumber: requestedPhoneNumber || "",
    reason: reason || "",
    status: "pending",
    requestedAt: new Date(),
  };

  await profile.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Change request submitted. Our team will review and update it after re-verification.",
    data: profile.contactChangeRequest,
  });
});

export const updateMyProfile = catchAsync(async (req, res) => {
  const { pitch, rateAmount, rateUnit, mainSkill, extraSkills, homeArea, travelRange } = req.body;

  const profile = await getOrCreateProfile(req.user._id);

  if (mainSkill !== undefined) {
    if (!SKILLS.includes(mainSkill)) {
      throw new AppError(httpStatus.BAD_REQUEST, "A valid main skill is required");
    }
    profile.mainSkill = mainSkill;
  }
  if (extraSkills !== undefined) {
    const parsedExtras = typeof extraSkills === "string" ? JSON.parse(extraSkills) : extraSkills;
    const extras = Array.isArray(parsedExtras) ? parsedExtras.slice(0, 2) : [];
    extras.forEach((s) => {
      if (!SKILLS.includes(s)) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid skill: ${s}`);
      }
    });
    profile.extraSkills = extras;
  }

  if (homeArea !== undefined) profile.homeArea = homeArea;
  if (travelRange !== undefined) {
    const normalizedRange = normalizeTravelRange(travelRange);
    if (!normalizedRange) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `A valid travel range is required. Accepted values: ${TRAVEL_RANGES.join(", ")}`
      );
    }
    profile.travelRange = normalizedRange;
  }

  if (pitch !== undefined) {
    if (pitch.length > 140) {
      throw new AppError(httpStatus.BAD_REQUEST, "Pitch must be 140 characters or less");
    }
    profile.pitch = pitch;
  }

  if (rateAmount !== undefined) profile.typicalRate.amount = Number(rateAmount);
  if (rateUnit) {
    const normalizedUnit = normalizeRateUnit(rateUnit);
    if (!normalizedUnit) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid rate unit. Accepted values: Per day, Per hour, Per job"
      );
    }
    profile.typicalRate.unit = normalizedUnit;
  }

  await profile.save();

  const avatarFile = req.files?.avatar?.[0];
  let user = req.user;
  if (avatarFile) {
    const uploadResult = await uploadOnCloudinary(avatarFile.buffer, {
      folder: "aturservicett/avatars",
    });
    user = await User.findByIdAndUpdate(
      req.user._id,
      {
        profileImage: { public_id: uploadResult.public_id, url: uploadResult.secure_url },
      },
      { new: true }
    );
  }

  const populatedProfile = await TradesmanProfile.findById(profile._id).populate(
    "user",
    "firstName lastName email phoneNumber area profileImage"
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: populatedProfile,
  });
});