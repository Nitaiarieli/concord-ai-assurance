import { deterministicHash } from "./canonical.ts";
import type {
  EdgeContract,
  NodeRecord,
  NormalizedEvent,
  Policy,
  PropagationDecision,
} from "./model.ts";

export function isSecurityEvent(event: NormalizedEvent) {
  return event.securityClassification === "security_revocation" || event.securityClassification === "security_deletion" || event.mutationType === "ACCESS_REVOKED" || event.mutationType === "USER_DEACTIVATED";
}

export async function transformDelta(edge: EdgeContract, event: NormalizedEvent) {
  switch (edge.deltaTransform.kind) {
    case "identity":
      return deterministicHash(event);
    case "permission_epoch":
      return deterministicHash({ eventId: event.eventId, mutationType: event.mutationType, afterVersion: event.afterVersion, security: event.securityClassification });
    case "invalidate_only":
      return deterministicHash({ eventId: event.eventId, invalidate: true, afterVersion: event.afterVersion });
    case "project_metadata":
      return deterministicHash({
        eventId: event.eventId,
        afterVersion: event.afterVersion,
        metadata: Object.fromEntries(edge.deltaTransform.fields.sort().map((field) => [field, event.metadata[field] ?? null])),
      });
  }
}

export async function evaluatePropagationPredicate(
  edge: EdgeContract,
  event: NormalizedEvent,
  destination: NodeRecord,
  transformedDeltaHash: string,
  policy: Policy,
): Promise<{ decision: PropagationDecision; reason: string }> {
  if (edge.evidenceType === "inferred" && (edge.confidence === null || edge.confidence < policy.inferredDependencyThreshold)) {
    return { decision: "UNKNOWN", reason: "Inferred dependency is below the policy evidence threshold." };
  }
  switch (edge.propagationPredicate.kind) {
    case "always":
      return { decision: "PROPAGATE", reason: "The edge contract always propagates." };
    case "security_only":
      return isSecurityEvent(event)
        ? { decision: "PROPAGATE", reason: "A security mutation matches the security dependency." }
        : { decision: "PRUNE", reason: "A non-security mutation cannot affect this security-only edge." };
    case "mutation_in":
      return edge.propagationPredicate.mutationTypes.includes(event.mutationType)
        ? { decision: "PROPAGATE", reason: "The normalized mutation is in the declared propagation set." }
        : { decision: "PRUNE", reason: "The normalized mutation is outside the declared propagation set." };
    case "metadata_field_intersection": {
      const changed = typeof event.metadata.changedFields === "string"
        ? event.metadata.changedFields.split(",").map((field) => field.trim()).filter(Boolean)
        : null;
      if (!changed) return { decision: "UNKNOWN", reason: "The connector did not provide a complete changed-field set." };
      return changed.some((field) => edge.propagationPredicate.fields.includes(field))
        ? { decision: "PROPAGATE", reason: "A changed field intersects the declared dependency fields." }
        : { decision: "PRUNE", reason: "The connector-proven changed fields do not intersect this dependency." };
    }
    case "effective_hash_change":
      return transformedDeltaHash === destination.effectiveStateHash
        ? { decision: "PRUNE", reason: "The deterministic transformed delta proves the downstream effective state is unchanged." }
        : { decision: "PROPAGATE", reason: "The deterministic transformed delta changes the downstream effective state hash." };
    case "connector_declared":
      return event.metadata[`declaration:${edge.propagationPredicate.declarationId}`] === true
        ? { decision: "PROPAGATE", reason: "The versioned connector declaration proves impact." }
        : event.metadata[`declaration:${edge.propagationPredicate.declarationId}`] === false
          ? { decision: "PRUNE", reason: "The versioned connector declaration proves non-impact." }
          : { decision: "UNKNOWN", reason: "The connector declaration is missing for this event." };
  }
}

export type StronglyConnectedComponent = {
  id: string;
  nodeIds: string[];
  cyclic: boolean;
  monotonic: boolean;
};

export function stronglyConnectedComponents(nodes: NodeRecord[], edges: EdgeContract[]): StronglyConnectedComponent[] {
  const nodeIds = [...nodes.map((node) => node.canonicalId)].sort();
  const outgoing = new Map<string, EdgeContract[]>();
  for (const nodeId of nodeIds) outgoing.set(nodeId, []);
  for (const edge of edges) outgoing.get(edge.source)?.push(edge);
  for (const list of outgoing.values()) list.sort((a, b) => a.edgeId.localeCompare(b.edgeId));

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const components: StronglyConnectedComponent[] = [];

  const visit = (nodeId: string) => {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!indices.has(edge.destination)) {
        visit(edge.destination);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(edge.destination)!));
      } else if (onStack.has(edge.destination)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indices.get(edge.destination)!));
      }
    }

    if (lowLinks.get(nodeId) === indices.get(nodeId)) {
      const members: string[] = [];
      while (stack.length) {
        const member = stack.pop()!;
        onStack.delete(member);
        members.push(member);
        if (member === nodeId) break;
      }
      members.sort();
      const memberSet = new Set(members);
      const internalEdges = edges.filter((edge) => memberSet.has(edge.source) && memberSet.has(edge.destination));
      const cyclic = members.length > 1 || internalEdges.some((edge) => edge.source === edge.destination);
      components.push({
        id: `scc:${members.join("|")}`,
        nodeIds: members,
        cyclic,
        monotonic: internalEdges.every((edge) => edge.monotonic),
      });
    }
  };

  for (const nodeId of nodeIds) if (!indices.has(nodeId)) visit(nodeId);
  return components.sort((a, b) => a.id.localeCompare(b.id));
}

export function deterministicPriority(edge: EdgeContract, distance: number, event: NormalizedEvent) {
  const criticalityRank: Record<EdgeContract["criticality"], number> = { security: 0, high: 1, normal: 2, low: 3 };
  return [isSecurityEvent(event) ? 0 : 1, criticalityRank[edge.criticality], distance, edge.destination, edge.edgeId] as const;
}

export function comparePriorities(a: ReturnType<typeof deterministicPriority>, b: ReturnType<typeof deterministicPriority>) {
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}
