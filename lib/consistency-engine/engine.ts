import { deterministicHash } from "./canonical.ts";
import {
  comparePriorities,
  deterministicPriority,
  evaluatePropagationPredicate,
  isSecurityEvent,
  stronglyConnectedComponents,
  transformDelta,
} from "./graph.ts";
import { transitionValidity } from "./state-machine.ts";
import { DeterministicMinHeap } from "./priority-queue.ts";
import type {
  ConsistencyStore,
  DestinationBoundary,
  EdgeContract,
  EventClassification,
  ImpactRecord,
  NodeRecord,
  NormalizedEvent,
  Policy,
  ProcessResult,
  ProofObject,
  RemediationAction,
} from "./model.ts";

type WorkItem = { edge: EdgeContract; distance: number; sourceHash: string };

const defaultCost = {
  BLOCK: { computeUnits: 1, networkCalls: 0, verificationCalls: 0, estimatedMinorUnits: 0 },
  INVALIDATE: { computeUnits: 1, networkCalls: 1, verificationCalls: 0, estimatedMinorUnits: 1 },
  REBUILD: { computeUnits: 8, networkCalls: 2, verificationCalls: 0, estimatedMinorUnits: 8 },
  REAUTHORIZE: { computeUnits: 3, networkCalls: 2, verificationCalls: 0, estimatedMinorUnits: 3 },
  VERIFY: { computeUnits: 1, networkCalls: 1, verificationCalls: 1, estimatedMinorUnits: 2 },
  FULL_SCC_RECOMPUTE: { computeUnits: 20, networkCalls: 4, verificationCalls: 0, estimatedMinorUnits: 20 },
} as const;

export class DeterministicConsistencyEngine {
  private readonly store: ConsistencyStore;
  private readonly boundary: DestinationBoundary;
  private readonly policy: Policy;
  private readonly now: () => string;

  constructor(
    store: ConsistencyStore,
    boundary: DestinationBoundary,
    policy: Policy,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.boundary = boundary;
    this.policy = policy;
    this.now = now;
  }

  async process(event: NormalizedEvent): Promise<ProcessResult> {
    const append = await this.store.appendEvent(event);
    if (append !== "appended") return this.emptyResult(event.eventId, "duplicate");

    const source = await this.store.getNode(event.objectId);
    if (!source || source.tenantId !== event.tenantId || !source.authoritative) {
      return this.emptyResult(event.eventId, "out_of_order");
    }

    const classification = await this.classifyEvent(event, source);
    const securityEvent = isSecurityEvent(event);

    const activeSecurityEpoch = securityEvent
      ? await this.store.advanceSecurityEpoch(event.tenantId)
      : await this.store.getSecurityEpoch(event.tenantId);
    if (classification === "stale" && !securityEvent) return this.emptyResult(event.eventId, classification);

    const updatedSource = {
      ...source,
      sourceVersion: event.afterVersion.sequence >= (source.sourceVersion?.sequence ?? -1) ? event.afterVersion : source.sourceVersion,
      effectiveStateHash: event.payloadHash,
      validityState: classification === "concurrent" || classification === "out_of_order" ? "UNKNOWN" as const : source.validityState,
      securityEpoch: securityEvent ? activeSecurityEpoch : source.securityEpoch,
    };
    await this.store.putNode(updatedSource);

    const queue = new DeterministicMinHeap<WorkItem>((a, b) => comparePriorities(deterministicPriority(a.edge, a.distance, event), deterministicPriority(b.edge, b.distance, event)));
    for (const edge of await this.store.outgoingEdges(event.tenantId, event.objectId)) {
      queue.push({ edge, distance: 1, sourceHash: event.payloadHash });
    }
    const consideredEdges = new Map<string, EdgeContract>();
    const impacts: ImpactRecord[] = [];
    const impactedNodes = new Map<string, NodeRecord>();
    const blockedNodes = new Set<string>();
    const expanded = new Set<string>();
    const nonMonotonicSccs = new Set<string>();
    let predicateEvaluations = 0;
    let overPropagationCount = 0;
    let prunedCount = 0;
    let sccIterations = 0;

    while (queue.size) {
      const item = queue.pop()!;
      consideredEdges.set(item.edge.edgeId, item.edge);
      const destination = await this.store.getNode(item.edge.destination);
      if (!destination || destination.tenantId !== event.tenantId) continue;
      const transformedDeltaHash = await transformDelta(item.edge, event);
      const evaluation = await evaluatePropagationPredicate(item.edge, event, destination, transformedDeltaHash, this.policy);
      predicateEvaluations += 1;
      let decision = evaluation.decision;
      let reason = evaluation.reason;
      const hardInvariant = securityEvent || destination.policyClass === "hard_security" || item.edge.criticality === "security";

      if (decision === "UNKNOWN") {
        if (hardInvariant || item.edge.behaviorOnUnknown !== "allow_bounded_stale") {
          decision = "PROPAGATE";
          reason = `${reason} UNKNOWN was conservatively propagated.`;
          overPropagationCount += 1;
        } else {
          reason = `${reason} The explicit non-security policy permits bounded staleness, but does not certify freshness.`;
        }
      }

      impacts.push({
        nodeId: destination.canonicalId,
        incomingEdgeId: item.edge.edgeId,
        decision,
        reason,
        transformedDeltaHash,
        effectiveStateHash: destination.effectiveStateHash,
        distance: item.distance,
      });

      if (decision === "PRUNE") {
        prunedCount += 1;
        continue;
      }
      if (decision === "UNKNOWN") {
        const bounded = { ...destination, validityState: transitionValidity(destination.validityState, "BOUNDED_STALE") };
        await this.store.putNode(bounded);
        impactedNodes.set(bounded.canonicalId, bounded);
        continue;
      }

      const targetState = securityEvent ? "BLOCKED_SECURITY" as const : "INVALID" as const;
      const nextNode: NodeRecord = {
        ...destination,
        effectiveStateHash: transformedDeltaHash,
        validityState: transitionValidity(destination.validityState, targetState),
        securityEpoch: securityEvent ? activeSecurityEpoch : destination.securityEpoch,
        provenance: [
          ...destination.provenance.filter((atom) => atom.authority !== event.authority),
          { authority: event.authority, objectId: event.objectId, sourceVersion: event.afterVersion, evidenceType: item.edge.evidenceType, edgeId: item.edge.edgeId },
        ].sort((a, b) => a.authority.localeCompare(b.authority) || a.objectId.localeCompare(b.objectId)),
        lastVerifiedAt: null,
      };
      await this.store.putNode(nextNode);
      impactedNodes.set(nextNode.canonicalId, nextNode);
      if (securityEvent) blockedNodes.add(nextNode.canonicalId);

      const expansionKey = `${item.edge.edgeId}:${nextNode.canonicalId}`;
      if (expanded.has(expansionKey)) continue;
      expanded.add(expansionKey);
      for (const edge of await this.store.outgoingEdges(event.tenantId, nextNode.canonicalId)) {
        queue.push({ edge, distance: item.distance + 1, sourceHash: transformedDeltaHash });
      }
    }

    const edges = [...consideredEdges.values()];
    const components = stronglyConnectedComponents([...impactedNodes.values()], edges);
    for (const component of components.filter((candidate) => candidate.cyclic)) {
      if (component.monotonic) sccIterations = Math.max(sccIterations, 1);
      else nonMonotonicSccs.add(component.id);
    }
    const actions = await this.plan(event, [...impactedNodes.values()], edges, nonMonotonicSccs);
    for (const action of actions) await this.store.putAction(action);
    const { proofs, externalCalls } = await this.executeAndVerify(event, actions, impactedNodes, edges);
    return {
      eventId: event.eventId,
      classification,
      affectedNodes: [...impactedNodes.keys()].sort(),
      blockedNodes: [...blockedNodes].sort(),
      impacts,
      actions,
      proofs,
      overPropagationCount,
      prunedCount,
      predicateEvaluations,
      sccIterations,
      externalCalls,
    };
  }

  async recover(event: NormalizedEvent): Promise<ProcessResult> {
    const actions = (await this.store.listActionsForEvent(event.eventId)).filter((action) => action.status !== "verified");
    if (!actions.length) return this.emptyResult(event.eventId, "duplicate");
    const impactedNodes = new Map<string, NodeRecord>();
    for (const action of actions) {
      const node = await this.store.getNode(action.nodeId);
      if (node) impactedNodes.set(node.canonicalId, node);
    }
    const edges = await this.store.listEdges(event.tenantId);
    const { proofs, externalCalls } = await this.executeAndVerify(event, actions, impactedNodes, edges);
    return {
      eventId: event.eventId,
      classification: "duplicate",
      affectedNodes: [...impactedNodes.keys()].sort(),
      blockedNodes: [...impactedNodes.values()].filter((node) => node.validityState === "BLOCKED_SECURITY").map((node) => node.canonicalId).sort(),
      impacts: [],
      actions,
      proofs,
      overPropagationCount: 0,
      prunedCount: 0,
      predicateEvaluations: 0,
      sccIterations: 0,
      externalCalls,
    };
  }

  private async classifyEvent(event: NormalizedEvent, source: NodeRecord): Promise<EventClassification> {
    const current = source.sourceVersion;
    if (event.causalParents.length && !(await Promise.all(event.causalParents.map((parent) => this.store.hasCausalParent(event.tenantId, parent)))).every(Boolean)) {
      return "out_of_order";
    }
    if (!current) return "new";
    if (event.afterVersion.sequence < current.sequence) return "stale";
    if (event.afterVersion.sequence === current.sequence && event.afterVersion.opaque !== current.opaque) return "concurrent";
    if (event.beforeVersion && event.beforeVersion.sequence < current.sequence && event.afterVersion.sequence > current.sequence) return "out_of_order";
    return "new";
  }

  private async plan(event: NormalizedEvent, nodes: NodeRecord[], edges: EdgeContract[], nonMonotonicSccs: Set<string>) {
    const security = isSecurityEvent(event);
    const actions: RemediationAction[] = [];
    const nodeSet = new Set(nodes.map((node) => node.canonicalId));
    const oversized = nodes.length > this.policy.maxFanout;
    for (const node of [...nodes].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId))) {
      const kind: RemediationAction["kind"] = security
        ? "REAUTHORIZE"
        : oversized || [...nonMonotonicSccs].some((id) => id.includes(node.canonicalId))
          ? "FULL_SCC_RECOMPUTE"
          : "REBUILD";
      const actionId = `action:${(await deterministicHash({ eventId: event.eventId, nodeId: node.canonicalId, kind })).slice(0, 24)}`;
      const dependencies = edges
        .filter((edge) => edge.destination === node.canonicalId && nodeSet.has(edge.source))
        .map((edge) => edge.source)
        .sort();
      actions.push({
        actionId,
        eventId: event.eventId,
        idempotencyKey: `${event.tenantId}:${event.idempotencyKey}:${node.canonicalId}:${kind}`,
        nodeId: node.canonicalId,
        kind,
        dependsOn: dependencies,
        mandatory: security || node.policyClass !== "bounded_staleness",
        cost: defaultCost[kind],
        status: "planned",
      });
    }
    return actions;
  }

  private async executeAndVerify(event: NormalizedEvent, actions: RemediationAction[], nodes: Map<string, NodeRecord>, edges: EdgeContract[]) {
    const proofs: ProofObject[] = [];
    let externalCalls = 0;
    const completed = new Set<string>();
    const pending = [...actions];
    while (pending.length) {
      pending.sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.actionId.localeCompare(b.actionId));
      const action = pending.find((candidate) => candidate.dependsOn.every((nodeId) => !nodes.has(nodeId) || completed.has(nodeId))) ?? pending[0];
      pending.splice(pending.indexOf(action), 1);
      const node = nodes.get(action.nodeId)!;
      const existing = await this.store.getActionByIdempotencyKey(action.idempotencyKey);
      let receipt: string;
      if (existing?.status === "verified") {
        receipt = `reused:${existing.actionId}`;
      } else {
        const execution = await this.boundary.execute(action, event, node);
        receipt = execution.receipt;
        externalCalls += execution.externalCalls;
        action.status = "executed";
        await this.store.putAction(action);
      }

      const contract = edges
        .filter((edge) => edge.destination === node.canonicalId)
        .sort((a, b) => a.edgeId.localeCompare(b.edgeId))[0]?.verificationContract ?? {
          mode: "retrieval_and_authorization" as const,
          boundaryId: "default-consumption-boundary",
          requireConsumedVersions: true,
        };
      const observation = await this.boundary.verify(contract, event, node);
      externalCalls += observation.externalCalls;
      const verified = observation.retrievalObserved
        && (contract.mode !== "authorization" && contract.mode !== "retrieval_and_authorization" || observation.authorizationObserved)
        && (!contract.requireConsumedVersions || observation.consumedVersionsObserved);
      const proofWithoutHash = {
        proofId: `proof:${event.eventId}:${node.canonicalId}`,
        tenantId: event.tenantId,
        eventId: event.eventId,
        artifactId: node.canonicalId,
        policyVersion: this.policy.policyVersion,
        securityEpoch: node.securityEpoch,
        authoritativeVersions: [...new Map([
          ...node.provenance.map((atom) => atom.sourceVersion),
          event.afterVersion,
        ].map((version) => [version.authority, version])).values()].sort((a, b) => a.authority.localeCompare(b.authority)),
        actionReceipts: [receipt],
        verificationContract: contract,
        retrievalObserved: observation.retrievalObserved,
        authorizationObserved: observation.authorizationObserved,
        consumedVersionsObserved: observation.consumedVersionsObserved,
        result: verified ? "verified" as const : "failed" as const,
        verifiedAt: this.now(),
      };
      const proof: ProofObject = { ...proofWithoutHash, proofHash: await deterministicHash(proofWithoutHash) };
      proofs.push(proof);
      await this.store.putProof(proof);
      action.status = verified ? "verified" : "failed";
      await this.store.putAction(action);
      const current = await this.store.getNode(node.canonicalId);
      if (current) {
        const state = verified
          ? transitionValidity(current.validityState, "VERIFIED_CURRENT", true)
          : isSecurityEvent(event)
            ? "BLOCKED_SECURITY" as const
            : transitionValidity(current.validityState, "VERIFICATION_FAILED");
        await this.store.putNode({ ...current, validityState: state, lastVerifiedAt: verified ? proof.verifiedAt : null });
      }
      if (verified) completed.add(node.canonicalId);
    }
    return { proofs, externalCalls };
  }

  private emptyResult(eventId: string, classification: EventClassification): ProcessResult {
    return { eventId, classification, affectedNodes: [], blockedNodes: [], impacts: [], actions: [], proofs: [], overPropagationCount: 0, prunedCount: 0, predicateEvaluations: 0, sccIterations: 0, externalCalls: 0 };
  }
}
