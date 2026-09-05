"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Database,
  Download,
  FileCheck2,
  FileText,
  Leaf,
  LoaderCircle,
  Plug,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AutomaticClient,
  type AutomaticReply,
  type Retrieval,
  type SampleDocument,
  type SyncStatus,
} from "@/lib/concord/automatic-client";
import { downloadJSON } from "@/lib/concord/client";
import { Mark } from "./primitives";

type View = "overview" | "connections" | "evidence" | "install";
const views = [
  { id: "overview", name: "Overview", icon: Activity },
  { id: "connections", name: "Connections", icon: Plug },
  { id: "evidence", name: "Evidence", icon: FileCheck2 },
  { id: "install", name: "Install", icon: Terminal },
] as const;
const time = (v: number | string | null | undefined) =>
  v == null
    ? "Not yet observed"
    : new Date(typeof v === "number" ? v * 1000 : v).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
function State({
  value,
  children,
}: {
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`sync-state ${["current", "verified", "running"].includes(value) ? "is-good" : ["blocked", "failed"].includes(value) ? "is-bad" : "is-neutral"}`}
    >
      <span />
      {children ?? value.replaceAll("_", " ")}
    </span>
  );
}
function Navigation({
  view,
  onView,
}: {
  view: View;
  onView: (view: View) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar className="concord-sidebar">
      <SidebarHeader className="brand-area">
        <button
          className="brand"
          onClick={() => onView("overview")}
          aria-label="Concord overview"
        >
          <Mark />
          <span>
            concord<span className="brand-period">.</span>
          </span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <div className="workspace-switch">
          <span className="workspace-emblem">
            <Leaf size={17} />
          </span>
          <div>
            <strong>Living workspace</strong>
            <small>Browser demonstration</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <SidebarMenu>
          {views.map(({ id, name, icon: Icon }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                className="nav-item"
                isActive={view === id}
                onClick={() => {
                  onView(id);
                  setOpenMobile(false);
                }}
              >
                <Icon />
                <span>{name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="nav-separator" />
        <a
          href="/downloads/concord-product-decisions.md"
          download
          className="sync-nav-link"
        >
          <FileText size={16} />
          Product &amp; research notes
          <ArrowUpRight size={14} />
        </a>
      </SidebarContent>
      <SidebarFooter>
        <div className="sidebar-note c-sidebar-nature">
          <img src="/assets/concord-evidence-balanced-stones.webp" alt="" />
          <p>
            Knowledge moves.
            <br />
            <em>Keep it connected.</em>
          </p>
        </div>
        <div className="sync-sidebar-bottom">
          <span className="sync-live-dot" />
          Automatic sync · Local-first
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
export default function AutomaticWorkspace() {
  const [clock, setClock] = useState(Date.now());
  const [view, setView] = useState<View>("overview"),
    [reply, setReply] = useState<AutomaticReply | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [sourceOpen, setSourceOpen] = useState(false),
    [selected, setSelected] = useState("api-limits"),
    [draft, setDraft] = useState<SampleDocument | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [query, setQuery] = useState("API"),
    [identity, setIdentity] = useState("alex"),
    [route, setRoute] = useState("support"),
    [retrieved, setRetrieved] = useState<Retrieval | null>(null),
    [retrievedGeneration, setRetrievedGeneration] = useState<number | null>(
      null,
    ),
    [polling, setPolling] = useState(false);
  const client = useRef<AutomaticClient | null>(null),
    mounted = useRef(false);
  const navigate = (next: View) => {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const accept = useCallback((r: AutomaticReply) => {
    if (mounted.current) setReply(r);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const clockTimer = setInterval(() => setClock(Date.now()), 1000);
    const hash = window.location.hash.slice(1);
    if (views.some((v) => v.id === hash)) setView(hash as View);
    const c = new AutomaticClient();
    client.current = c;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const observe = async () => {
      if (stopped) return;
      setPolling(true);
      try {
        const r = await c.command({ action: "tick" });
        if (!stopped) {
          accept(r);
          setError(null);
        }
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      } finally {
        if (!stopped) {
          setPolling(false);
          timer = setTimeout(observe, 2000);
        }
      }
    };
    c.command({ action: "status" })
      .then((r) => {
        if (!stopped) {
          accept(r);
          setLoading(false);
          void observe();
        }
      })
      .catch((e) => {
        if (!stopped) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      stopped = true;
      mounted.current = false;
      clearTimeout(timer);
      clearInterval(clockTimer);
      c.close();
      client.current = null;
    };
  }, [accept]);
  const command = async (payload: Record<string, unknown>) => {
    if (!client.current)
      throw new Error("Observer unavailable. Reload to retry.");
    const r = await client.current.command(payload);
    accept(r);
    return r;
  };
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openSource = () => {
    const doc =
      reply?.documents.find((d) => d.id === selected) ?? reply?.documents[0];
    if (doc) {
      setSelected(doc.id);
      setDraft({ ...doc });
    }
    setNotice(null);
    setSourceOpen(true);
  };
  const saveSource = () =>
    act(async () => {
      if (!draft) return;
      const r = await command({ action: "save_source", document: draft });
      setDraft(r.documents.find((d) => d.id === draft.id) ?? null);
      setNotice(
        "Saved in the sample source. The observer will pick up the change automatically.",
      );
    });
  const status = reply?.status,
    metrics = status?.metrics,
    unhealthy =
      !!error || status?.status === "degraded" || status?.status === "blocked",
    ready = !!reply && !loading;
  const evidence = () =>
    downloadJSON("concord-automatic-sync-evidence.json", {
      artifact_type: "browser_sample_runtime_evidence",
      exported_at: new Date().toISOString(),
      customer_systems_connected: false,
      coverage:
        "This browser's sample source, SQLite lexical index, and two local retrieval routes only",
      observer_error: error,
      runtime: status,
      retrieval_sample: retrieved,
      retrieval_may_be_older:
        retrievedGeneration !== status?.metrics.observed_changes,
      limitations: [
        "Point-in-time checks, not a guarantee for every query",
        "Browser background throttling may delay the two-second polling interval",
        "No external vector database, model training, customer agents or effective enterprise permissions are connected",
      ],
    });
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "238px" } as React.CSSProperties}
    >
      <Navigation view={view} onView={navigate} />
      <div className="main-shell sync-workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <SidebarTrigger className="mobile-menu" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{views.find((v) => v.id === view)?.name}</strong>
          </div>
          <div className="sync-top-status">
            <span
              className={unhealthy ? "sync-warning-dot" : "sync-live-dot"}
            />
            {loading
              ? "Starting observer"
              : error
                ? "Observer unavailable"
                : polling
                  ? "Checking source"
                  : "Automatic observer"}
          </div>
        </header>
        <div className="sync-context">
          <span>
            <Leaf size={14} />
            Browser demonstration · Sample data
          </span>
          <button onClick={() => navigate("install")}>
            Run on your own files
            <ArrowUpRight size={14} />
          </button>
        </div>
        <main id="main-content" className="sync-main">
          {error && (
            <div className="c-error" role="alert">
              <TriangleAlert size={20} />
              <div>
                <strong>Observer needs attention</strong>
                <p>
                  {error} Previous results are historical until a new check
                  succeeds.
                </p>
              </div>
            </div>
          )}
          {view === "overview" && (
            <>
              <section className="sync-hero">
                <div>
                  <p className="eyebrow">AUTOMATIC DATA FRESHNESS</p>
                  <h1>
                    Keep your AI agents’ data
                    <br />
                    <em>up to date.</em>
                  </h1>
                  <p>
                    Concord detects source changes, updates connected agent
                    data, and checks what your agents can retrieve.
                  </p>
                  <div className="sync-actions">
                    <button
                      className="primary-button"
                      onClick={() => navigate("install")}
                    >
                      Install local runtime
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="sync-text-button"
                      onClick={openSource}
                      disabled={!ready}
                    >
                      Open sample source
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
                <img
                  src="/assets/living-network.webp"
                  alt="A planted stone landscape with connected paths"
                  width="1672"
                  height="941"
                />
              </section>
              <div className="sync-health">
                <div>
                  <State
                    value={error ? "blocked" : (status?.status ?? "starting")}
                  >
                    {error
                      ? "Status unknown"
                      : status?.status === "current"
                        ? "Registered data checked"
                        : (status?.status?.replaceAll("_", " ") ??
                          "Starting Python observer")}
                  </State>
                  <p>
                    {unhealthy
                      ? "Some data cannot be verified. Inspect the source and affected records."
                      : "Changes are observed and processed automatically. No per-change setup."}
                  </p>
                </div>
                <span>
                  Last complete scan
                  <br />
                  <strong>{time(status?.source.last_complete_at)}</strong>
                </span>
              </div>
              <section
                className="sync-metrics"
                aria-label="Observed runtime metrics"
              >
                <Metric
                  value={metrics?.documents}
                  label="Discovered documents"
                  note="Within the connected source"
                />
                <Metric
                  value={metrics?.verified_documents}
                  label="Verified documents"
                  note="At the last completed check"
                />
                <Metric
                  value={metrics?.pending_jobs}
                  label="Pending updates"
                  note={`${metrics?.blocked_documents ?? 0} blocked · ${metrics?.failed_jobs ?? 0} failed jobs`}
                />
                <Metric
                  value={
                    metrics?.sync_lag_seconds == null
                      ? undefined
                      : `${Math.max(0, (clock - (typeof status?.source.last_complete_at === "number" ? status.source.last_complete_at * 1000 : Date.parse(String(status?.source.last_complete_at)))) / 1000).toFixed(1)}s`
                  }
                  label="Last complete scan age"
                  note="Observation age; not propagation latency"
                />
              </section>
              <section className="sync-section">
                <div className="sync-section-head">
                  <div>
                    <p className="eyebrow">01 / CONNECTED DATA</p>
                    <h2>
                      One source. <em>A shared state.</em>
                    </h2>
                  </div>
                  <button
                    className="sync-text-button"
                    onClick={() => navigate("connections")}
                  >
                    View coverage
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="sync-flow">
                  <div>
                    <span className="sync-icon">
                      <FileText size={22} />
                    </span>
                    <strong>Sample knowledge</strong>
                    <small>
                      {reply?.documents.length ?? "—"} source documents ·
                      polling
                    </small>
                    <button onClick={openSource} disabled={!ready}>
                      Open source
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="sync-flow-line">
                    <span>Observe → update → verify</span>
                  </div>
                  <div>
                    <span className="sync-icon">
                      <Database size={22} />
                    </span>
                    <strong>Local retrieval index</strong>
                    <small>
                      {metrics?.chunks ?? "—"} chunks · SQLite lexical search
                    </small>
                    <span className="sync-flow-caption">
                      Direct route + cached route
                    </span>
                  </div>
                </div>
                <p className="sync-caption">
                  The browser runs the Python synchronization core on sample
                  data. Install the runtime to watch real local files or an API
                  that implements the snapshot contract.
                </p>
                <div className="sync-table-wrap">
                  <table className="sync-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Indexed revision</th>
                        <th>State</th>
                        <th>Verified at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status?.documents.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.title}</strong>
                            <small>
                              {d.id}
                              {d.blocked_reason ? ` · ${d.blocked_reason}` : ""}
                            </small>
                          </td>
                          <td>
                            <code>{d.revision}</code>
                          </td>
                          <td>
                            <State value={error ? "historical" : d.state} />
                          </td>
                          <td>{time(d.verified_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!status?.documents.length && (
                    <div className="sync-empty">
                      {loading ? (
                        <>
                          <LoaderCircle size={18} className="animate-spin" />
                          Starting the Python observer…
                        </>
                      ) : (
                        "No indexed documents yet. The observer will scan the source automatically."
                      )}
                    </div>
                  )}
                </div>
              </section>
              <section className="sync-section">
                <div className="sync-section-head">
                  <div>
                    <p className="eyebrow">02 / CHECK THE RESULT</p>
                    <h2>
                      See what retrieval <em>returns.</em>
                    </h2>
                  </div>
                  <span className="sync-caption">
                    Local sample identities &amp; routes
                  </span>
                </div>
                <form
                  className="sync-query"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                      const r = await command({
                        action: "retrieve",
                        query,
                        identity,
                        route,
                      });
                      setRetrieved(r.result as Retrieval);
                      setRetrievedGeneration(r.status.metrics.observed_changes);
                    });
                  }}
                >
                  <label>
                    Search knowledge
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      maxLength={256}
                      placeholder="Search API limits"
                      required
                    />
                  </label>
                  <label>
                    Sample identity
                    <select
                      value={identity}
                      onChange={(e) => setIdentity(e.target.value)}
                    >
                      <option value="alex">Alex</option>
                      <option value="jordan">Jordan</option>
                    </select>
                  </label>
                  <label>
                    Local retrieval route
                    <select
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                    >
                      <option value="support">Direct retrieval</option>
                      <option value="success">Cached retrieval</option>
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!ready || busy}
                  >
                    <Search size={16} />
                    Search sample data
                  </button>
                </form>
                {retrieved ? (
                  <div className="sync-results">
                    <div className="sync-results-heading">
                      <strong>
                        {retrieved.status === "blocked"
                          ? "Retrieval blocked · "
                          : ""}
                        {retrieved.documents.length} result
                        {retrieved.documents.length !== 1 ? "s" : ""} for{" "}
                        {retrieved.identity}
                      </strong>
                      <span>
                        {time(retrieved.checked_at)} · {retrieved.route}
                      </span>
                    </div>
                    {(retrievedGeneration !==
                      status?.metrics.observed_changes ||
                      unhealthy) && (
                      <p className="sync-inline-warning">
                        {unhealthy
                          ? "This is a historical query result. Current source health does not establish that this data can still be retrieved."
                          : "The indexed source changed after this query. Search again to inspect the latest result."}
                      </p>
                    )}
                    {retrieved.documents.map((d) => (
                      <article key={d.id}>
                        <div>
                          <strong>{d.title}</strong>
                          <code>{d.revision}</code>
                        </div>
                        <p>{d.content}</p>
                      </article>
                    ))}
                    {!retrieved.documents.length && (
                      <p>
                        {retrieved.reason ??
                          "No matching data is available to this identity on this route. Check the query, source health and document access."}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="sync-caption">
                    Concord checks both routes automatically after each update.
                    Use this optional search to inspect the returned content. No
                    AI model is called.
                  </p>
                )}
              </section>
            </>
          )}
          {view === "connections" && (
            <>
              <PageIntro
                eyebrow="CONNECTIONS & COVERAGE"
                title="A clear view of"
                emphasis="what is connected."
                image="concord-coverage-stone-arch"
                copy="Discovery stays within the source scope and permissions you configure. Every destination must be registered before Concord can update it."
              />
              <section className="sync-section">
                <div className="sync-section-head">
                  <h2>This browser workspace</h2>
                  <State
                    value={
                      !status?.source.last_complete_at
                        ? "starting"
                        : unhealthy
                          ? "degraded"
                          : "running"
                    }
                  >
                    {!status?.source.last_complete_at
                      ? "Waiting for first scan"
                      : unhealthy
                        ? "Needs attention"
                        : "Sample source connected"}
                  </State>
                </div>
                <div className="sync-connection-grid">
                  <Connection
                    title="Sample knowledge source"
                    icon={<FileText />}
                    state="Browser sample"
                    details="Two editable documents, explicit sample ACLs, complete snapshot polling every 2 seconds while this tab is active."
                    action={
                      <button
                        className="sync-text-button"
                        onClick={openSource}
                        disabled={!ready}
                      >
                        Open sample source
                        <ArrowUpRight size={15} />
                      </button>
                    }
                  />
                  <Connection
                    title="SQLite retrieval & cache"
                    icon={<Database />}
                    state="Local implementation"
                    details="A lexical index and a document cache. The two registered routes check revision, source health and the configured identity."
                    action={
                      <button
                        className="sync-text-button"
                        onClick={() => navigate("overview")}
                      >
                        Inspect retrieval
                        <ArrowRight size={15} />
                      </button>
                    }
                  />
                </div>
              </section>
              <section className="sync-section">
                <div className="sync-section-head">
                  <h2>Installable source adapters</h2>
                  <button
                    className="sync-text-button"
                    onClick={() => navigate("install")}
                  >
                    Setup instructions
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="sync-table-wrap">
                  <table className="sync-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>What it discovers</th>
                        <th>Setup &amp; boundary</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Local files</strong>
                          <small>Implemented · tested on local files</small>
                        </td>
                        <td>
                          Markdown / JSON documents inside a configured
                          directory.
                        </td>
                        <td>
                          Choose the directory and explicit identities. No
                          inferred filesystem ACLs.
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>JSON snapshot API</strong>
                          <small>Implemented · local contract tests</small>
                        </td>
                        <td>
                          Documents returned by one configured snapshot
                          endpoint.
                        </td>
                        <td>
                          The endpoint must implement the bounded
                          complete-snapshot contract. Not a universal API
                          connector.
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>BookStack</strong>
                          <small>Adapter prepared · no live validation</small>
                        </td>
                        <td>Content of configured page IDs.</td>
                        <td>
                          Server credentials and page IDs required. Effective
                          permissions and inventory are not discovered.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="sync-caption">
                  SharePoint, Confluence, Slack, external vector databases and
                  agent memory integrations require separate adapters and
                  customer validation. They are not connected by this release.
                </p>
              </section>
              <section className="sync-note">
                <ShieldCheck size={23} />
                <div>
                  <h3>Permissions travel with the data.</h3>
                  <p>
                    Unknown access rules block retrieval. The local runtime
                    binds consumer tokens to an identity and route. Enterprise
                    identity mapping must be supplied by a supported
                    integration.
                  </p>
                </div>
              </section>
            </>
          )}
          {view === "evidence" && (
            <>
              <PageIntro
                eyebrow="SYNC EVIDENCE"
                title="Updates you can"
                emphasis="inspect."
                image="concord-evidence-balanced-stones"
                copy="Follow observed changes through the registered index and retrieval checks. A failed or incomplete scan stays visible."
              />
              <section className="sync-section">
                <div className="sync-section-head">
                  <div>
                    <h2>Observed changes</h2>
                    <p className="sync-caption">
                      Durable jobs in the local runtime; session data in this
                      browser.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={evidence}
                    disabled={!ready}
                  >
                    <Download size={16} />
                    Export evidence
                  </button>
                </div>
                <div className="sync-table-wrap">
                  <table className="sync-table">
                    <thead>
                      <tr>
                        <th>Document / operation</th>
                        <th>Expected revision</th>
                        <th>Result</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status?.jobs
                        .slice()
                        .reverse()
                        .slice(0, 30)
                        .map((j) => (
                          <tr key={j.id}>
                            <td>
                              <strong>{j.document_id}</strong>
                              <small>
                                {j.operation} · {j.attempts} attempt
                                {j.attempts !== 1 ? "s" : ""}
                                {j.error ? ` · ${j.error}` : ""}
                              </small>
                            </td>
                            <td>
                              <code>{j.expected_revision || "Removed"}</code>
                            </td>
                            <td>
                              <State value={j.state} />
                            </td>
                            <td>{time(j.updated_at)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!status?.jobs.length && (
                    <div className="sync-empty">No observed jobs yet.</div>
                  )}
                </div>
              </section>
              <section className="sync-section">
                <h2>What a successful check means</h2>
                <div className="sync-checks">
                  <p>
                    <Check size={17} />
                    The source revision was confirmed again before publishing
                    the update.
                  </p>
                  <p>
                    <Check size={17} />
                    Stored chunks and the registered retrieval routes were
                    checked against that revision.
                  </p>
                  <p>
                    <Check size={17} />
                    Sample allowed and denied identities were checked where ACLs
                    are known.
                  </p>
                </div>
                <p className="sync-caption">
                  These are bounded, point-in-time checks. They do not prove
                  every possible query, answer, undiscovered copy, in-flight
                  request or external agent memory is current.
                </p>
                {status?.source.error && (
                  <div className="sync-inline-warning">
                    Source observation: {status.source.error}
                  </div>
                )}
              </section>
            </>
          )}
          {view === "install" && (
            <>
              <PageIntro
                eyebrow="RUN IN YOUR ENVIRONMENT"
                title="Connect once."
                emphasis="Keep observing."
                image="concord-review-stone-ferns"
                copy="Start with a small local knowledge folder. The Python runtime watches for changes and serves the verified data through a local API."
              />
              <section className="sync-section">
                <div className="sync-section-head">
                  <div>
                    <h2>A working local starting point</h2>
                    <p className="sync-caption">
                      Python 3.11+ · Linux, macOS or WSL · no AI API key needed
                    </p>
                  </div>
                  <a
                    href="/downloads/concord-python-source.zip"
                    download
                    className="primary-button"
                  >
                    <Download size={16} />
                    Download runtime
                  </a>
                </div>
                <ol className="sync-install-steps">
                  <li>
                    <span>01</span>
                    <div>
                      <h3>Unzip and open the package</h3>
                      <p>
                        Open a terminal inside the extracted Python package.
                      </p>
                      <pre>
                        <code>python -m concord.runtime --help</code>
                      </pre>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <h3>Initialize a workspace</h3>
                      <p>
                        Creates a small knowledge folder, config and local
                        credentials. Existing files are not overwritten.
                      </p>
                      <pre>
                        <code>
                          python -m concord.runtime init --directory
                          ./concord-local
                        </code>
                      </pre>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <h3>Start the observer</h3>
                      <p>
                        Open the printed localhost URL. Edit a source file in
                        your own editor; Concord detects and processes the
                        change automatically.
                      </p>
                      <pre>
                        <code>
                          python -m concord.runtime run --config
                          ./concord-local/runtime.json
                        </code>
                      </pre>
                    </div>
                  </li>
                </ol>
                <a
                  className="sync-text-button"
                  href="/downloads/concord-runtime-guide.md"
                  download
                >
                  Download the full setup &amp; API guide
                  <ArrowUpRight size={15} />
                </a>
              </section>
              <div className="sync-connection-grid">
                <section className="sync-note">
                  <Settings2 size={24} />
                  <div>
                    <h3>Configured once</h3>
                    <p>
                      Source directory or supported endpoint, destination
                      database, polling interval, and explicitly allowed
                      consumer identities. Initial inventory is then discovered
                      within that scope.
                    </p>
                  </div>
                </section>
                <section className="sync-note">
                  <Activity size={24} />
                  <div>
                    <h3>Automatic afterwards</h3>
                    <p>
                      Content edits, missing documents and access changes in the
                      supported data contract are processed by the observer.
                      Incomplete scans or unsupported schemas stop affected
                      retrieval.
                    </p>
                  </div>
                </section>
              </div>
              <section className="sync-section">
                <h2>Next: your existing retrieval stack</h2>
                <p className="sync-body-copy">
                  The commercial pilot will connect a real customer source and
                  existing retrieval route. External vector stores, enterprise
                  ACL resolution and agent memory require explicit integration
                  work. This release proves the automatic local loop.
                </p>
                <a
                  className="sync-text-button"
                  href="https://github.com/Nitaiarieli/concord-ai-assurance/pull/2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Developer source &amp; handoff
                  <ArrowUpRight size={15} />
                </a>
              </section>
            </>
          )}
          <footer className="sync-footer">
            <span>Concord · Data that keeps up.</span>
            <span>Bounded coverage. Observable freshness.</span>
          </footer>
        </main>
      </div>
      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="sync-source-dialog">
          <DialogHeader>
            <DialogTitle>Sample source application</DialogTitle>
            <DialogDescription>
              Edit the source here, as a person or an agent would in an external
              app. Saving changes does not call the synchronizer; the
              independent observer finds them on its next scan.
            </DialogDescription>
          </DialogHeader>
          <div className="sync-source-toolbar">
            <label>
              Source document
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setDraft(
                    reply?.documents.find((d) => d.id === e.target.value) ??
                      null,
                  );
                  setNotice(null);
                }}
              >
                {reply?.documents.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
            <State value={reply?.available ? "running" : "blocked"}>
              {reply?.available ? "Source available" : "Source unavailable"}
            </State>
          </div>
          {draft && (
            <>
              <label className="sync-field">
                Title
                <input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  maxLength={160}
                />
              </label>
              <label className="sync-field">
                Content
                <textarea
                  rows={5}
                  value={draft.content}
                  onChange={(e) =>
                    setDraft({ ...draft, content: e.target.value })
                  }
                  maxLength={12000}
                />
              </label>
              <div className="sync-source-meta">
                <label>
                  Allowed sample identities
                  <select
                    value={draft.acl === null ? "unknown" : draft.acl.join(",")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        acl:
                          e.target.value === "unknown"
                            ? null
                            : e.target.value
                              ? e.target.value.split(",")
                              : [],
                      })
                    }
                  >
                    <option value="alex,jordan">Alex &amp; Jordan</option>
                    <option value="jordan">Jordan only</option>
                    <option value="alex">Alex only</option>
                    <option value="">Nobody</option>
                    <option value="unknown">Unknown permissions</option>
                  </select>
                </label>
                <label>
                  Source schema
                  <select
                    value={draft.schema_version}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        schema_version: Number(e.target.value),
                      })
                    }
                  >
                    <option value={1}>Version 1 · supported</option>
                    <option value={2}>Version 2 · unsupported</option>
                  </select>
                </label>
              </div>
              <div className="sync-actions">
                <button
                  className="primary-button"
                  disabled={busy || !draft.title.trim()}
                  onClick={saveSource}
                >
                  Save source changes
                  <ArrowRight size={16} />
                </button>
                <button
                  className="sync-text-button sync-danger"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const r = await command({
                        action: "delete_source",
                        id: draft.id,
                      });
                      setDraft(r.documents[0] ?? null);
                      setSelected(r.documents[0]?.id ?? "");
                      setNotice(
                        "Document removed from the sample source. The observer will detect its absence on the next complete scan.",
                      );
                    })
                  }
                >
                  Delete source document
                </button>
              </div>
            </>
          )}
          {notice && (
            <p role="status" className="sync-source-notice">
              {notice}
            </p>
          )}
          <details className="sync-source-tools">
            <summary>Source availability &amp; restore</summary>
            <p>
              Use these source controls to inspect recovery. The observer keeps
              running.
            </p>
            <button
              className="sync-text-button"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await command({
                    action: "availability",
                    available: !reply?.available,
                  });
                  setNotice(
                    reply?.available
                      ? "Source is now unavailable. The next scan will report incomplete coverage."
                      : "Source is available again. Waiting for the next scan.",
                  );
                })
              }
            >
              {reply?.available
                ? "Make sample source unavailable"
                : "Restore source availability"}
            </button>
            <button
              className="sync-text-button"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const r = await command({ action: "restore_source" });
                  setDraft(r.documents[0]);
                  setSelected(r.documents[0].id);
                  setNotice(
                    "Sample source restored. The observer will reconcile it automatically.",
                  );
                })
              }
            >
              Restore sample documents
            </button>
          </details>
          <p className="sync-caption">
            This editor is a separate sample source, not a production step for
            choosing where changes happened. Reloading this page starts a new
            browser session.
          </p>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function Metric({
  value,
  label,
  note,
}: {
  value?: number | string;
  label: string;
  note: string;
}) {
  return (
    <div>
      <strong>{value ?? "—"}</strong>
      <h3>{label}</h3>
      <p>{note}</p>
    </div>
  );
}
function PageIntro({
  eyebrow,
  title,
  emphasis,
  image,
  copy,
}: {
  eyebrow: string;
  title: string;
  emphasis: string;
  image: string;
  copy: string;
}) {
  return (
    <section className="sync-page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title}
          <br />
          <em>{emphasis}</em>
        </h1>
        <p>{copy}</p>
      </div>
      <img src={`/assets/${image}.webp`} alt="" width="1672" height="941" />
    </section>
  );
}
function Connection({
  title,
  icon,
  state,
  details,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  state: string;
  details: string;
  action: React.ReactNode;
}) {
  return (
    <article className="sync-connection">
      <span className="sync-icon">{icon}</span>
      <small>{state}</small>
      <h3>{title}</h3>
      <p>{details}</p>
      {action}
    </article>
  );
}
