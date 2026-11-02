import httpStatus from "http-status";
import Review from "../model/review.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { getPlatformSettings } from "../utils/adminHelpers.js";

import { visibleReviews, refreshTradesmanRatings } from "../utils/reviewVisibility.js";

export const resolveReviewSkill = (profile, requestedSkill) => {
  const skills = [...new Set([profile.mainSkill, ...(profile.extraSkills || [])].filter(Boolean))];
  const skill = typeof requestedSkill === "string" ? requestedSkill.trim() : "";
  if (skill && skills.includes(skill)) return skill;
  if (!requestedSkill && skills.length === 1) return skills[0];
  throw new AppError(httpStatus.BAD_REQUEST, "Provide the skill being reviewed from this tradesman's registered skills");
};

export const postReview = catchAsync(async (req, res) => {
  const { tradesmanId } = req.params;
  const { rating, ratingLabel, reviewText } = req.body;

  if (!rating) {
    throw new AppError(httpStatus.BAD_REQUEST, "Rating is required");
  }

  const tradesman = await TradesmanProfile.findById(tradesmanId);
  if (!tradesman) {
    throw new AppError(httpStatus.NOT_FOUND, "Tradesman not found");
  }
  const skill = resolveReviewSkill(tradesman, req.body.skill);
  const settings = await getPlatformSettings();
  const moderationStatus = settings.reviewModerationMode === "require-review" ? "pending" : "approved";

  const review = await Review.findOneAndUpdate(
    { tradesman: tradesmanId, reviewer: req.user._id, skill },
    { skill, rating, ratingLabel, reviewText, moderationStatus, moderatedBy: null, moderatedAt: null, moderationNote: "" },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await refreshTradesmanRatings([tradesmanId]);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: moderationStatus === "pending" ? "Review submitted for moderation" : "Review posted",
    data: review,
  });
});

export const getReviewsForTradesman = catchAsync(async (req, res) => {
  const { tradesmanId } = req.params;
  res.setHeader("Cache-Control", "no-store");

  const reviews = await Review.find(visibleReviews({ tradesman: tradesmanId, ...(req.query.skill ? { skill: req.query.skill } : {}) }))
    .populate("reviewer", "firstName lastName")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews fetched",
    data: reviews,
  });
});
