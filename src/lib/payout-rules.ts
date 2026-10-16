export const V4_VOTE_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export function objectionRequiresAdminReview(objections: number, sold: number) {
  return sold > 0 && objections * 3 >= sold;
}

export function objectionWindowPasses(objections: number, sold: number) {
  return sold === 0 || objections * 3 < sold;
}

export function cancellationIsOpen(nowMs: number, endsAtMs: number) {
  return nowMs < endsAtMs;
}
