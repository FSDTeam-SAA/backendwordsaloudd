import express from "express";
import {
  setSkills,
  setWorkArea,
  setPitchAndRate,
  goLive,
  getMyProfile,
  getCategories,
  browseTradesmen,
  getTradesmanById,
  requestContactChange,
  getMyDashboard,
  updateMyProfile,
  removeWorkPhoto
} from "../controller/tradesman.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { profileImagesUpload, workPhotosUpload } from "../middleware/multer.middleware.js";

const router = express.Router();

// public - browse / search / categories / detail
router.get("/categories", getCategories);
router.get("/", browseTradesmen);
router.get("/:id", getTradesmanById);

// tradesman-only onboarding + profile management
router.use(protect, restrictTo("tradesman"));

router.get("/me/profile", getMyProfile);
router.post("/onboarding/skills", setSkills);
router.post("/onboarding/work-area", setWorkArea);
router.post("/onboarding/pitch",workPhotosUpload,setPitchAndRate);
router.post("/onboarding/delete-photo",removeWorkPhoto);
router.post("/onboarding/go-live", goLive);
router.post("/onboarding/contact-change", requestContactChange);
router.get("/me/dashboard", getMyDashboard);
router.put("/me/profile",profileImagesUpload(true),updateMyProfile);

export default router;
