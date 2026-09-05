export type SyncDocument = {
  id: string;
  title: string;
  revision: string;
  content_hash: string;
  state: string;
  blocked_reason: string | null;
  updated_at: number | string | null;
  verified_at: number | string | null;
  chunk_count: number;
  acl_known: boolean;
  allowed_identity_count: number;
};
export type SyncJob = {
  id: string | number;
  document_id: string;
  operation: string;
  state: string;
  attempts: number;
  expected_revision: string;
  created_at: number | string;
  updated_at: number | string;
  error: string | null;
};
export type SyncStatus = {
  mode: string;
  status: string;
  source: {
    tenant_id: string;
    connection_id: string;
    last_observed_at: number | string | null;
    last_complete_at: number | string | null;
    cursor: string | null;
    complete: boolean;
    error: string | null;
    generation: number;
  };
  metrics: {
    documents: number;
    chunks: number;
    verified_documents: number;
    blocked_documents: number;
    pending_jobs: number;
    failed_jobs: number;
    cached_documents: number;
    observed_changes: number;
    sync_lag_seconds: number | null;
  };
  documents: SyncDocument[];
  routes: {
    id: string;
    name: string;
    cache_enabled: boolean;
    verified_documents: number;
  }[];
  jobs: SyncJob[];
  limits: Record<string, unknown>;
};
export type SampleDocument = {
  id: string;
  title: string;
  content: string;
  revision: string;
  acl: string[] | null;
  schema_version: number;
};
export type Retrieval = {
  status?: string;
  reason?: string | null;
  route: string;
  identity: string;
  query: string;
  documents: {
    id: string;
    title: string;
    content: string;
    revision: string;
    content_hash: string;
  }[];
  checked_at: number | string;
  coverage: string;
};
export type AutomaticReply = {
  status: SyncStatus;
  documents: SampleDocument[];
  available: boolean;
  result?: Retrieval | unknown;
};

export class AutomaticClient {
  private worker = new Worker("/automatic-worker.mjs", { type: "module" });
  private sequence = 0;
  private requests = new Map<
    number,
    {
      resolve: (value: AutomaticReply) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const request = this.requests.get(data.id);
      if (!request) return;
      this.requests.delete(data.id);
      clearTimeout(request.timer);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.data);
    };
    this.worker.onerror = () =>
      this.fail("The Python observer could not start. Reload to retry.");
  }
  command(payload: Record<string, unknown>) {
    const id = ++this.sequence;
    return new Promise<AutomaticReply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(id);
        reject(
          new Error("The observer did not respond. Reload before continuing."),
        );
      }, 90000);
      this.requests.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, payload });
    });
  }
  private fail(message: string) {
    for (const r of this.requests.values()) {
      clearTimeout(r.timer);
      r.reject(new Error(message));
    }
    this.requests.clear();
  }
  close() {
    this.worker.terminate();
    this.fail("Workspace closed");
  }
}
