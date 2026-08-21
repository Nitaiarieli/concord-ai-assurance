import { deterministicHash } from "./canonical.ts";
import type { ConnectorProbe, NormalizedSourceObject, SourceConnector } from "./connectors.ts";
import type { MutationType, NormalizedEvent, SecurityClassification } from "./model.ts";

export type BookStackConnectionConfig = {
  tenantId: string;
  connectionId: string;
  apiEndpoint: string;
  credentialReference: string;
};

export type BookStackApiCredential = { tokenId: string; tokenSecret: string };
export interface BookStackCredentialProvider {
  resolve(reference: string): Promise<BookStackApiCredential>;
}

export interface BookStackIdentityVerifier {
  canReadPage(apiEndpoint: string, pageId: string, principalRef: string): Promise<boolean>;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type BookStackPage = {
  id: number;
  book_id: number;
  chapter_id: number | null;
  name: string;
  slug: string;
  html?: string;
  markdown?: string;
  revision_count?: number;
  updated_at: string;
};

type BookStackPermissionResponse = {
  owner?: { id?: number } | null;
  role_permissions?: Array<{ role_id: number; view: boolean; create: boolean; update: boolean; delete: boolean }>;
  fallback_permissions?: { inheriting: boolean; view: boolean | null; create: boolean | null; update: boolean | null; delete: boolean | null };
};

export type BookStackWebhookPayload = {
  event: string;
  text?: string;
  triggered_at?: string;
  triggered_by?: { id?: number; name?: string };
  url?: string;
  related_item?: { id?: number; type?: string; name?: string };
  webhook_id?: string | number;
};

export type BookStackReconciledChange = {
  eventId: string;
  pageId: string;
  mutationType: MutationType;
  beforeSequence: number | null;
  afterSequence: number;
  logicalTimestamp: number;
  payloadHash: string;
  changedFields: string[] | null;
  affectedPrincipalRefs: string[];
  securityClassification: SecurityClassification;
  causalParents?: string[];
};

export type BookStackWebhookObservation = {
  eventId: string;
  eventName: string;
  pageId: string | null;
  occurredAt: string;
  requiresApiReconciliation: true;
};

function normalizedEndpoint(value: string) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("BookStack endpoint must use HTTP or HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in the BookStack endpoint.");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/api$/, "");
  return url.toString().replace(/\/$/, "");
}

function plainText(page: BookStackPage) {
  if (typeof page.markdown === "string" && page.markdown.trim()) return page.markdown;
  return (page.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function inspectBookStackWebhook(payload: BookStackWebhookPayload): BookStackWebhookObservation {
  if (!payload || typeof payload.event !== "string" || !payload.event.trim()) throw new Error("BookStack webhook event is required.");
  const occurredAt = payload.triggered_at && !Number.isNaN(Date.parse(payload.triggered_at))
    ? new Date(payload.triggered_at).toISOString()
    : new Date(0).toISOString();
  const pageId = payload.related_item?.type === "page" && Number.isSafeInteger(payload.related_item.id)
    ? String(payload.related_item.id)
    : payload.url?.match(/\/page\/?(\d+)(?:\/|$)/)?.[1] ?? null;
  return {
    eventId: String(payload.webhook_id ?? `${payload.event}:${pageId ?? "unknown"}:${occurredAt}`),
    eventName: payload.event,
    pageId,
    occurredAt,
    requiresApiReconciliation: true,
  };
}

export class BookStackConnector implements SourceConnector<BookStackReconciledChange> {
  readonly connectorKey = "bookstack";
  readonly authority: string;
  private readonly endpoint: string;
  private readonly config: BookStackConnectionConfig;
  private readonly credentials: BookStackCredentialProvider;
  private readonly identityVerifier: BookStackIdentityVerifier | undefined;
  private readonly fetcher: FetchLike;

  constructor(
    config: BookStackConnectionConfig,
    credentials: BookStackCredentialProvider,
    identityVerifier?: BookStackIdentityVerifier,
    fetcher: FetchLike = fetch,
  ) {
    this.config = config;
    this.credentials = credentials;
    this.identityVerifier = identityVerifier;
    this.fetcher = fetcher;
    this.endpoint = normalizedEndpoint(config.apiEndpoint);
    this.authority = `bookstack:${config.connectionId}`;
  }

  async probe(): Promise<ConnectorProbe> {
    const system = await this.getJson<{ version?: string }>("/api/system");
    return {
      reachable: true,
      connectorKey: this.connectorKey,
      sourceVersion: system.version ?? null,
      checkedEndpoints: ["/api/system"],
      limitations: [
        "Content-permissions exposes configured overrides, not complete effective authorization.",
        "Webhook delivery must be reconciled with API state and an audit cursor.",
      ],
    };
  }

  async readObject(externalId: string, verificationPrincipalRefs: string[] = []): Promise<NormalizedSourceObject> {
    if (!/^\d+$/.test(externalId)) throw new Error("BookStack page id must be numeric.");
    const [page, permissions] = await Promise.all([
      this.getJson<BookStackPage>(`/api/pages/${externalId}`),
      this.getJson<BookStackPermissionResponse>(`/api/content-permissions/page/${externalId}`),
    ]);
    const body = plainText(page);
    const contentHash = await deterministicHash({ name: page.name, body });
    const permissionStateHash = await deterministicHash(permissions);
    const evaluatedPrincipalRefs = [...new Set(verificationPrincipalRefs)].sort();
    const allowedPrincipalRefs: string[] = [];
    if (this.identityVerifier) {
      for (const principalRef of evaluatedPrincipalRefs) {
        if (await this.identityVerifier.canReadPage(this.endpoint, externalId, principalRef)) allowedPrincipalRefs.push(principalRef);
      }
    }
    const sequence = Number.isSafeInteger(page.revision_count) ? Number(page.revision_count) : Math.max(0, Math.floor(Date.parse(page.updated_at) / 1000));
    const sourceVersion = { authority: this.authority, sequence, opaque: `${page.updated_at}:${contentHash.slice(0, 16)}:${permissionStateHash.slice(0, 16)}` };
    return {
      canonicalId: `bookstack:page:${page.id}`,
      tenantId: this.config.tenantId,
      authority: this.authority,
      externalId: String(page.id),
      objectKind: "document",
      title: page.name,
      body,
      sourceVersion,
      contentHash,
      effectiveStateHash: await deterministicHash({ contentHash, permissionStateHash }),
      deleted: false,
      authorization: {
        permissionStateHash,
        evaluatedPrincipalRefs,
        allowedPrincipalRefs,
        completeForEvaluatedPrincipals: Boolean(this.identityVerifier),
      },
      observedAt: new Date(page.updated_at).toISOString(),
      metadata: { bookId: page.book_id, chapterId: page.chapter_id, slug: page.slug },
    };
  }

  async normalizeChange(change: BookStackReconciledChange): Promise<NormalizedEvent> {
    if (!/^\d+$/.test(change.pageId)) throw new Error("BookStack page id must be numeric.");
    const objectId = `bookstack:page:${change.pageId}`;
    return {
      eventId: change.eventId,
      tenantId: this.config.tenantId,
      authority: this.authority,
      objectId,
      mutationType: change.mutationType,
      beforeVersion: change.beforeSequence === null ? null : { authority: this.authority, sequence: change.beforeSequence, opaque: `bookstack-sequence:${change.beforeSequence}` },
      afterVersion: { authority: this.authority, sequence: change.afterSequence, opaque: `bookstack-sequence:${change.afterSequence}:${change.payloadHash.slice(0, 16)}` },
      logicalTimestamp: change.logicalTimestamp,
      causalParents: change.causalParents ?? [],
      idempotencyKey: `${this.config.tenantId}:${this.config.connectionId}:${change.pageId}:${change.afterSequence}:${change.mutationType}`,
      payloadHash: change.payloadHash,
      securityClassification: change.securityClassification,
      metadata: {
        connector: "bookstack",
        externalObjectId: change.pageId,
        changedFields: change.changedFields?.sort().join(",") ?? null,
        affectedPrincipalRefs: change.affectedPrincipalRefs.sort().join(","),
        reconciliationRequired: false,
      },
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const credential = await this.credentials.resolve(this.config.credentialReference);
    const response = await this.fetcher(`${this.endpoint}${path}`, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Token ${credential.tokenId}:${credential.tokenSecret}` },
    });
    if (!response.ok) throw new Error(`BookStack API request failed at ${path} with status ${response.status}.`);
    return response.json() as Promise<T>;
  }
}
