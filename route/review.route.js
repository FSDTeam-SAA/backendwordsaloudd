import express from "express";
import {
  postReview,
  getReviewsForTradesman,
} from "../controller/review.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:tradesmanId", getReviewsForTradesman);
router.post("/:tradesmanId", protect, restrictTo("client"), postReview);

export default router;
