import assert from "node:assert/strict";
import test from "node:test";
import { resolveReviewSkill } from "../controller/review.controller.js";
import { publicRatingStages, visibleReviews } from "../utils/reviewVisibility.js";
import Review from "../model/review.model.js";
import { SKILLS } from "../constants/skills.js";

test("signup defaults contain all 22 trades", () => {
  assert.equal(new Set(SKILLS).size, 22);
  assert.ok(SKILLS.includes("Maid Service"));
  assert.ok(SKILLS.includes("Caterer"));
});

test("multi-trade reviews require an explicitly registered trade", () => {
  const profile = { mainSkill: "Plumber", extraSkills: ["Electrician"] };
  assert.throws(() => resolveReviewSkill(profile), /Provide the skill/);
  assert.throws(() => resolveReviewSkill(profile, "Carpenter"), /Provide the skill/);
  assert.equal(resolveReviewSkill(profile, " Electrician "), "Electrician");
  assert.equal(resolveReviewSkill({ mainSkill: "Plumber" }), "Plumber");
});

test("review uniqueness permits the same client to review separate trades", () => {
  assert.ok(Review.schema.indexes().some(([keys, options]) =>
    options.unique && keys.tradesman === 1 && keys.reviewer === 1 && keys.skill === 1));
  assert.ok(!Review.schema.indexes().some(([keys, options]) =>
    options.unique && keys.tradesman === 1 && keys.reviewer === 1 && !keys.skill));
});

test("public scores scope trade and moderation before sorting and pagination", () => {
  const stages = publicRatingStages("Plumber");
  const match = stages[0].$lookup.pipeline[0].$match;
  assert.equal(match.skill, "Plumber");
  assert.deepEqual(match.$or, visibleReviews().$or);
  assert.deepEqual(match.$expr, { $eq: ["$tradesman", "$$profileId"] });
  assert.equal(publicRatingStages()[0].$lookup.pipeline[0].$match.skill, undefined);
  assert.equal(stages[1].$addFields.ratingCount.$ifNull[1], 0);
});

import express from "express";
import mongoose from "mongoose";
import TradesmanProfile from "../model/tradesmanProfile.model.js";
import { browseTradesmen } from "../controller/tradesman.controller.js";
import { getReviewsForTradesman } from "../controller/review.controller.js";

const serve = async (t, handler) => {
  const app = express();
  app.get("/:tradesmanId", handler);
  app.use((error, req, res, next) => res.status(500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}/${new mongoose.Types.ObjectId()}`;
};

for (const sort of ["rating", "newest", "priceLow"]) {
  test(`browse ${sort} calculates the selected trade score before pagination`, async t => {
    let pipeline;
    t.mock.method(TradesmanProfile, "aggregate", async value => {
      pipeline = value;
      return [{ ratingAverage: 0, ratingCount: 0, isVip: true, vipBySkill: "Electrician" }];
    });
    t.mock.method(TradesmanProfile, "populate", async value => value);
    t.mock.method(TradesmanProfile, "countDocuments", async () => 1);
    const url = await serve(t, browseTradesmen);
    const response = await fetch(`${url}?skill=Plumber&sort=${sort}`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.data[0].ratingCount, 0);
    assert.equal(result.data[0].isVip, false);
    assert.equal(pipeline.find(stage => stage.$lookup).$lookup.pipeline[0].$match.skill, "Plumber");
    assert.ok(pipeline.findIndex(stage => stage.$lookup) < pipeline.findIndex(stage => stage.$sort));
    assert.ok(pipeline.findIndex(stage => stage.$sort) < pipeline.findIndex(stage => Object.hasOwn(stage, "$skip")));
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
}

test("public review requests combine trade filtering with moderation", async t => {
  let filter;
  t.mock.method(Review, "find", value => {
    filter = value;
    return { populate: () => ({ sort: async () => [] }) };
  });
  const url = await serve(t, getReviewsForTradesman);
  const response = await fetch(`${url}?skill=Plumber`);
  assert.equal(response.status, 200);
  assert.equal(filter.skill, "Plumber");
  assert.deepEqual(filter.$or, visibleReviews().$or);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
