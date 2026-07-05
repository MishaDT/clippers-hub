import assert from "node:assert/strict";
import test from "node:test";
import { ratingParties } from "../lib/rating-rules.ts";

test("client rates worker after payment", () => {
  assert.deepEqual(
    ratingParties({ authorId: "client", ownerId: "client", workerId: "worker", status: "PAID" }),
    { subjectId: "worker", authorRole: "CLIENT" }
  );
});

test("worker rates client after payment", () => {
  assert.deepEqual(
    ratingParties({ authorId: "worker", ownerId: "client", workerId: "worker", status: "PAID" }),
    { subjectId: "client", authorRole: "WORKER" }
  );
});

test("rating before payment or by outsider is rejected", () => {
  assert.equal(ratingParties({ authorId: "client", ownerId: "client", workerId: "worker", status: "VERIFIED" }), null);
  assert.equal(ratingParties({ authorId: "other", ownerId: "client", workerId: "worker", status: "PAID" }), null);
});
