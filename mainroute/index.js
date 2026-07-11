import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import tradesmanRoute from "../route/tradesman.route.js";
import reviewRoute from "../route/review.route.js";
import inquiryRoute from "../route/inquiry.route.js";
import adminRoute from "../route/admin.route.js";
import skillRoute from "../route/skill.route.js";

const router = express.Router();

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/tradesman", tradesmanRoute);
router.use("/review", reviewRoute);
router.use("/inquiry", inquiryRoute);
router.use("/admin", adminRoute);
router.use("/options", skillRoute);

export default router;
