import type { ValidityState } from "./model.ts";

const permittedTransitions: Record<ValidityState, ReadonlySet<ValidityState>> = {
  VERIFIED_CURRENT: new Set(["VERIFIED_CURRENT", "BOUNDED_STALE", "PENDING", "INVALID", "BLOCKED_SECURITY", "UNKNOWN"]),
  BOUNDED_STALE: new Set(["BOUNDED_STALE", "PENDING", "INVALID", "BLOCKED_SECURITY", "VERIFICATION_FAILED", "UNKNOWN", "VERIFIED_CURRENT"]),
  PENDING: new Set(["PENDING", "INVALID", "BLOCKED_SECURITY", "VERIFICATION_FAILED", "UNKNOWN", "VERIFIED_CURRENT", "BOUNDED_STALE"]),
  INVALID: new Set(["INVALID", "PENDING", "BLOCKED_SECURITY", "VERIFICATION_FAILED", "UNKNOWN", "VERIFIED_CURRENT"]),
  BLOCKED_SECURITY: new Set(["BLOCKED_SECURITY", "PENDING", "VERIFICATION_FAILED", "VERIFIED_CURRENT"]),
  VERIFICATION_FAILED: new Set(["VERIFICATION_FAILED", "PENDING", "INVALID", "BLOCKED_SECURITY", "UNKNOWN", "VERIFIED_CURRENT"]),
  UNKNOWN: new Set(["UNKNOWN", "PENDING", "INVALID", "BLOCKED_SECURITY", "VERIFICATION_FAILED", "BOUNDED_STALE", "VERIFIED_CURRENT"]),
};

export function canTransition(from: ValidityState, to: ValidityState) {
  return permittedTransitions[from].has(to);
}

export function assertValidityTransition(from: ValidityState, to: ValidityState, verificationSucceeded = false) {
  if (!canTransition(from, to)) throw new Error(`Forbidden validity transition: ${from} -> ${to}.`);
  if (to === "VERIFIED_CURRENT" && !verificationSucceeded) {
    throw new Error("VERIFIED_CURRENT requires successful consumption-boundary verification.");
  }
  if (from === "BLOCKED_SECURITY" && to === "BOUNDED_STALE") {
    throw new Error("A security block cannot be weakened to bounded staleness.");
  }
}

export function transitionValidity(from: ValidityState, to: ValidityState, verificationSucceeded = false) {
  assertValidityTransition(from, to, verificationSucceeded);
  return to;
}

export function describeForbiddenTransitions() {
  return validityStatePairs().filter(([from, to]) => !canTransition(from, to) || (to === "VERIFIED_CURRENT" && from !== "VERIFIED_CURRENT"));
}

function validityStatePairs(): Array<[ValidityState, ValidityState]> {
  const states: ValidityState[] = ["VERIFIED_CURRENT", "BOUNDED_STALE", "PENDING", "INVALID", "BLOCKED_SECURITY", "VERIFICATION_FAILED", "UNKNOWN"];
  return states.flatMap((from) => states.map((to) => [from, to] as [ValidityState, ValidityState]));
}
