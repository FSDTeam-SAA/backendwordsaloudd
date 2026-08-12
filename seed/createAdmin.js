import "dotenv/config";
import mongoose from "mongoose";
import User from "../model/user.model.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);

  const email = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "123456";

  let admin = await User.findOne({ email });

  if (admin) {
    console.log(`Admin already exists: ${email}`);
  } else {
    admin = await User.create({
      firstName: "Ken",
      lastName: "Adams",
      email,
      phoneNumber: "+18685550000",
      password,
      role: "admin",
      isEmailVerified: true,
      isProfileComplete: true,
    });
    console.log(`Admin created -> email: ${email} / password: ${password}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

