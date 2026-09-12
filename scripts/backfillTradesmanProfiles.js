import "dotenv/config";
import mongoose from "mongoose";
import User from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import Review from "../model/review.model.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);
  const tradesmen = await User.find({ role: "tradesman" }).select("_id").lean();
  const repairedStatuses = await TradesmanProfile.updateMany(
    {
      user: { $in: tradesmen.map((user) => user._id) },
      verificationStatus: { $nin: ["pending", "verified", "rejected"] },
    },
    {
      $set: {
        verificationStatus: "pending",
        "verification.submittedAt": new Date(),
      },
    },
  );
  const repairedSubmittedAt = await TradesmanProfile.updateMany(
    {
      user: { $in: tradesmen.map((user) => user._id) },
      verificationStatus: "pending",
      $or: [
        { "verification.submittedAt": { $exists: false } },
        { "verification.submittedAt": null },
      ],
    },
    [{ $set: { "verification.submittedAt": { $ifNull: ["$createdAt", new Date()] } } }],
  );
  const profiles = await TradesmanProfile.find({
    user: { $in: tradesmen.map((user) => user._id) },
  }).select("user").lean();
  const existing = new Set(profiles.map((profile) => String(profile.user)));
  const missing = tradesmen.filter((user) => !existing.has(String(user._id)));

  if (missing.length) {
    await TradesmanProfile.insertMany(missing.map((user) => ({
      user: user._id,
      verificationStatus: "pending",
      verification: { submittedAt: new Date() },
    })));
  }

  const validUserIds = new Set(
    (await User.find({}).select("_id").lean()).map((user) => String(user._id)),
  );
  const orphanProfiles = (await TradesmanProfile.find({}).select("_id user").lean())
    .filter((profile) => !validUserIds.has(String(profile.user)));
  if (orphanProfiles.length) {
    await TradesmanProfile.deleteMany({
      _id: { $in: orphanProfiles.map((profile) => profile._id) },
    });
  }
  const existingProfileIds = (await TradesmanProfile.find({}).select("_id").lean())
    .map((profile) => profile._id);
  const orphanReviewResult = await Review.deleteMany({
    tradesman: { $nin: existingProfileIds },
  });

  console.log(`Tradesman verification profiles created: ${missing.length}`);
  console.log(`Tradesman verification statuses repaired: ${repairedStatuses.modifiedCount}`);
  console.log(`Pending verification timestamps repaired: ${repairedSubmittedAt.modifiedCount}`);
  console.log(`Orphan tradesman profiles removed: ${orphanProfiles.length}`);
  console.log(`Orphan reviews removed: ${orphanReviewResult.deletedCount}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
