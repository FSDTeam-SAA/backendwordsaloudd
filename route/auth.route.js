import express from "express";
import {
  sendSignupOtp,
  register,
  resendOTP,
  verifyEmail,
  login,
  forgetPassword,
  verifyResetPasswordOTP,
  resetPassword,
  logout,
} from "../controller/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/send-otp", sendSignupOtp);
router.post("/register", register);
router.post("/resend-otp", resendOTP);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forget-password", forgetPassword);
router.post("/verify-reset-otp", verifyResetPasswordOTP);
router.post("/reset-password", resetPassword);
router.post("/logout", protect, logout);

export default router;
