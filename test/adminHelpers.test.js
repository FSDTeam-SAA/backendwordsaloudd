import assert from "node:assert/strict";
import test from "node:test";
import { categoryJson, normalizeCategoryIcon } from "../utils/adminHelpers.js";
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
