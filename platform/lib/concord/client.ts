export type Artifact = {
  id: string;
  title: string;
  kind: string;
  parents: string[];
  revision: number;
  status: string;
  acl: string[] | null;
  deleted: boolean;
  source_revisions: Record<string, number>;
};
export type Change = {
  id: string;
  source_id: string;
  kind: string;
  identity: string;
  affected: string[];
  source_revision: number;
  stage: string;
  proof_id: string | null;
  failure: string | null;
};
export type Check = {
  artifact_id?: string;
  check: string;
  passed: boolean;
  identity?: string;
  expected?: string;
  observed?: string;
};
export type Proof = {
  id: string;
  event_id: string;
  result: string;
  checks: Check[];
  affected: string[];
  identity: string;
  hash: string;
  source_id: string;
  source_revision: number;
  created_at: number;
  scope: string;
  previous_hash: string | null;
};
export type Snapshot = {
  mode: string;
  engine: string;
  epoch: number;
  nodes: Artifact[];
  events: Change[];
  proofs: Proof[];
  counts: {
    sources: number;
    derivatives: number;
    blocked: number;
    verified: number;
  };
};
export type Reply = { snapshot: Snapshot; result: any };
export class PythonClient {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<
    number,
    {
      resolve: (r: Reply) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker = new Worker("/python-worker.mjs", { type: "module" });
    this.worker.onmessage = ({ data }) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error));
      else pending.resolve(data.data);
    };
    this.worker.onerror = () => {
      this.rejectAll(
        new Error(
          "The Python runtime could not start. Reload the page to retry.",
        ),
      );
    };
  }
  private rejectAll(error: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
  command(payload: Record<string, unknown>): Promise<Reply> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("The engine took too long. Reload before retrying."));
      }, 90000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, payload });
    });
  }
  close() {
    this.worker.terminate();
    this.rejectAll(new Error("Workspace closed"));
  }
}
export function downloadJSON(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
