import "dotenv/config";
import mongoose from "mongoose";
import User, { ADMIN_PERMISSIONS } from "../model/user.model.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);

  const email = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";

  let admin = await User.findOne({
    email,
    role: { $in: ["admin", "super-admin"] },
  });

  if (admin) {
    admin.role = "super-admin";
    admin.adminPermissions = ADMIN_PERMISSIONS;
    admin.isBlocked = false;
    admin.isEmailVerified = true;
    admin.isProfileComplete = true;
    await admin.save();
    console.log(`Super-admin updated: ${email}`);
  } else {
    admin = await User.create({
      firstName: "Ken",
      lastName: "Adams",
      email,
      phoneNumber: "+18685550000",
      password,
      role: "super-admin",
      adminPermissions: ADMIN_PERMISSIONS,
      isEmailVerified: true,
      isProfileComplete: true,
    });
    console.log(`Super-admin created: ${email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

