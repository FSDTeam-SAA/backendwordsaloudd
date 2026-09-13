import "dotenv/config";
import mongoose from "mongoose";
import Category from "../model/category.model.js";
import { NEW_CATEGORY_BADGE_DAYS, newCategoryUntil } from "../utils/adminHelpers.js";

const run = async () => {
  if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL is not configured");

  await mongoose.connect(process.env.MONGO_DB_URL);
  const cutoff = new Date(Date.now() - NEW_CATEGORY_BADGE_DAYS * 24 * 60 * 60 * 1000);
  const recentCategories = await Category.find({ createdAt: { $gte: cutoff } }).select("_id createdAt newUntil");
  const updates = recentCategories
    .map((category) => ({ category, expectedUntil: newCategoryUntil(category.createdAt) }))
    .filter(({ category, expectedUntil }) => !category.newUntil || category.newUntil < expectedUntil)
    .map(({ category, expectedUntil }) => ({
      updateOne: {
        filter: { _id: category._id },
        update: { $set: { newUntil: expectedUntil } },
      },
    }));

  if (updates.length) await Category.bulkWrite(updates);
  console.log(`Category NEW badge windows extended: ${updates.length}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
