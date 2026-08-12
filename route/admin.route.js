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
  updateVerificationStatus,
  getAdminList,
  createAdmin,
  updateAdmin
} from "../controller/admin.controller.js";
import { protect, requireAdminPermission, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// public - active ads shown as "sponsored slot" cards in the client app
router.get("/advertisements/active", async (req, res, next) => {
  req.query.activeOnly = "true";
  return getAdvertisements(req, res, next);
});

router.use(protect, restrictTo("admin", "super-admin"));

router.get("/dashboard", requireAdminPermission("dashboard"), getDashboardOverview);

router.get("/users", requireAdminPermission("users"), getUserList);
router.patch("/users/:userId/toggle-block", requireAdminPermission("users"), toggleUserBlock);
router.delete("/users/:userId", requireAdminPermission("users"), deleteUser);
router.post("/users/vip", requireAdminPermission("users"), addVipMember);

router.get("/advertisements", requireAdminPermission("advertisements"), getAdvertisements);
router.post("/advertisements", requireAdminPermission("advertisements"), createAdvertisement);
router.patch("/advertisements/:id", requireAdminPermission("advertisements"), updateAdvertisement);
router.delete("/advertisements/:id", requireAdminPermission("advertisements"), deleteAdvertisement);
router.put("/tradesman/:id/verification", requireAdminPermission("users"), updateVerificationStatus);

router.get("/administrators", restrictTo("super-admin"), getAdminList);
router.post("/administrators", restrictTo("super-admin"), createAdmin);
router.patch("/administrators/:adminId", restrictTo("super-admin"), updateAdmin);

export default router;
