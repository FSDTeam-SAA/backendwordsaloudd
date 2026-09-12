import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVerificationQueuePipeline,
  serializeVerificationRecord,
} from "../utils/verificationQueue.js";

test("verification queue joins profiles to tradesman users before pagination and count", () => {
  const pipeline = buildVerificationQueuePipeline({
    status: "pending",
    page: 2,
    limit: 10,
  });

  assert.deepEqual(pipeline[0], { $match: { verificationStatus: "pending" } });
  assert.equal(pipeline[1].$lookup.as, "queueUser");
  assert.deepEqual(pipeline[3], { $match: { "queueUser.role": "tradesman" } });
  assert.deepEqual(pipeline.at(-1).$facet.records, [{ $skip: 10 }, { $limit: 10 }]);
  assert.deepEqual(pipeline.at(-1).$facet.count, [{ $count: "total" }]);
});

test("verification records expose safe user data and the matching profile", () => {
  const record = {
    _id: "profile-1",
    user: "user-1",
    verificationStatus: "pending",
    profileViews: [new Date()],
    queueUser: {
      _id: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      role: "tradesman",
      password: "secret",
    },
  };

  const result = serializeVerificationRecord(record);
  assert.equal(result.name, "Jane Doe");
  assert.equal(result.tradesmanProfile.verificationStatus, "pending");
  assert.equal(result.password, undefined);
  assert.equal(result.tradesmanProfile.profileViews, undefined);
});
