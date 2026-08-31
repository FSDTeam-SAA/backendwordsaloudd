import "dotenv/config";
import mongoose from "mongoose";
import { CATEGORY_ICONS } from "../constants/skills.js";
import Category from "../model/category.model.js";
import { normalizeCategoryIcon } from "../utils/adminHelpers.js";

const validIcon = (category) => {
  try {
    return normalizeCategoryIcon(category.icon);
  } catch {
    return CATEGORY_ICONS[category.name] || "";
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);
  const categories = await Category.find().sort({ order: 1, createdAt: 1, name: 1 });
  if (categories.length) {
    await Category.bulkWrite(categories.map((category, order) => ({
      updateOne: {
        filter: { _id: category._id },
        update: { $set: { order, icon: validIcon(category) } },
      },
    })));
  }
  console.log(`Categories normalized: ${categories.length}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
