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
