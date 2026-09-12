import httpStatus from "http-status";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import User from "../model/user.model.js";
import Review from "../model/review.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";
import { TRAVEL_RANGES, normalizeTravelRange, normalizeRateUnit } from "../constants/skills.js";
import Category from "../model/category.model.js";
import { categoryJson, ensureDefaultCategories, getActiveCategoryNames } from "../utils/adminHelpers.js";

const getOrCreateProfile = async (userId) => {
  let profile = await TradesmanProfile.findOne({ user: userId });
  if (!profile) {
    profile = new TradesmanProfile({ user: userId });
  }
  return profile;
};

export const setSkills = catchAsync(async (req, res) => {
  const { mainSkill, extraSkills } = req.body;
  const activeSkills = await getActiveCategoryNames();

  if (!mainSkill || !activeSkills.includes(mainSkill)) {
    throw new AppError(httpStatus.BAD_REQUEST, "A valid main skill is required");
  }

  const extras = Array.isArray(extraSkills) ? extraSkills.slice(0, 2) : [];
  extras.forEach((s) => {
    if (!activeSkills.includes(s)) {
      throw new AppError(httpStatus.BAD_REQUEST, `Invalid skill: ${s}`);
    }
  });

  const profile = await getOrCreateProfile(req.user._id);
  const assignedVipSkill = profile.isVip ? profile.vipBySkill : "";
  if (assignedVipSkill && ![mainSkill, ...extras].includes(assignedVipSkill)) {
    throw new AppError(httpStatus.BAD_REQUEST, `Your assigned VIP skill (${assignedVipSkill}) cannot be removed`);
  }
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

export const removeWorkPhoto = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { public_id } = req.body;

  if (!userId) {
    return next(new AppError(400, "User not authenticated"));
  }

  if (!public_id) {
    return next(new AppError(400, "Photo public_id is required"));
  }

  // Find tradesman
  const tradesman = await getOrCreateProfile(req.user._id);

  if (!tradesman) {
    return next(new AppError(404, "Tradesman not found"));
  }

  // Find the photo
  const photoIndex = tradesman.workPhotos.findIndex(
    (photo) => photo.public_id === public_id
  );

  if (photoIndex === -1) {
    return next(new AppError(404, "Work photo not found"));
  }

  // Remove photo from database
  tradesman.workPhotos.splice(photoIndex, 1);

  await tradesman.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Work photo removed successfully",
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
  if (profile.verificationStatus === "pending") profile.verification.submittedAt = new Date();
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
  await ensureDefaultCategories();
  const [tradesmanCounts, vipCounts] = await Promise.all([
    TradesmanProfile.aggregate([
      { $project: { skills: { $setUnion: [["$mainSkill"], { $ifNull: ["$extraSkills", []] }] } } },
      { $unwind: "$skills" },
      { $match: { skills: { $nin: [null, ""] } } },
      { $group: { _id: "$skills", count: { $sum: 1 } } },
    ]),
    TradesmanProfile.aggregate([
      { $match: { isVip: true, vipBySkill: { $nin: [null, ""] } } },
      { $group: { _id: "$vipBySkill", count: { $sum: 1 } } },
    ]),
  ]);

  const tradesmanCountMap = tradesmanCounts.reduce((acc, c) => {
    acc[c._id] = c;
    return acc;
  }, {});
  const vipCountMap = vipCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const categoryRecords = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
  const categories = categoryRecords.map((category) => ({
    skill: category.name,
    listedCount: vipCountMap[category.name] || 0,
    vipCount: vipCountMap[category.name] || 0,
    tradesmanCount: tradesmanCountMap[category.name]?.count || 0,
    isVerified: (vipCountMap[category.name] || 0) > 0,
    icon: category.icon,
    isNew: categoryJson(category).isNew,
    newUntil: category.newUntil,
  }));

  res.setHeader("Cache-Control", "no-store");
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

  // every tradesman is listed - verification only drives the badge, not visibility
  const filter = {};
  if (skill) filter.$or = [{ mainSkill: skill }, { extraSkills: skill }];
  if (area) filter.homeArea = new RegExp(area, "i");

  if (search) {
    const users = await User.find({
      $or: [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
      ],
    }).select("_id");
    filter.user = { $in: users.map((u) => u._id) };
  }

  const sortMap = {
    rating: { isVip: -1, ratingAverage: -1 },
    newest: { createdAt: -1 },
    priceLow: { "typicalRate.amount": 1 },
    priceHigh: { "typicalRate.amount": -1 },
  };

  const skip = (Number(page) - 1) * Number(limit);

  let itemsPromise;
  if (skill && sort === "rating") {
    itemsPromise = TradesmanProfile.aggregate([
      { $match: filter },
      {
        $addFields: {
          _vipPriority: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isVip", true] },
                  { $eq: ["$vipBySkill", skill] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      { $sort: { _vipPriority: -1, ratingAverage: -1, _id: 1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      { $project: { _vipPriority: 0 } },
    ]).then((profiles) => TradesmanProfile.populate(profiles, {
      path: "user",
      select: "firstName lastName profileImage area",
    }));
  } else {
    itemsPromise = TradesmanProfile.find(filter)
      .populate("user", "firstName lastName profileImage area")
      .sort(sortMap[sort] || sortMap.rating)
      .skip(skip)
      .limit(Number(limit));
  }

  const [items, total] = await Promise.all([
    itemsPromise,
    TradesmanProfile.countDocuments(filter),
  ]);
  const categoryScopedItems = items.map((item) => {
    const value = typeof item.toJSON === "function" ? item.toJSON() : item;
    if (!skill) return value;
    const isVipForCategory = value.isVip === true && value.vipBySkill === skill;
    return { ...value, isVip: isVipForCategory, isVipForCategory };
  });

  res.setHeader("Cache-Control", "no-store");
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tradesmen fetched",
    data: categoryScopedItems,
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
    { $match: { tradesman: profile._id, $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }] } },
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

  const recentReviews = await Review.find({ tradesman: profile._id, $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }] })
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
  const activeSkills = await getActiveCategoryNames();
  const assignedVipSkill = profile.isVip ? profile.vipBySkill : "";

  if (mainSkill !== undefined) {
    if (!activeSkills.includes(mainSkill)) {
      throw new AppError(httpStatus.BAD_REQUEST, "A valid main skill is required");
    }
    profile.mainSkill = mainSkill;
  }
  if (extraSkills !== undefined) {
    const parsedExtras = typeof extraSkills === "string" ? JSON.parse(extraSkills) : extraSkills;
    const extras = Array.isArray(parsedExtras) ? parsedExtras.slice(0, 2) : [];
    extras.forEach((s) => {
      if (!activeSkills.includes(s)) {
        throw new AppError(httpStatus.BAD_REQUEST, `Invalid skill: ${s}`);
      }
    });
    profile.extraSkills = extras;
  }

  if (assignedVipSkill && ![profile.mainSkill, ...(profile.extraSkills || [])].includes(assignedVipSkill)) {
    throw new AppError(httpStatus.BAD_REQUEST, `Your assigned VIP skill (${assignedVipSkill}) cannot be removed`);
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
