import type { DestinationBoundary, NormalizedEvent, SourceVersion } from "./model.ts";

export type SourceObjectKind = "document" | "permission" | "identity" | "structured_record";

export type AuthorizationSnapshot = {
  permissionStateHash: string;
  evaluatedPrincipalRefs: string[];
  allowedPrincipalRefs: string[];
  completeForEvaluatedPrincipals: boolean;
};

export type NormalizedSourceObject = {
  canonicalId: string;
  tenantId: string;
  authority: string;
  externalId: string;
  objectKind: SourceObjectKind;
  title: string;
  body: string;
  sourceVersion: SourceVersion;
  contentHash: string;
  effectiveStateHash: string;
  deleted: boolean;
  authorization: AuthorizationSnapshot;
  observedAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type ConnectorProbe = {
  reachable: boolean;
  connectorKey: string;
  sourceVersion: string | null;
  checkedEndpoints: string[];
  limitations: string[];
};

export interface SourceConnector<RawChange = unknown> {
  readonly connectorKey: string;
  probe(): Promise<ConnectorProbe>;
  readObject(externalId: string, verificationPrincipalRefs?: string[]): Promise<NormalizedSourceObject>;
  normalizeChange(change: RawChange): Promise<NormalizedEvent>;
}

export type ArtifactRegistration = {
  artifactId: string;
  artifactType: "local_index_record" | "vector_record" | "agent_memory" | "cache_entry" | "derived_state";
  destinationId: string;
  sourceObjectIds: string[];
  lineageNodeIds: string[];
  verificationPrincipalRef: string;
  verificationQuery: string;
};

export type RetrievalObservation = {
  artifactId: string;
  consumedSourceVersion: SourceVersion;
  securityEpoch: number;
};

export interface AiDestinationAdapter extends DestinationBoundary {
  readonly destinationType: ArtifactRegistration["artifactType"];
  registerArtifact(registration: ArtifactRegistration): Promise<void>;
  stageSourceObject(source: NormalizedSourceObject): Promise<void>;
  retrieve(principalRef: string, query: string): Promise<RetrievalObservation[]>;
}

export type IntegrationReadiness = {
  connectorContract: "ready";
  sourceAdapter: "ready_for_credentials" | "connected";
  destinationAdapter: "ready" | "configuration_required";
  verification: "ready_for_identity" | "connected";
  mockE2e: "passing" | "failing";
};
