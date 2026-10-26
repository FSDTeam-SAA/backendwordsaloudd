import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import { Writable } from "node:stream";
import User from "../model/user.model.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import Category from "../model/category.model.js";
import AuditLog from "../model/auditLog.model.js";
import Review from "../model/review.model.js";
import { getTradesmanById } from "../controller/tradesman.controller.js";
import { moderateReview } from "../controller/admin.controller.js";
import { updateTradesmanAdmin, resolveContactChangeAdmin } from "../controller/adminProfile.controller.js";
import { profileImagesUpload, workPhotosUpload } from "../middleware/multer.middleware.js";
import { protect, requireAdminPermission } from "../middleware/auth.middleware.js";
import { advertisementDates, advertisementStatus, activeAdvertisementFilter } from "../utils/advertisementHelpers.js";
import { saveProfileWithImages } from "../utils/profileHelpers.js";

const id = () => new mongoose.Types.ObjectId();
const fixture = () => {
  const user = new User({ _id: id(), email: "fixture@example.com", role: "tradesman", firstName: "Old", lastName: "Name", phoneNumber: "111" });
  const profile = new TradesmanProfile({ _id: id(), user: user._id, mainSkill: "Plumbing", extraSkills: [], workPhotos: [] });
  return { user, profile };
};
const findByIdQuery = (value) => ({ populate: async () => value });
const serve = async (t, app) => {
  app.use((error, req, res, next) => res.status(error.statusCode || 400).json({ message: error.message, code: error.code }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
};
const body = (field, mime = "image/jpeg") => {
  const form = new FormData();
  form.append(field, new Blob(["fixture"], { type: mime }), "photo");
  return form;
};

test("photo routes accept both avatar aliases and both work-photo array names", async (t) => {
  const app = express();
  app.post("/profile", profileImagesUpload(true), (req, res) => res.json({ avatar: Boolean(req.file), count: req.workPhotoFiles.length }));
  app.post("/work", workPhotosUpload, (req, res) => res.json({ count: req.workPhotoFiles.length }));
  const url = await serve(t, app);
  for (const field of ["avatar", "profileImage"]) {
    const response = await fetch(`${url}/profile`, { method: "POST", body: body(field, "image/webp") });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).avatar, true);
  }
  for (const field of ["workPhotos", "workPhotos[]"]) {
    const response = await fetch(`${url}/work`, { method: "POST", body: body(field, "image/heic") });
    assert.deepEqual(await response.json(), { count: 1 });
  }
  const video = await fetch(`${url}/profile`, { method: "POST", body: body("avatar", "video/mp4") });
  assert.equal(video.status, 400);
  const duplicate = body("avatar");
  duplicate.append("profileImage", new Blob(["fixture"], { type: "image/png" }), "photo.png");
  assert.equal((await fetch(`${url}/profile`, { method: "POST", body: duplicate })).status, 400);
});

test("profile details exclude moderated reviews and disable response caching", async (t) => {
  const { user, profile } = fixture();
  profile.user = user;
  t.mock.method(TradesmanProfile, "findById", () => findByIdQuery(profile));
  t.mock.method(TradesmanProfile, "updateOne", async () => ({}));
  let filter;
  t.mock.method(Review, "find", (query) => {
    filter = query;
    return { populate: () => ({ sort: () => ({ limit: async () => [] }) }) };
  });
  const app = express();
  app.get("/:id", getTradesmanById);
  const url = await serve(t, app);
  const response = await fetch(`${url}/${profile.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(filter.$or, [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }]);
});

test("review rejection persists status and recalculates only visible ratings", async (t) => {
  const review = { _id: id(), tradesman: id(), save: async () => {} };
  t.mock.method(Review, "findById", async () => review);
  let match;
  t.mock.method(Review, "aggregate", async (pipeline) => { match = pipeline[0].$match; return [{ average: 4, count: 2 }]; });
  let updated;
  t.mock.method(TradesmanProfile, "findByIdAndUpdate", async (key, values) => { updated = values; });
  t.mock.method(AuditLog, "create", async () => ({}));
  const app = express();
  app.use(express.json(), (req, res, next) => { req.user = { _id: id() }; next(); });
  app.patch("/:id", moderateReview);
  const url = await serve(t, app);
  const response = await fetch(`${url}/${review._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected" }) });
  assert.equal(response.status, 200);
  assert.equal(review.moderationStatus, "rejected");
  assert.ok(match.$or);
  assert.deepEqual(updated, { ratingAverage: 4, ratingCount: 2 });
});

test("advertisement scheduling distinguishes expired, future, disabled and running campaigns", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(advertisementStatus({ isActive: true, endDate: "2026-10-25" }, now), "expired");
  assert.equal(advertisementStatus({ isActive: true, startDate: "2026-10-27" }, now), "scheduled");
  assert.equal(advertisementStatus({ isActive: false }, now), "disabled");
  assert.equal(advertisementStatus({ isActive: true }, now), "running");
  const filter = activeAdvertisementFilter("Plumbing", now);
  assert.equal(filter.$and.length, 3);
  assert.deepEqual(filter.$and[0].$or[0], { startDate: null });
  assert.throws(() => advertisementDates("invalid", null), /invalid/);
  assert.throws(() => advertisementDates("2026-10-27", "2026-10-26"), /after/);
});

test("admin profile update validates fields, preserves role, and saves both documents", async (t) => {
  const { user, profile } = fixture();
  t.mock.method(User, "findById", async () => user);
  t.mock.method(TradesmanProfile, "findOne", async () => profile);
  t.mock.method(Category, "estimatedDocumentCount", async () => 1);
  t.mock.method(Category, "find", () => ({ sort: () => ({ select: async () => [{ name: "Plumbing" }] }) }));
  t.mock.method(AuditLog, "create", async () => ({}));
  let saved = 0;
  t.mock.method(user, "save", async () => { saved++; });
  t.mock.method(profile, "save", async () => { saved++; });
  t.mock.method(user.db, "transaction", async (fn) => fn({}));
  const app = express();
  app.use(express.json(), (req, res, next) => { req.user = { _id: id() }; next(); });
  app.patch("/:userId", updateTradesmanAdmin);
  const url = await serve(t, app);
  const update = (values) => fetch(`${url}/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  assert.equal((await update({ phoneNumber: "222", pitch: "Updated pitch", rateAmount: 100 })).status, 200);
  assert.equal(user.phoneNumber, "222");
  assert.equal(profile.pitch, "Updated pitch");
  assert.equal(saved, 2);
  assert.equal((await update({ role: "super-admin" })).status, 400);
  assert.equal(user.role, "tradesman");
  assert.equal((await update({ rateAmount: -1 })).status, 400);
});

for (const action of ["approve", "reject"]) {
  test(`contact change ${action} updates request and only approval changes contact details`, async (t) => {
    const { user, profile } = fixture();
    profile.contactChangeRequest = { requestedName: "New Name", requestedPhoneNumber: "222", status: "pending", requestedAt: new Date("2026-10-26T12:00:00Z") };
    t.mock.method(User, "findById", async () => user);
    t.mock.method(TradesmanProfile, "findOne", async () => profile);
    t.mock.method(user, "save", async () => {});
    t.mock.method(profile, "save", async () => {});
    t.mock.method(user.db, "transaction", async (fn) => fn({}));
    t.mock.method(AuditLog, "create", async () => ({}));
    const app = express();
    app.use(express.json(), (req, res, next) => { req.user = { _id: id() }; next(); });
    app.post("/:userId", resolveContactChangeAdmin);
    const url = await serve(t, app);
    const send = (requestedAt) => fetch(`${url}/${user.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, requestedAt }) });
    assert.equal((await send("2026-10-25")).status, 409);
    assert.equal((await send(profile.contactChangeRequest.requestedAt)).status, 200);
    assert.equal(user.phoneNumber, action === "approve" ? "222" : "111");
    assert.equal(profile.contactChangeRequest.status, action === "approve" ? "resolved" : "rejected");
    assert.equal((await send(profile.contactChangeRequest.requestedAt)).status, 409);
  });
}

test("profile edit permission is enforced on the server", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: id(), role: "admin", tokenVersion: 0, adminPermissions: ["reviews"] }) }));
  const secret = "test-secret";
  t.mock.method(jwt, "verify", () => ({ _id: id(), tokenVersion: 0 }));
  const app = express();
  app.patch("/edit", protect, requireAdminPermission("users"), (req, res) => res.sendStatus(200));
  const url = await serve(t, app);
  const response = await fetch(`${url}/edit`, { method: "PATCH", headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(response.status, 403);
});

test("failed photo save cleans new assets while preserving the previous image", async (t) => {
  const { user } = fixture();
  user.profileImage = { public_id: "old-image", url: "https://example.com/old.jpg" };
  const deleted = [];
  t.mock.method(cloudinary.uploader, "upload_stream", (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) { callback(null, { public_id: "new-image", secure_url: "https://example.com/new.jpg" }); done(); } }));
  t.mock.method(cloudinary.uploader, "destroy", async (asset) => { deleted.push(asset); });
  t.mock.method(user.db, "transaction", async () => { throw new Error("database write failed"); });
  await assert.rejects(saveProfileWithImages({ user, avatar: { buffer: Buffer.from("photo") } }), /database write failed/);
  assert.deepEqual(deleted, ["new-image"]);
});

test("successful photo replacement deletes the old image only after the database commit", async (t) => {
  const { user } = fixture();
  user.profileImage = { public_id: "old-image", url: "https://example.com/old.jpg" };
  const events = [];
  t.mock.method(cloudinary.uploader, "upload_stream", (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) { callback(null, { public_id: "new-image", secure_url: "https://example.com/new.jpg" }); done(); } }));
  t.mock.method(cloudinary.uploader, "destroy", async (asset) => { events.push(`delete:${asset}`); });
  t.mock.method(user, "save", async () => { events.push("save"); });
  t.mock.method(user.db, "transaction", async (fn) => { await fn({}); events.push("commit"); });
  await saveProfileWithImages({ user, avatar: { buffer: Buffer.from("photo") } });
  assert.deepEqual(events, ["save", "commit", "delete:old-image"]);
  assert.equal(user.profileImage.public_id, "new-image");
});

test("work photo total is checked before uploading", async (t) => {
  const { user, profile } = fixture();
  profile.workPhotos = Array.from({ length: 6 }, (_, index) => ({ public_id: String(index), url: `https://example.com/${index}.jpg` }));
  const upload = t.mock.method(cloudinary.uploader, "upload_stream", () => { throw new Error("Must not upload"); });
  await assert.rejects(saveProfileWithImages({ user, profile, workPhotos: [{ buffer: Buffer.from("photo") }] }), /maximum of 6/);
  assert.equal(upload.mock.callCount(), 0);
});
