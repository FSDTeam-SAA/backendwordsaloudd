import "dotenv/config";
import mongoose from "mongoose";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import Review from "../model/review.model.js";
import { visibleReviews, refreshTradesmanRatings } from "../utils/reviewVisibility.js";

try {
  await mongoose.connect(process.env.MONGO_DB_URL);
  const profiles = await TradesmanProfile.find().select("ratingAverage ratingCount");
  let changed = 0;
  for (const profile of profiles) {
    const [stats] = await Review.aggregate([
      { $match: visibleReviews({ tradesman: profile._id }) },
      { $group: { _id: "$tradesman", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const average = Math.round((stats?.avg || 0) * 10) / 10;
    const count = stats?.count || 0;
    if (profile.ratingAverage === average && profile.ratingCount === count) continue;
    changed++;
    console.log(JSON.stringify({ profileId: profile.id, previousAverage: profile.ratingAverage, previousCount: profile.ratingCount, average, count }));
    if (process.argv.includes("--apply")) await refreshTradesmanRatings([profile._id]);
  }
  console.log(`${changed} profiles ${process.argv.includes("--apply") ? "recalculated" : "need recalculation (dry run)"}`);
} finally {
  await mongoose.disconnect();
}
