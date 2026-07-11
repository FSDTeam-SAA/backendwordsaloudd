import express from "express";
import {
  getMe,
  updateMe,
  changePassword,
  deleteMe,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/me", getMe);
router.patch("/me", upload.single("profileImage"), updateMe);
router.patch("/change-password", changePassword);
router.delete("/me", deleteMe);

export default router;
