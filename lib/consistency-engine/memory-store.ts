import type { ConsistencyStore, EdgeContract, NodeRecord, NormalizedEvent, ProofObject, RemediationAction } from "./model.ts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryConsistencyStore implements ConsistencyStore {
  private nodes = new Map<string, NodeRecord>();
  private edges = new Map<string, EdgeContract>();
  private outgoingBySource = new Map<string, EdgeContract[]>();
  private events = new Map<string, NormalizedEvent>();
  private idempotencyKeys = new Map<string, string>();
  private actions = new Map<string, RemediationAction>();
  private actionKeys = new Map<string, string>();
  private proofs = new Map<string, ProofObject>();
  private securityEpochs = new Map<string, number>();

  constructor(seed: { nodes?: NodeRecord[]; edges?: EdgeContract[]; events?: NormalizedEvent[] } = {}) {
    for (const node of seed.nodes ?? []) {
      this.nodes.set(node.canonicalId, clone(node));
      this.securityEpochs.set(node.tenantId, Math.max(this.securityEpochs.get(node.tenantId) ?? 0, node.securityEpoch));
    }
    for (const edge of seed.edges ?? []) {
      this.edges.set(edge.edgeId, clone(edge));
      const key = `${edge.tenantId}:${edge.source}`;
      const outgoing = this.outgoingBySource.get(key) ?? [];
      outgoing.push(clone(edge));
      outgoing.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
      this.outgoingBySource.set(key, outgoing);
    }
    for (const event of seed.events ?? []) {
      this.events.set(event.eventId, clone(event));
      this.idempotencyKeys.set(event.idempotencyKey, event.eventId);
    }
  }

  async getNode(nodeId: string) { return clone(this.nodes.get(nodeId) ?? null); }
  async putNode(node: NodeRecord) { this.nodes.set(node.canonicalId, clone(node)); }
  async listNodes(tenantId: string) { return [...this.nodes.values()].filter((node) => node.tenantId === tenantId).map(clone); }
  async listEdges(tenantId: string) { return [...this.edges.values()].filter((edge) => edge.tenantId === tenantId).map(clone); }
  async outgoingEdges(tenantId: string, nodeId: string) {
    return (this.outgoingBySource.get(`${tenantId}:${nodeId}`) ?? []).map(clone);
  }
  async appendEvent(event: NormalizedEvent) {
    if (this.events.has(event.eventId)) return "duplicate_event_id" as const;
    if (this.idempotencyKeys.has(event.idempotencyKey)) return "duplicate_idempotency_key" as const;
    this.events.set(event.eventId, clone(event));
    this.idempotencyKeys.set(event.idempotencyKey, event.eventId);
    return "appended" as const;
  }
  async listEvents(tenantId: string) {
    return [...this.events.values()]
      .filter((event) => event.tenantId === tenantId)
      .sort((a, b) => a.logicalTimestamp - b.logicalTimestamp || a.eventId.localeCompare(b.eventId))
      .map(clone);
  }
  async hasCausalParent(tenantId: string, eventId: string) {
    return this.events.get(eventId)?.tenantId === tenantId;
  }
  async putAction(action: RemediationAction) {
    const existingId = this.actionKeys.get(action.idempotencyKey);
    if (existingId && existingId !== action.actionId) return;
    this.actions.set(action.actionId, clone(action));
    this.actionKeys.set(action.idempotencyKey, action.actionId);
  }
  async getActionByIdempotencyKey(key: string) {
    const id = this.actionKeys.get(key);
    return clone(id ? this.actions.get(id) ?? null : null);
  }
  async listActionsForEvent(eventId: string) {
    return [...this.actions.values()].filter((action) => action.eventId === eventId).sort((a, b) => a.actionId.localeCompare(b.actionId)).map(clone);
  }
  async putProof(proof: ProofObject) { this.proofs.set(proof.proofId, clone(proof)); }
  async latestProof(tenantId: string, artifactId: string) {
    return clone([...this.proofs.values()]
      .filter((proof) => proof.tenantId === tenantId && proof.artifactId === artifactId)
      .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0] ?? null);
  }
  async getSecurityEpoch(tenantId: string) { return this.securityEpochs.get(tenantId) ?? 0; }
  async advanceSecurityEpoch(tenantId: string) {
    const next = (this.securityEpochs.get(tenantId) ?? 0) + 1;
    this.securityEpochs.set(tenantId, next);
    return next;
  }

  snapshot() {
    return {
      nodes: [...this.nodes.values()].map(clone).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)),
      events: [...this.events.values()].map(clone).sort((a, b) => a.eventId.localeCompare(b.eventId)),
      actions: [...this.actions.values()].map(clone).sort((a, b) => a.actionId.localeCompare(b.actionId)),
      proofs: [...this.proofs.values()].map(clone).sort((a, b) => a.proofId.localeCompare(b.proofId)),
      securityEpochs: [...this.securityEpochs.entries()].sort(([a], [b]) => a.localeCompare(b)),
    };
  }
}
