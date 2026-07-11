import express from "express";
import { sendInquiry, getAllInquiries } from "../controller/inquiry.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// public form, but will attach req.user if a token happens to be sent;
// kept simple/public to match the "Advertise inquiry" screen which any
// visitor (client or tradesman) can submit.
router.post("/", sendInquiry);

router.get("/", protect, restrictTo("admin"), getAllInquiries);

export default router;
