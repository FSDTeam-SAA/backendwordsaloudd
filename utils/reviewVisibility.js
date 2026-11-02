import mongoose from "mongoose";
import Review from "../model/review.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";

// Legacy reviews without a moderation status remain visible.
export const visibleReviews = (filter = {}) => ({
  ...filter,
  $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }],
});

export const refreshTradesmanRatings = async (profileIds) => {
  for (const id of [...new Set(profileIds.map(String))]) {
    const [stats] = await Review.aggregate([
      { $match: visibleReviews({ tradesman: new mongoose.Types.ObjectId(id) }) },
      { $group: { _id: "$tradesman", average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await TradesmanProfile.findByIdAndUpdate(id, {
      ratingAverage: Math.round((stats?.average || 0) * 10) / 10,
      ratingCount: stats?.count || 0,
    });
  }
};

// Derive public scores from visible reviews so stale cached totals cannot leak rejected ratings.
export const publicRatingStages = (skill) => [
  { $lookup: {
    from: Review.collection.name,
    let: { profileId: "$_id" },
    pipeline: [
      { $match: visibleReviews({
        $expr: { $eq: ["$tradesman", "$$profileId"] },
        ...(skill ? { skill } : {}),
      }) },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ],
    as: "_publicRatings",
  } },
  { $addFields: {
    ratingAverage: { $round: [{ $ifNull: [{ $arrayElemAt: ["$_publicRatings.average", 0] }, 0] }, 1] },
    ratingCount: { $ifNull: [{ $arrayElemAt: ["$_publicRatings.count", 0] }, 0] },
  } },
  { $project: { _publicRatings: 0 } },
];
