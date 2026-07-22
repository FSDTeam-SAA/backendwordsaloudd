import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);
  const collection = mongoose.connection.collection("reviews");

  const indexes = await collection.indexes();
  console.log("Current indexes:", indexes.map((i) => i.name));

  const stale = indexes.find((i) => i.name === "reviewer_1_provider_1");
  if (stale) {
    await collection.dropIndex("reviewer_1_provider_1");
    console.log('✅ Dropped stale index "reviewer_1_provider_1"');
  } else {
    console.log('ℹ️  No "reviewer_1_provider_1" index found — nothing to drop');
  }

  const Review = mongoose.model(
    "Review",
    new mongoose.Schema(
      {
        tradesman: { type: mongoose.Schema.Types.ObjectId, ref: "TradesmanProfile" },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
      { strict: false }
    )
  );
  Review.schema.index({ tradesman: 1, reviewer: 1 }, { unique: true });
  await Review.syncIndexes();

  const after = await collection.indexes();
  console.log("Indexes after fix:", after.map((i) => i.name));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Fix script failed:", err);
  process.exit(1);
});