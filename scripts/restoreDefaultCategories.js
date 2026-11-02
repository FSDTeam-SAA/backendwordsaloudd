import "dotenv/config";
import mongoose from "mongoose";
import Category from "../model/category.model.js";
import { SKILLS, CATEGORY_ICONS } from "../constants/skills.js";
import { slugify } from "../utils/adminHelpers.js";

try {
  if (!process.env.MONGO_DB_URL) throw new Error("MONGO_DB_URL is required");
  await mongoose.connect(process.env.MONGO_DB_URL);
  const categories = await Category.find().lean();
  const missing = SKILLS.filter(name => !categories.some(c => c.name === name || c.slug === slugify(name)));
  console.log(JSON.stringify({ total: categories.length, active: categories.filter(c => c.isActive).length, missing, inactive: categories.filter(c => !c.isActive).map(c => c.name) }));
  if (process.argv.includes("--apply")) {
    const nextOrder = Math.max(-1, ...categories.map(c => c.order || 0)) + 1;
    for (const [offset, name] of missing.entries()) {
      await Category.updateOne({ slug: slugify(name) }, { $setOnInsert: {
        name, slug: slugify(name), icon: CATEGORY_ICONS[name] || "", order: nextOrder + offset, isActive: true, newUntil: null,
      } }, { upsert: true });
    }
    console.log(`Added ${missing.length} missing defaults; existing categories preserved`);
  } else console.log("Dry run. Use --apply to restore missing default categories after reviewing the list.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
