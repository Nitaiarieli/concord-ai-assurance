import { evaluatePropagationPredicate, isSecurityEvent, transformDelta } from "./graph.ts";
import type { EdgeContract, NodeRecord, NormalizedEvent, Policy } from "./model.ts";

export async function recomputeAffectedFromScratch(
  nodes: NodeRecord[],
  edges: EdgeContract[],
  event: NormalizedEvent,
  policy: Policy,
) {
  const nodeById = new Map(nodes.map((node) => [node.canonicalId, node]));
  const impacted = new Set<string>([event.objectId]);
  const conservative = new Set<string>();
  let changed = true;
  let scans = 0;
  const scanLimit = Math.max(1, nodes.length * Math.max(1, edges.length + 1));
  while (changed && scans < scanLimit) {
    changed = false;
    scans += 1;
    for (const edge of [...edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId))) {
      if (!impacted.has(edge.source) || impacted.has(edge.destination)) continue;
      const destination = nodeById.get(edge.destination);
      if (!destination) continue;
      const transformed = await transformDelta(edge, event);
      const evaluation = await evaluatePropagationPredicate(edge, event, destination, transformed, policy);
      const hard = isSecurityEvent(event) || edge.criticality === "security" || destination.policyClass === "hard_security";
      if (evaluation.decision === "PROPAGATE" || evaluation.decision === "UNKNOWN" && (hard || edge.behaviorOnUnknown !== "allow_bounded_stale")) {
        impacted.add(edge.destination);
        if (evaluation.decision === "UNKNOWN") conservative.add(edge.destination);
        changed = true;
      }
    }
  }
  return {
    affectedNodes: [...impacted].filter((nodeId) => nodeId !== event.objectId).sort(),
    conservativeNodes: [...conservative].sort(),
    fullGraphNodeScans: scans * nodes.length,
    fullGraphEdgeScans: scans * edges.length,
    terminated: scans < scanLimit || !changed,
  };
}
