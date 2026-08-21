import { deterministicHash } from "./canonical.ts";
import type { DestinationBoundary, EdgeContract, NodeRecord, NormalizedEvent, RemediationAction } from "./model.ts";

type SourceMutation = {
  eventId: string;
  tenantId: string;
  authority: string;
  objectId: string;
  mutationType: NormalizedEvent["mutationType"];
  beforeSequence: number | null;
  afterSequence: number;
  beforeOpaque?: string;
  afterOpaque?: string;
  payload: unknown;
  securityClassification?: NormalizedEvent["securityClassification"];
  logicalTimestamp?: number;
  causalParents?: string[];
  metadata?: NormalizedEvent["metadata"];
};

export class SimulatedDocumentSourceConnector {
  readonly connectorId = "simulated-document-source";
  async normalize(input: SourceMutation): Promise<NormalizedEvent> {
    return normalizeSourceMutation(input);
  }
}

export class SimulatedWorkPermissionConnector {
  readonly connectorId = "simulated-work-permission-source";
  async normalize(input: SourceMutation): Promise<NormalizedEvent> {
    return normalizeSourceMutation(input);
  }
}

async function normalizeSourceMutation(input: SourceMutation): Promise<NormalizedEvent> {
  return {
    eventId: input.eventId,
    tenantId: input.tenantId,
    authority: input.authority,
    objectId: input.objectId,
    mutationType: input.mutationType,
    beforeVersion: input.beforeSequence === null ? null : { authority: input.authority, sequence: input.beforeSequence, opaque: input.beforeOpaque ?? `v${input.beforeSequence}` },
    afterVersion: { authority: input.authority, sequence: input.afterSequence, opaque: input.afterOpaque ?? `v${input.afterSequence}` },
    logicalTimestamp: input.logicalTimestamp ?? input.afterSequence,
    causalParents: input.causalParents ?? [],
    idempotencyKey: `${input.tenantId}:${input.authority}:${input.objectId}:${input.afterSequence}:${input.mutationType}`,
    payloadHash: await deterministicHash(input.payload),
    securityClassification: input.securityClassification ?? "normal",
    metadata: input.metadata ?? {},
  };
}

export type FaultMode = "none" | "crash_before_execution" | "crash_after_execution_before_receipt" | "verification_failure";

export class SimulatedRetrievalBoundary implements DestinationBoundary {
  private receipts = new Map<string, string>();
  private state = new Map<string, { payloadHash: string; securityEpoch: number; authorized: boolean }>();
  faultMode: FaultMode = "none";
  executionAttempts = 0;

  async execute(action: RemediationAction, event: NormalizedEvent, node: NodeRecord) {
    this.executionAttempts += 1;
    if (this.faultMode === "crash_before_execution") {
      this.faultMode = "none";
      throw new Error("Injected crash before execution.");
    }
    const priorReceipt = this.receipts.get(action.idempotencyKey);
    if (priorReceipt) return { receipt: priorReceipt, externalCalls: 0 };
    const receipt = `simulated-receipt:${action.actionId}`;
    this.receipts.set(action.idempotencyKey, receipt);
    this.state.set(node.canonicalId, {
      payloadHash: event.payloadHash,
      securityEpoch: node.securityEpoch,
      authorized: event.mutationType !== "ACCESS_REVOKED" && event.mutationType !== "USER_DEACTIVATED",
    });
    if (this.faultMode === "crash_after_execution_before_receipt") {
      this.faultMode = "none";
      throw new Error("Injected crash after idempotent execution but before receipt commit.");
    }
    return { receipt, externalCalls: 1 };
  }

  async verify(contract: EdgeContract["verificationContract"], event: NormalizedEvent, node: NodeRecord) {
    if (this.faultMode === "verification_failure") {
      this.faultMode = "none";
      return { retrievalObserved: false, authorizationObserved: false, consumedVersionsObserved: false, externalCalls: 1 };
    }
    const state = this.state.get(node.canonicalId);
    const securityEvent = event.mutationType === "ACCESS_REVOKED" || event.mutationType === "USER_DEACTIVATED";
    return {
      retrievalObserved: Boolean(state && state.payloadHash === event.payloadHash),
      authorizationObserved: Boolean(state && state.securityEpoch === node.securityEpoch && (securityEvent ? !state.authorized : state.authorized)),
      consumedVersionsObserved: Boolean(state && state.payloadHash === event.payloadHash),
      externalCalls: contract.mode === "retrieval_and_authorization" ? 2 : 1,
    };
  }
}
