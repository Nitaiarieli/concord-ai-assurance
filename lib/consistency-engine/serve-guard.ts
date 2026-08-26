import type { ConsistencyStore, Policy, SourceVersion } from "./model.ts";

export type ServeRequest = {
  tenantId: string;
  artifactId: string;
  policyVersion: string;
  securityEpoch: number;
  requiredVersions: SourceVersion[];
  requestedFreshness: "current" | "bounded_stale";
};

export async function evaluateServeGuard(store: ConsistencyStore, policy: Policy, request: ServeRequest) {
  const node = await store.getNode(request.artifactId);
  if (!node || node.tenantId !== request.tenantId) return { decision: "BLOCK" as const, reason: "Artifact is outside the registered tenant boundary." };
  const currentSecurityEpoch = await store.getSecurityEpoch(request.tenantId);
  if (request.policyVersion !== policy.policyVersion) return { decision: "BLOCK" as const, reason: "Request policy version is stale." };
  if (request.securityEpoch !== currentSecurityEpoch || node.securityEpoch !== currentSecurityEpoch) return { decision: "BLOCK" as const, reason: "Request or artifact security epoch is stale." };
  if (node.validityState === "BLOCKED_SECURITY" || node.validityState === "INVALID" || node.validityState === "PENDING" || node.validityState === "UNKNOWN" || node.validityState === "VERIFICATION_FAILED") {
    return { decision: "BLOCK" as const, reason: `Artifact state ${node.validityState} is not serveable.` };
  }
  if (request.requestedFreshness === "bounded_stale" && !policy.allowedFreshnessClasses.includes("bounded_stale")) {
    return { decision: "BLOCK" as const, reason: "Bounded staleness is not allowed by policy." };
  }
  const proof = await store.latestProof(request.tenantId, request.artifactId);
  if (!proof || proof.result !== "verified") return { decision: "FALLBACK_AUTHORITY" as const, reason: "No successful consumption-boundary proof exists." };
  if (proof.policyVersion !== policy.policyVersion || proof.securityEpoch !== node.securityEpoch) {
    return { decision: "BLOCK" as const, reason: "Proof does not match the active policy or security epoch." };
  }
  const authoritativeNodes = (await store.listNodes(request.tenantId)).filter((candidate) => candidate.authoritative && candidate.sourceVersion);
  const currentVersions = node.requiredAuthorities.map((authority) => authoritativeNodes.find((candidate) => candidate.sourceVersion?.authority === authority)?.sourceVersion ?? null);
  if (currentVersions.some((version) => !version)) return { decision: "BLOCK" as const, reason: "A required authoritative version is unavailable." };
  const requestVersions = new Map(request.requiredVersions.map((version) => [version.authority, `${version.sequence}:${version.opaque}`]));
  if (!currentVersions.every((version) => requestVersions.get(version!.authority) === `${version!.sequence}:${version!.opaque}`)) {
    return { decision: "BLOCK" as const, reason: "Request does not match every current authoritative source version." };
  }
  const proofVersions = new Map(proof.authoritativeVersions.map((version) => [`${version.authority}:${version.sequence}:${version.opaque}`, true]));
  if (!currentVersions.every((version) => proofVersions.has(`${version!.authority}:${version!.sequence}:${version!.opaque}`))) {
    return { decision: "FALLBACK_AUTHORITY" as const, reason: "Proof does not cover every required authoritative version." };
  }
  if (!proof.retrievalObserved || !proof.authorizationObserved || !proof.consumedVersionsObserved) {
    return { decision: "BLOCK" as const, reason: "Proof does not include the actual AI consumption boundary." };
  }
  return { decision: "ALLOW" as const, reason: "Current policy, security epoch, authoritative versions, and boundary proof all match." };
}
