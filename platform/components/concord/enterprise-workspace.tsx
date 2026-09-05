"use client";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  Database,
  Download,
  FileText,
  FolderOpen,
  GitBranch,
  Layers3,
  Leaf,
  MessageSquare,
  Network,
  Plug,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Ticket,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Mark } from "./primitives";
import {
  applications,
  changes,
  type Application,
  type ApplicationId,
  type Change,
} from "@/lib/concord/enterprise-preview";
type View = "overview" | "applications" | "activity" | "deployment";
const views = [
  { id: "overview", name: "Overview", icon: Layers3 },
  { id: "applications", name: "Applications", icon: Plug },
  { id: "activity", name: "Sync activity", icon: Activity },
  { id: "deployment", name: "Deployment", icon: Server },
] as const;
function AppIcon({ id }: { id: ApplicationId }) {
  return (
    <span className={`ep-app-icon ep-${id}`}>
      {id === "confluence" ? <BookOpen size={22} /> : <Ticket size={22} />}
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
            <strong>Atlas workspace</strong>
            <small>Example organization</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <SidebarMenu>
          {views.map(({ id, name, icon: Icon }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                className="nav-item"
                isActive={id === view}
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
          className="sync-nav-link"
          href="/downloads/concord-atlassian-mvp.md"
          download
        >
          <FileText size={17} />
          MVP scope
          <ArrowUpRight size={14} />
        </a>
      </SidebarContent>
      <SidebarFooter>
        <div className="sidebar-note c-sidebar-nature">
          <img src="/assets/concord-evidence-balanced-stones.webp" alt="" />
          <p>
            One connected ecosystem.
            <br />
            <em>Knowledge that keeps up.</em>
          </p>
        </div>
        <p className="ep-sidebar-foot">
          Confluence + Jira first.
          <br />A broader ecosystem ahead.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
export default function EnterpriseWorkspace() {
  const [view, setView] = useState<View>("overview"),
    [apps, setApps] = useState<Application[]>(applications),
    [setup, setSetup] = useState(false),
    [step, setStep] = useState(1),
    [chosen, setChosen] = useState<ApplicationId>("confluence"),
    [scopes, setScopes] = useState<string[]>(["Product knowledge"]),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<Change | null>(null),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState("What is the current API rate limit?"),
    [answer, setAnswer] = useState(false);
  const navigate = (next: View) => {
    setView(next);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openSetup = (app: ApplicationId = "confluence") => {
    setChosen(app);
    setScopes(apps.find((a) => a.id === app)?.scope.split(" · ") ?? []);
    setStep(1);
    setSetup(true);
  };
  const options =
    chosen === "confluence"
      ? ["Product knowledge", "Support playbooks", "Engineering handbook"]
      : ["Platform", "Support", "Customer requests"];
  const choose = (app: ApplicationId) => {
    setChosen(app);
    setScopes(apps.find((a) => a.id === app)?.scope.split(" · ") ?? []);
  };
  const finish = () => {
    setApps((current) =>
      current.map((a) =>
        a.id === chosen ? { ...a, scope: scopes.join(" · ") } : a,
      ),
    );
    setSetup(false);
    setView("applications");
    setNotice(
      `${chosen === "confluence" ? "Confluence" : "Jira"} mockup scope updated for this session; it resets on refresh. No application was connected.`,
    );
  };
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "238px" } as React.CSSProperties}
    >
      <Navigation view={view} onView={navigate} />
      <div className="main-shell sync-workspace ep-workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <SidebarTrigger className="mobile-menu" />
            <span>Atlas</span>
            <ChevronRight size={14} />
            <strong>{views.find((v) => v.id === view)?.name}</strong>
          </div>
          <span className="ep-top-tag">Atlassian-first MVP</span>
        </header>
        <div className="ep-mockup-banner">
          <span>
            <Leaf size={15} />
            Interactive mockup · Example data · No live connections
          </span>
          <button onClick={() => navigate("deployment")}>
            Backend &amp; deployment
            <ArrowUpRight size={14} />
          </button>
        </div>
        <main id="main-content" className="sync-main ep-main" key={view}>
          {notice && (
            <p className="ep-notice" role="status">
              <Check size={17} />
              {notice}
            </p>
          )}
          {view === "overview" && (
            <>
              <section className="ep-heading">
                <div>
                  <p className="eyebrow">YOUR APPS. YOUR AGENTS. IN SYNC.</p>
                  <h1>
                    Keep your agents’ data <em>up to date.</em>
                  </h1>
                  <p>
                    Connect the applications your agents rely on. Concord
                    carries source changes through to their connected knowledge.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => openSetup()}
                  >
                    <Plus size={17} />
                    Connect an application
                  </button>
                </div>
                <img
                  src="/assets/concord-coverage-stone-arch.webp"
                  alt="A stone arch connected by growing plants"
                  width="1672"
                  height="941"
                />
              </section>
              <section
                className="ep-overview-stats"
                aria-label="Illustrative workspace scope"
              >
                <div>
                  <strong>{apps.length}</strong>
                  <span>Applications in preview</span>
                </div>
                <div>
                  <strong>{apps.reduce((n, a) => n + a.objects, 0)}</strong>
                  <span>Example source records</span>
                </div>
                <div>
                  <strong>2</strong>
                  <span>Example agent destinations</span>
                </div>
                <button onClick={() => setSelected(changes[2])}>
                  <strong className="ep-amber">1</strong>
                  <span>
                    Example requiring attention
                    <ChevronRight size={15} />
                  </span>
                </button>
              </section>
              <section className="ep-section">
                <div className="ep-section-title">
                  <div>
                    <p className="eyebrow">CONNECTED KNOWLEDGE</p>
                    <h2>
                      From the source <em>to the agent.</em>
                    </h2>
                  </div>
                  <button
                    className="sync-text-button"
                    onClick={() => navigate("applications")}
                  >
                    Manage applications
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="ep-ecosystem">
                  <div className="ep-sources">
                    <p className="ep-column-label">ORGANIZATIONAL APPS</p>
                    {apps.map((a) => (
                      <button
                        className="ep-map-card"
                        key={a.id}
                        onClick={() => openSetup(a.id)}
                      >
                        <AppIcon id={a.id} />
                        <span>
                          <strong>{a.name}</strong>
                          <small>{a.scope}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    <div className="ep-map-future">
                      <MessageSquare size={18} />
                      <span>
                        Slack &amp; more<span>Expansion path</span>
                      </span>
                    </div>
                  </div>
                  <div className="ep-hub">
                    <div className="ep-hub-art">
                      <img
                        src="/assets/living-network.webp"
                        alt="A planted stone structure representing Concord's connected data layer"
                        width="1672"
                        height="941"
                      />
                      <span>concord.</span>
                    </div>
                    <p>Observe. Update. Verify.</p>
                    <small>Within registered coverage</small>
                  </div>
                  <div className="ep-destinations">
                    <p className="ep-column-label">AGENT DATA DESTINATIONS</p>
                    <div className="ep-map-card">
                      <span className="ep-agent-icon">
                        <Database size={21} />
                      </span>
                      <span>
                        <strong>Support agent</strong>
                        <small>RAG knowledge index</small>
                      </span>
                    </div>
                    <div className="ep-map-card">
                      <span className="ep-agent-icon">
                        <Network size={21} />
                      </span>
                      <span>
                        <strong>Product assistant</strong>
                        <small>Issue context + response cache</small>
                      </span>
                    </div>
                    <p className="ep-map-note">
                      Illustrative destinations. Existing RAG, vector stores and
                      memory need explicit adapters.
                    </p>
                  </div>
                </div>
              </section>
              <section className="ep-section">
                <div className="ep-section-title">
                  <div>
                    <p className="eyebrow">AUTOMATIC AFTER SETUP</p>
                    <h2>
                      Changes flow. <em>You see the result.</em>
                    </h2>
                  </div>
                  <button
                    className="sync-text-button"
                    onClick={() => navigate("activity")}
                  >
                    View activity
                    <ArrowRight size={16} />
                  </button>
                </div>
                <ActivityList onSelect={setSelected} />
              </section>
              <section className="ep-inspect">
                <div>
                  <p className="eyebrow">ILLUSTRATED OUTCOME</p>
                  <h2>
                    The agent gets the <em>new information.</em>
                  </h2>
                  <p>
                    A Confluence page changes its API limit from 100 to 150
                    requests per minute. The example shows that change reaching
                    the agent’s knowledge.
                  </p>
                </div>
                <div className="ep-answer-card">
                  <span>
                    <BookOpen size={17} />
                    Confluence → Support agent
                  </span>
                  <label htmlFor="example-question">Example question</label>
                  <input
                    id="example-question"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setAnswer(false);
                    }}
                    maxLength={160}
                  />
                  <button
                    className="sync-text-button"
                    disabled={!query.trim()}
                    onClick={() => setAnswer(true)}
                  >
                    Show example response
                    <ArrowRight size={16} />
                  </button>
                  {answer && (
                    <div className="ep-example-answer" role="status">
                      <strong>Illustrative response</strong>
                      <p>
                        {/api|rate|limit/i.test(query)
                          ? "The current API rate limit is 150 requests per minute."
                          : "This mockup includes the API-rate-limit example. A connected agent would retrieve the knowledge relevant to your question."}
                      </p>
                      <small>
                        API usage limits · source version 13
                        <br />
                        Example only; no model or live retrieval was called.
                      </small>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          {view === "applications" && (
            <>
              <PageHeading
                eyebrow="APPLICATIONS"
                title="Start with Atlassian."
                emphasis="Grow with your organization."
                copy="Choose the applications and source scope once. The product is designed to keep their registered agent data synchronized automatically."
                image="concord-review-stone-ferns"
              />
              <div className="ep-section-title">
                <h2>Atlassian Cloud · MVP focus</h2>
                <button className="primary-button" onClick={() => openSetup()}>
                  <Plus size={17} />
                  Connect an application
                </button>
              </div>
              <div className="ep-application-grid">
                {apps.map((a) => (
                  <article className="ep-application" key={a.id}>
                    <div className="ep-application-top">
                      <AppIcon id={a.id} />
                      <span className="ep-chip">MVP focus</span>
                    </div>
                    <h3>{a.name}</h3>
                    <p>{a.description}</p>
                    <dl>
                      <div>
                        <dt>Example scope</dt>
                        <dd>{a.scope}</dd>
                      </div>
                      <div>
                        <dt>Example inventory</dt>
                        <dd>
                          {a.objects} {a.unit}
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="sync-text-button"
                      onClick={() => openSetup(a.id)}
                    >
                      Preview setup
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
              <section className="ep-section">
                <div className="ep-section-title">
                  <h2>The wider ecosystem</h2>
                  <span className="ep-chip ep-muted">
                    Vision &amp; expansion
                  </span>
                </div>
                <div className="ep-expansion">
                  <article>
                    <MessageSquare />
                    <h3>Slack</h3>
                    <p>Conversations and shared knowledge.</p>
                    <small>Future application adapter</small>
                  </article>
                  <article>
                    <Cloud />
                    <h3>Other enterprise apps</h3>
                    <p>More systems your organization’s agents use.</p>
                    <small>Prioritized through customer demand</small>
                  </article>
                  <article>
                    <FolderOpen />
                    <h3>Files &amp; folders</h3>
                    <p>Scoped content from a local environment.</p>
                    <small>Backend scanner available</small>
                  </article>
                  <article>
                    <Plug />
                    <h3>Custom APIs</h3>
                    <p>A defined contract for your own application.</p>
                    <small>Backend snapshot API adapter</small>
                  </article>
                </div>
              </section>
              <p className="ep-footnote">
                Atlassian Cloud is the initial implementation assumption. Data
                Center requires separate adapters. Counts, scopes and
                connections shown here are mock data.
              </p>
            </>
          )}
          {view === "activity" && (
            <>
              <PageHeading
                eyebrow="SYNC ACTIVITY"
                title="Changes within your scope."
                emphasis="A visible outcome."
                copy="Inspect how a change affects the registered data your agents consume. These examples show the intended automatic workflow."
                image="concord-evidence-balanced-stones"
              />
              <div className="ep-activity-toolbar">
                <h2>Illustrative change history</h2>
                <label>
                  <Search size={17} />
                  <input
                    aria-label="Filter example changes"
                    placeholder="Filter changes"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
              </div>
              <ActivityList onSelect={setSelected} filter={filter} />
              <section className="ep-exception-note">
                <TriangleAlert size={22} />
                <div>
                  <h3>Missing data needs a clear explanation.</h3>
                  <p>
                    A record disappearing from an API response can mean
                    deletion, changed access or changed scope. Concord should
                    hold affected data until it can establish the right action.
                  </p>
                </div>
              </section>
            </>
          )}
          {view === "deployment" && (
            <>
              <PageHeading
                eyebrow="DEPLOYMENT MODEL"
                title="Connect your environment."
                emphasis="Keep control of the scope."
                copy="The proposed experience pairs a management workspace with a connector worker in your environment. Source permissions define what it can discover."
                image="concord-coverage-stone-arch"
              />
              <section className="ep-deployment-model">
                <div>
                  <Cloud size={26} />
                  <h3>Management workspace</h3>
                  <p>
                    Application setup, source scope, sync health and registered
                    agent destinations.
                  </p>
                  <span className="ep-chip ep-muted">
                    This website is the mockup
                  </span>
                </div>
                <div className="ep-deployment-direction">
                  <ArrowRight size={20} />
                  <span>Proposed outbound connection</span>
                </div>
                <div>
                  <Server size={26} />
                  <h3>Your connector worker</h3>
                  <p>
                    Read permitted source data, normalize changes and coordinate
                    supported destinations.
                  </p>
                  <span className="ep-chip">Local backend foundation</span>
                </div>
              </section>
              <p className="ep-footnote">
                Cloud enrollment and an outbound tunnel are not implemented.
                Harmony.io’s documented on-premises proxy informs this model;
                Concord’s worker currently runs independently.
              </p>
              <section className="ep-section">
                <h2>The intended setup</h2>
                <ol className="ep-deployment-steps">
                  <li>
                    <span>01</span>
                    <div>
                      <h3>Install the connector worker</h3>
                      <p>
                        Run a scoped component in an environment that can reach
                        the source.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <h3>Authorize the application</h3>
                      <p>
                        Use an approved authorization flow. Credentials remain
                        outside this public mockup.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <h3>Select spaces, projects or folders</h3>
                      <p>
                        Discover supported records within the access and scope
                        you grant.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>04</span>
                    <div>
                      <h3>Register the agent’s data destination</h3>
                      <p>
                        Connect the ingestion and retrieval paths that Concord
                        is responsible for updating and checking.
                      </p>
                    </div>
                  </li>
                </ol>
              </section>
              <section className="ep-backend">
                <div>
                  <p className="eyebrow">FOR THE DEVELOPMENT TEAM</p>
                  <h2>
                    The backend is <em>more than a screen.</em>
                  </h2>
                  <p>
                    Python source adapters, folder scanning, durable
                    synchronization and a local authenticated API are available
                    to build on. External connections need credentials and live
                    validation.
                  </p>
                  <div className="sync-actions">
                    <a
                      className="primary-button"
                      href="/downloads/concord-python-source.zip"
                      download
                    >
                      <Download size={17} />
                      Download backend
                    </a>
                    <a
                      className="sync-text-button"
                      href="/downloads/concord-atlassian-mvp.md"
                      download
                    >
                      Read setup &amp; scope
                      <ArrowUpRight size={16} />
                    </a>
                  </div>
                </div>
                <a className="ep-lab-link" href="/runtime-lab">
                  <Database size={23} />
                  <strong>Local runtime lab</strong>
                  <span>
                    Inspect the working Python core on separate sample data.
                  </span>
                  <ArrowUpRight size={18} />
                </a>
              </section>
            </>
          )}
          <footer className="sync-footer">
            <span>Concord · Connected knowledge, kept current.</span>
            <span>Product mockup · Atlassian-first</span>
          </footer>
        </main>
      </div>
      <Dialog open={setup} onOpenChange={setSetup}>
        <DialogContent className="ep-dialog">
          <DialogHeader>
            <p className="eyebrow">APPLICATION SETUP · PREVIEW</p>
            <DialogTitle>
              {step === 1
                ? "Connect an application"
                : step === 2
                  ? "Choose what to include"
                  : "Review the connection"}
            </DialogTitle>
            <DialogDescription>
              This is a setup mockup. It uses example scopes and never asks for
              credentials or connects to a real account.
            </DialogDescription>
          </DialogHeader>
          <div className="ep-step-track">
            {["Application", "Scope", "Review"].map((name, i) => (
              <span
                key={name}
                className={
                  step === i + 1 ? "active" : step > i + 1 ? "done" : ""
                }
              >
                <b>{step > i + 1 ? <Check size={13} /> : i + 1}</b>
                {name}
              </span>
            ))}
          </div>
          {step === 1 && (
            <>
              <div className="ep-choose-app">
                {applications.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => choose(a.id)}
                    className={chosen === a.id ? "selected" : ""}
                    aria-pressed={chosen === a.id}
                  >
                    <AppIcon id={a.id} />
                    <strong>{a.name}</strong>
                    <small>Atlassian Cloud</small>
                    {chosen === a.id && <Check size={18} />}
                  </button>
                ))}
              </div>
              <div className="ep-dialog-note">
                <ShieldCheck size={20} />
                <p>
                  In the connected product, an administrator authorizes access
                  before Concord discovers the available{" "}
                  {chosen === "confluence" ? "spaces" : "projects"}. These
                  choices are examples.
                </p>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="ep-dialog-label">
                Example {chosen === "confluence" ? "spaces" : "projects"}
              </p>
              <div className="ep-scope-options">
                {options.map((name) => (
                  <label key={name}>
                    <Checkbox
                      checked={scopes.includes(name)}
                      onCheckedChange={(checked) =>
                        setScopes((current) =>
                          checked
                            ? [...current, name]
                            : current.filter((x) => x !== name),
                        )
                      }
                    />
                    <span>
                      <strong>{name}</strong>
                      <small>
                        {chosen === "confluence"
                          ? "Pages and supported page content"
                          : "Issues, descriptions and current status"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="ep-footnote">
                Initial scope selection happens once. Users do not choose where
                each later change occurred.
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <div className="ep-review-source">
                <AppIcon id={chosen} />
                <div>
                  <h3>{chosen === "confluence" ? "Confluence" : "Jira"}</h3>
                  <p>{scopes.join(" · ")}</p>
                </div>
              </div>
              <div className="ep-setup-checks">
                <p>
                  <Check size={16} />
                  Discover supported records within the selected scope.
                </p>
                <p>
                  <Check size={16} />
                  Observe future changes through the configured source adapter.
                </p>
                <p>
                  <Check size={16} />
                  Update and verify explicitly registered destinations.
                </p>
              </div>
              <p className="ep-dialog-note">
                Saving updates this mockup for this session only. OAuth
                enrollment, effective source permissions and customer
                destination integrations still need implementation and
                validation.
              </p>
            </>
          )}
          <div className="ep-dialog-actions">
            <button
              className="sync-text-button"
              onClick={() => (step === 1 ? setSetup(false) : setStep(step - 1))}
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>
            <button
              className="primary-button"
              disabled={step === 2 && !scopes.length}
              onClick={() => (step === 3 ? finish() : setStep(step + 1))}
            >
              {step === 3 ? "Save mockup scope" : "Continue"}
              <ArrowRight size={16} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="ep-dialog ep-change-dialog">
          {selected && (
            <>
              <DialogHeader>
                <p className="eyebrow">
                  ILLUSTRATIVE CHANGE · {selected.app.toUpperCase()}
                </p>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{selected.source}</DialogDescription>
              </DialogHeader>
              <div className="ep-before-after">
                <div>
                  <small>Before</small>
                  <p>{selected.before}</p>
                </div>
                <ArrowRight size={18} />
                <div>
                  <small>After</small>
                  <p>{selected.after}</p>
                </div>
              </div>
              <div className="ep-change-steps">
                {selected.steps.map((s, i) => (
                  <div key={s.title}>
                    <span
                      className={
                        s.state === "attention" ? "needs-attention" : ""
                      }
                    >
                      {s.state === "done" ? (
                        <Check size={16} />
                      ) : (
                        <TriangleAlert size={16} />
                      )}
                    </span>
                    <section>
                      <h3>{s.title}</h3>
                      <p>{s.detail}</p>
                    </section>
                  </div>
                ))}
              </div>
              <div className="ep-affected">
                <strong>Example affected destinations</strong>
                {selected.affected.map((a) => (
                  <span key={a}>
                    <GitBranch size={15} />
                    {a}
                  </span>
                ))}
              </div>
              <p className="ep-footnote">
                This illustrates the intended behavior. No customer application,
                index, cache or agent was changed.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function ActivityList({
  onSelect,
  filter = "",
}: {
  onSelect: (change: Change) => void;
  filter?: string;
}) {
  const rows = changes.filter((c) =>
    `${c.title} ${c.app} ${c.kind}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <div className="ep-activity-list">
      {rows.map((c) => (
        <button key={c.id} onClick={() => onSelect(c)}>
          <AppIcon id={c.app} />
          <span>
            <strong>{c.title}</strong>
            <small>
              {c.kind} · {c.app === "jira" ? "Jira" : "Confluence"}
            </small>
          </span>
          <span
            className={`ep-change-state ${c.state === "attention" ? "attention" : ""}`}
          >
            {c.state === "attention" ? (
              <TriangleAlert size={14} />
            ) : (
              <Check size={14} />
            )}{" "}
            {c.state === "attention" ? "Needs review" : "Updated"}
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
      {!rows.length && (
        <p className="ep-empty">No example changes match this filter.</p>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  emphasis,
  copy,
  image,
}: {
  eyebrow: string;
  title: string;
  emphasis: string;
  copy: string;
  image: string;
}) {
  return (
    <section className="ep-heading ep-page-heading">
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
