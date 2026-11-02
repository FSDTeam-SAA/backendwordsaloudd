import "dotenv/config";
import mongoose from "mongoose";
import Review from "../model/review.model.js";

try {
  if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL is required");
  // Prevent automatic index creation before the migration has been reviewed.
  await mongoose.connect(process.env.MONGO_DB_URL, { autoIndex: false });
  const indexes = await Review.collection.indexes();
  const obsolete = indexes.filter(index => {
    const keys = Object.keys(index.key);
    return index.unique && keys.length === 2 && keys.includes("reviewer") &&
      (keys.includes("tradesman") || keys.includes("provider"));
  });
  console.log(JSON.stringify({ obsoleteIndexes: obsolete.map(i => i.name), newIndex: { tradesman: 1, reviewer: 1, skill: 1 } }));
  if (process.argv.includes("--apply")) {
    await Review.collection.createIndex({ tradesman: 1, reviewer: 1, skill: 1 }, { unique: true });
    for (const index of obsolete) await Review.collection.dropIndex(index.name);
    console.log("Trade-scoped review index installed");
  } else console.log("Dry run. Use --apply before deploying trade-specific review submissions.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
