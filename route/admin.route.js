import express from "express";
import {
  getDashboardOverview,
  getUserList,
  toggleUserBlock,
  deleteUser,
  addVipMember,
  createAdvertisement,
  getAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
} from "../controller/admin.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// public - active ads shown as "sponsored slot" cards in the client app
router.get("/advertisements/active", async (req, res, next) => {
  req.query.activeOnly = "true";
  return getAdvertisements(req, res, next);
});

router.use(protect, restrictTo("admin"));

router.get("/dashboard", getDashboardOverview);

router.get("/users", getUserList);
router.patch("/users/:userId/toggle-block", toggleUserBlock);
router.delete("/users/:userId", deleteUser);
router.post("/users/vip", addVipMember);

router.get("/advertisements", getAdvertisements);
router.post("/advertisements", createAdvertisement);
router.patch("/advertisements/:id", updateAdvertisement);
router.delete("/advertisements/:id", deleteAdvertisement);

export default router;
