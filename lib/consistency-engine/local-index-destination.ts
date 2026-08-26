import { deterministicHash } from "./canonical.ts";
import type { AiDestinationAdapter, ArtifactRegistration, NormalizedSourceObject, RetrievalObservation } from "./connectors.ts";
import type { NodeRecord, NormalizedEvent, RemediationAction, VerificationContract } from "./model.ts";

type IndexRecord = {
  registration: ArtifactRegistration;
  source: NormalizedSourceObject;
  tokens: string[];
  securityEpoch: number;
  blocked: boolean;
};

function tokens(value: string) {
  return [...new Set(value.toLocaleLowerCase("en-US").match(/[a-z0-9]+/g) ?? [])].sort();
}

function intersects(query: string, indexed: string[]) {
  return tokens(query).some((token) => indexed.includes(token));
}

export class DeterministicLocalIndexDestination implements AiDestinationAdapter {
  readonly destinationType = "local_index_record" as const;
  private readonly registrations = new Map<string, ArtifactRegistration>();
  private readonly stagedSources = new Map<string, NormalizedSourceObject>();
  private readonly records = new Map<string, IndexRecord>();
  private readonly receipts = new Map<string, string>();

  async registerArtifact(registration: ArtifactRegistration) {
    this.registrations.set(registration.artifactId, { ...registration, sourceObjectIds: [...registration.sourceObjectIds].sort(), lineageNodeIds: [...registration.lineageNodeIds].sort() });
  }

  async stageSourceObject(source: NormalizedSourceObject) {
    this.stagedSources.set(source.canonicalId, structuredClone(source));
  }

  async seed(source: NormalizedSourceObject, securityEpoch = 1) {
    await this.stageSourceObject(source);
    for (const registration of this.registrations.values()) {
      if (!registration.sourceObjectIds.includes(source.canonicalId)) continue;
      this.records.set(registration.artifactId, {
        registration,
        source: structuredClone(source),
        tokens: tokens(`${source.title} ${source.body}`),
        securityEpoch,
        blocked: false,
      });
    }
  }

  async retrieve(principalRef: string, query: string): Promise<RetrievalObservation[]> {
    const results: RetrievalObservation[] = [];
    for (const record of [...this.records.values()].sort((a, b) => a.registration.artifactId.localeCompare(b.registration.artifactId))) {
      if (record.blocked || record.source.deleted) continue;
      if (!record.source.authorization.completeForEvaluatedPrincipals) continue;
      if (!record.source.authorization.allowedPrincipalRefs.includes(principalRef)) continue;
      if (!intersects(query, record.tokens)) continue;
      results.push({ artifactId: record.registration.artifactId, consumedSourceVersion: record.source.sourceVersion, securityEpoch: record.securityEpoch });
    }
    return results;
  }

  async execute(action: RemediationAction, event: NormalizedEvent, node: NodeRecord) {
    const previous = this.receipts.get(action.idempotencyKey);
    if (previous) return { receipt: previous, externalCalls: 0 };
    const registrations = [...this.registrations.values()].filter((registration) => registration.lineageNodeIds.includes(node.canonicalId));
    for (const registration of registrations) {
      const sourceId = registration.sourceObjectIds[0];
      const source = this.stagedSources.get(sourceId);
      if (!source) throw new Error(`No staged source object for ${sourceId}.`);
      const securityUnknown = event.securityClassification === "security_unknown" || !source.authorization.completeForEvaluatedPrincipals;
      this.records.set(registration.artifactId, {
        registration,
        source: structuredClone(source),
        tokens: source.deleted ? [] : tokens(`${source.title} ${source.body}`),
        securityEpoch: node.securityEpoch,
        blocked: securityUnknown,
      });
    }
    const receipt = `local-index:${(await deterministicHash({ action: action.idempotencyKey, event: event.eventId })).slice(0, 24)}`;
    this.receipts.set(action.idempotencyKey, receipt);
    return { receipt, externalCalls: registrations.length ? 1 : 0 };
  }

  async verify(contract: VerificationContract, event: NormalizedEvent, node: NodeRecord) {
    const registration = [...this.registrations.values()].find((item) => item.lineageNodeIds.includes(node.canonicalId));
    if (!registration) return { retrievalObserved: false, authorizationObserved: false, consumedVersionsObserved: false, externalCalls: 0 };
    const record = this.records.get(registration.artifactId);
    if (!record) return { retrievalObserved: true, authorizationObserved: false, consumedVersionsObserved: false, externalCalls: 1 };
    const actualResults = await this.retrieve(registration.verificationPrincipalRef, registration.verificationQuery);
    const hit = actualResults.find((result) => result.artifactId === registration.artifactId);
    const securityEvent = event.mutationType === "ACCESS_REVOKED" || event.mutationType === "USER_DEACTIVATED" || event.securityClassification === "security_unknown";
    const authorizationObserved = securityEvent ? !hit && !record.blocked : Boolean(hit);
    const consumedVersionsObserved = record.source.sourceVersion.sequence === event.afterVersion.sequence
      && record.source.sourceVersion.authority === event.afterVersion.authority;
    return {
      retrievalObserved: true,
      authorizationObserved: contract.mode === "destination_readback" || contract.mode === "retrieval" ? true : authorizationObserved,
      consumedVersionsObserved,
      externalCalls: contract.mode === "retrieval_and_authorization" ? 2 : 1,
    };
  }

  snapshot() {
    return [...this.records.values()].map((record) => ({
      artifactId: record.registration.artifactId,
      sourceVersion: record.source.sourceVersion,
      permissionStateHash: record.source.authorization.permissionStateHash,
      securityEpoch: record.securityEpoch,
      blocked: record.blocked,
    })).sort((a, b) => a.artifactId.localeCompare(b.artifactId));
  }
}
