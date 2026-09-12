import "dotenv/config";
import mongoose from "mongoose";
import TradesmanProfile from "../model/tradesmanProfile.model.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);
  const result = await TradesmanProfile.updateMany(
    {
      isVip: true,
      $or: [
        { vipBySkill: { $exists: false } },
        { vipBySkill: null },
        { vipBySkill: "" },
      ],
      mainSkill: { $nin: [null, ""] },
    },
    [{ $set: { vipBySkill: "$mainSkill" } }],
  );

  const vipWithoutCategory = await TradesmanProfile.countDocuments({
    isVip: true,
    $or: [
      { vipBySkill: { $exists: false } },
      { vipBySkill: null },
      { vipBySkill: "" },
    ],
  });

  console.log(`VIP skills backfilled: ${result.modifiedCount}`);
  console.log(`VIP profiles still missing a category: ${vipWithoutCategory}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
