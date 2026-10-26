import express from "express";
import {
  getMe,
  updateMe,
  changePassword,
  deleteMe,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { profileImagesUpload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/me", getMe);
router.put("/me", profileImagesUpload(), updateMe);
router.patch("/me", profileImagesUpload(), updateMe);
router.put("/change-password", changePassword);
router.delete("/me", deleteMe);

export default router;
