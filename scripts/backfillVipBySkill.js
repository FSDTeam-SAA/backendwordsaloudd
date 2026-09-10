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

  console.log(`VIP skills backfilled: ${result.modifiedCount}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
