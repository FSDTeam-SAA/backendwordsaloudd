import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryJson,
  NEW_CATEGORY_BADGE_DAYS,
  newCategoryUntil,
  normalizeCategoryIcon,
  publicCategoryJson,
} from "../utils/adminHelpers.js";
import { hashInvitationToken } from "../utils/adminInvitation.js";
import TradesmanProfile from "../model/tradesmanProfile.model.js";

test("category icons accept emoji and HTTPS URLs", () => {
  assert.equal(normalizeCategoryIcon(" 🔧 "), "🔧");
  assert.equal(normalizeCategoryIcon("https://example.com/icon.svg"), "https://example.com/icon.svg");
});

test("category icons reject raw SVG, text, and insecure URLs", () => {
  assert.throws(() => normalizeCategoryIcon("<svg></svg>"));
  assert.throws(() => normalizeCategoryIcon("hammer"));
  assert.throws(() => normalizeCategoryIcon("http://example.com/icon.svg"));
});

test("category JSON exposes the active NEW window", () => {
  assert.equal(categoryJson({ name: "New", newUntil: new Date(Date.now() + 60_000) }).isNew, true);
  assert.equal(categoryJson({ name: "Old", newUntil: new Date(Date.now() - 60_000) }).isNew, false);
  assert.equal(categoryJson({ name: "Legacy", newUntil: null }).isNew, false);
});

test("new category badges last for 30 days", () => {
  const createdAt = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(NEW_CATEGORY_BADGE_DAYS, 30);
  assert.equal(newCategoryUntil(createdAt).toISOString(), "2026-09-14T00:00:00.000Z");
});

test("public category cards do not expose VIP presentation fields", () => {
  const value = publicCategoryJson({
    name: "Plumber",
    icon: "🔧",
    newUntil: null,
  }, 4);

  assert.equal(value.skill, "Plumber");
  assert.equal(value.tradesmanCount, 4);
  assert.equal("listedCount" in value, false);
  assert.equal("vipCount" in value, false);
  assert.equal("isVerified" in value, false);
});

test("administrator invitation tokens are stored as deterministic hashes", () => {
  const token = "a".repeat(64);
  assert.equal(hashInvitationToken(token), hashInvitationToken(token));
  assert.notEqual(hashInvitationToken(token), token);
  assert.notEqual(hashInvitationToken(token), hashInvitationToken("b".repeat(64)));
});

test("tradesman profiles expose a dedicated VIP skill", () => {
  const profile = new TradesmanProfile({
    user: "507f1f77bcf86cd799439011",
    mainSkill: "Plumber",
    extraSkills: ["Computer Tech"],
    vipBySkill: "Computer Tech",
    isVip: true,
  });

  assert.equal(profile.mainSkill, "Plumber");
  assert.deepEqual(profile.extraSkills, ["Computer Tech"]);
  assert.equal(profile.vipBySkill, "Computer Tech");
});

test("VIP profiles cannot be saved without a category", () => {
  const profile = new TradesmanProfile({
    user: "507f1f77bcf86cd799439012",
    mainSkill: "Plumber",
    isVip: true,
  });

  assert.equal(profile.validateSync()?.errors.vipBySkill?.message, "VIP category is required");
});
