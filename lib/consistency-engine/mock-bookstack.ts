import type { BookStackApiCredential, BookStackCredentialProvider, BookStackIdentityVerifier } from "./bookstack-connector.ts";

type MockPage = {
  id: number;
  book_id: number;
  chapter_id: number;
  name: string;
  slug: string;
  markdown: string;
  revision_count: number;
  updated_at: string;
};

export class MockBookStackEnvironment implements BookStackCredentialProvider, BookStackIdentityVerifier {
  readonly endpoint = "https://bookstack.mock";
  readonly credentialReference = "mock-vault://bookstack/design-partner";
  readonly verificationPrincipalRef = "bookstack-user:17";
  readonly requests: Array<{ path: string; authorizationPresent: boolean }> = [];
  private page: MockPage = {
    id: 42,
    book_id: 7,
    chapter_id: 9,
    name: "Incident Response",
    slug: "incident-response",
    markdown: "Incident response requires an assigned owner and an approved escalation path.",
    revision_count: 1,
    updated_at: "2026-08-21T10:00:00.000Z",
  };
  private allowedPrincipalRefs = new Set([this.verificationPrincipalRef]);

  async resolve(reference: string): Promise<BookStackApiCredential> {
    if (reference !== this.credentialReference) throw new Error("Unknown mock credential reference.");
    return { tokenId: "mock-token-id", tokenSecret: "mock-token-secret" };
  }

  async canReadPage(_apiEndpoint: string, pageId: string, principalRef: string) {
    return pageId === String(this.page.id) && this.allowedPrincipalRefs.has(principalRef);
  }

  updateContent() {
    this.page = {
      ...this.page,
      markdown: "Incident response requires an assigned owner, an approved escalation path, and quarterly rotation exercises.",
      revision_count: 2,
      updated_at: "2026-08-21T10:05:00.000Z",
    };
  }

  revokeVerificationPrincipal() {
    this.allowedPrincipalRefs.delete(this.verificationPrincipalRef);
  }

  fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const authorization = headers.get("authorization");
    this.requests.push({ path: url.pathname, authorizationPresent: Boolean(authorization) });
    if (authorization !== "Token mock-token-id:mock-token-secret") return Response.json({ error: "unauthorized" }, { status: 401 });
    if (url.pathname === "/api/system") return Response.json({ version: "v26.05", instance_id: "mock-bookstack" });
    if (url.pathname === "/api/pages/42") return Response.json(this.page);
    if (url.pathname === "/api/content-permissions/page/42") {
      return Response.json({
        owner: { id: 2 },
        role_permissions: [{ role_id: 5, view: this.allowedPrincipalRefs.size > 0, create: false, update: false, delete: false }],
        fallback_permissions: { inheriting: false, view: false, create: false, update: false, delete: false },
      });
    }
    if (url.pathname === "/api/audit-log") return Response.json({ data: [], total: 0 });
    return Response.json({ error: "not found" }, { status: 404 });
  };
}
