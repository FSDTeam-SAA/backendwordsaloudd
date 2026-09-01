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
  ,bulkUserAction
  ,exportUsersCsv
  ,exportReviewsCsv
  ,getCategoriesAdmin
  ,createCategory
  ,updateCategory
  ,deleteCategory
  ,bulkDeleteCategories
  ,bulkDeleteAdvertisements
  ,deleteAdInquiry
  ,bulkDeleteAdInquiries
  ,deleteReviewAdmin
  ,bulkDeleteReviews
  ,deleteAuditLog
  ,bulkDeleteAuditLogs
  ,deleteAdmin
  ,bulkDeleteAdmins
  ,bulkRevokeAdminInvitations
  ,getSettingsAdmin
  ,updateSettingsAdmin
  ,getAuditLogs
  ,getNotifications
  ,getReviewsAdmin
  ,moderateReview
  ,getAdInquiriesAdmin
  ,updateAdInquiry
  ,getAdminInvitations
  ,resendAdminInvitation
  ,revokeAdminInvitation
} from "../controller/admin.controller.js";
import { protect, requireAdminPermission, restrictTo } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

// public - active ads shown as "sponsored slot" cards in the client app
router.get("/advertisements/active", async (req, res, next) => {
  req.query.activeOnly = "true";
  return getAdvertisements(req, res, next);
});

router.use(protect, restrictTo("admin", "super-admin"));

router.get("/dashboard", requireAdminPermission("dashboard"), getDashboardOverview);

router.get("/users", requireAdminPermission("users"), getUserList);
router.post("/users/bulk", requireAdminPermission("users"), bulkUserAction);
router.patch("/users/:userId/toggle-block", requireAdminPermission("users"), toggleUserBlock);
router.delete("/users/:userId", requireAdminPermission("users"), deleteUser);
router.post("/users/vip", requireAdminPermission("users"), addVipMember);
router.get("/export/users", requireAdminPermission("exports"), exportUsersCsv);
router.get("/export/reviews", requireAdminPermission("exports"), exportReviewsCsv);
router.post("/verification/bulk", requireAdminPermission("verification"), bulkUserAction);

router.get("/advertisements", requireAdminPermission("advertisements"), getAdvertisements);
router.post("/advertisements/bulk-delete", requireAdminPermission("advertisements"), bulkDeleteAdvertisements);
router.post("/advertisements", requireAdminPermission("advertisements"), upload.single("media"), createAdvertisement);
router.patch("/advertisements/:id", requireAdminPermission("advertisements"), upload.single("media"), updateAdvertisement);
router.delete("/advertisements/:id", requireAdminPermission("advertisements"), deleteAdvertisement);
router.get("/advertisement-inquiries", requireAdminPermission("advertisements"), getAdInquiriesAdmin);
router.post("/advertisement-inquiries/bulk-delete", requireAdminPermission("advertisements"), bulkDeleteAdInquiries);
router.patch("/advertisement-inquiries/:id", requireAdminPermission("advertisements"), updateAdInquiry);
router.delete("/advertisement-inquiries/:id", requireAdminPermission("advertisements"), deleteAdInquiry);
router.put("/tradesman/:id/verification", requireAdminPermission("verification"), updateVerificationStatus);

router.get("/categories", requireAdminPermission("categories"), getCategoriesAdmin);
router.post("/categories/bulk-delete", requireAdminPermission("categories"), bulkDeleteCategories);
router.post("/categories", requireAdminPermission("categories"), createCategory);
router.patch("/categories/:id", requireAdminPermission("categories"), updateCategory);
router.delete("/categories/:id", requireAdminPermission("categories"), deleteCategory);

router.get("/platform-settings", requireAdminPermission("settings"), getSettingsAdmin);
router.patch("/platform-settings", requireAdminPermission("settings"), updateSettingsAdmin);
router.get("/audit-logs", requireAdminPermission("audit"), getAuditLogs);
router.post("/audit-logs/bulk-delete", requireAdminPermission("audit"), bulkDeleteAuditLogs);
router.delete("/audit-logs/:id", requireAdminPermission("audit"), deleteAuditLog);
router.get("/notifications", getNotifications);
router.get("/reviews", requireAdminPermission("reviews"), getReviewsAdmin);
router.post("/reviews/bulk-delete", requireAdminPermission("reviews"), bulkDeleteReviews);
router.patch("/reviews/:id", requireAdminPermission("reviews"), moderateReview);
router.delete("/reviews/:id", requireAdminPermission("reviews"), deleteReviewAdmin);

router.get("/administrators", restrictTo("super-admin"), getAdminList);
router.post("/administrators/bulk-delete", restrictTo("super-admin"), bulkDeleteAdmins);
router.post("/administrators", restrictTo("super-admin"), createAdmin);
router.patch("/administrators/:adminId", restrictTo("super-admin"), updateAdmin);
router.delete("/administrators/:adminId", restrictTo("super-admin"), deleteAdmin);
router.get("/administrator-invitations", restrictTo("super-admin"), getAdminInvitations);
router.post("/administrator-invitations/:invitationId/resend", restrictTo("super-admin"), resendAdminInvitation);
router.post("/administrator-invitations/bulk-delete", restrictTo("super-admin"), bulkRevokeAdminInvitations);
router.delete("/administrator-invitations/:invitationId", restrictTo("super-admin"), revokeAdminInvitation);

export default router;
