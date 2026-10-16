import test from "node:test";
import assert from "node:assert/strict";
import { cancellationIsOpen, objectionRequiresAdminReview, objectionWindowPasses, V4_VOTE_WINDOW_SECONDS } from "./payout-rules.ts";

test("version 4 payout thresholds", () => {
  assert.equal(V4_VOTE_WINDOW_SECONDS, 604800);
  assert.equal(objectionRequiresAdminReview(1, 4), false);
  assert.equal(objectionRequiresAdminReview(1, 3), true);
  assert.equal(objectionRequiresAdminReview(2, 5), true);
  assert.equal(objectionWindowPasses(1, 4), true);
  assert.equal(objectionWindowPasses(1, 3), false);
  assert.equal(objectionWindowPasses(0, 0), true);
});

test("cancellation closes exactly at the event end", () => {
  assert.equal(cancellationIsOpen(999, 1000), true);
  assert.equal(cancellationIsOpen(1000, 1000), false);
  assert.equal(cancellationIsOpen(1001, 1000), false);
});
