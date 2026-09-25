import {
  Component,
  FormEvent,
  StrictMode,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  RefreshCw,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  ScanSearch,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import "./styles.css";

type Status = "Applied" | "Screening" | "Interview" | "Offer" | "Rejected";
type Application = {
  id: string;
  company: string;
  role: string;
  status: Status;
  dateApplied: string | null;
  needsFollowup: boolean;
  jobDescription: string;
  notes: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};
type Profile = {
  fullName: string;
  location: string;
  targetRoles: string[];
  skills: string[];
};
type Match = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  band: string;
  reasons: string[];
  source: string;
};
type RecentJob = Pick<Match, "id" | "title" | "company" | "url">;
type ToastState = {
  message: string;
  tone: "success" | "error";
  id: number;
} | null;
const statuses: Status[] = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected",
];
const roles = [
    "Frontend Developer",
    "Full-stack Developer",
    "Backend Developer",
    "Product Designer",
    "Data Analyst",
    "Project Manager",
  ],
  skills = [
    "React",
    "TypeScript",
    "JavaScript",
    "Node.js",
    "Python",
    "SQL",
    "Figma",
    "AWS",
    "Docker",
  ];
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({
  company: "",
  role: "",
  status: "Applied" as Status,
  dateApplied: today(),
  jobDescription: "",
  notes: "",
  url: "",
});
const isoDate = (value: string | null | undefined, fallback?: string) => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value ? new Date(value) : fallback ? new Date(fallback) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
};
const date = (value: string | null | undefined, fallback?: string) => {
  const x = isoDate(value, fallback);
  return x
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${x}T00:00:00`))
    : "Not set";
};
const updated = (value: string) =>
  Number.isNaN(new Date(value).getTime())
    ? "Recently"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(new Date(value));
const Wordmark = () => (
  <span className="wordmark">
    applywise<span>.</span>
  </span>
);

function Chips({
  label,
  items,
  setItems,
  suggestions,
  placeholder,
}: {
  label: string;
  items: string[];
  setItems: (v: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (value: string) => {
    const clean = value.trim();
    if (clean && !items.some((x) => x.toLowerCase() === clean.toLowerCase()))
      setItems([...items, clean]);
    setDraft("");
  };
  return (
    <div className="chip-field">
      <label>{label}</label>
      <div className="chip-box">
        {items.map((x) => (
          <span className="chip" key={x}>
            {x}
            <button
              type="button"
              aria-label={`Remove ${x}`}
              onClick={() => setItems(items.filter((y) => y !== x))}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={items.length ? "Add another" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      <div className="suggestions">
        {suggestions
          .filter(
            (x) => !items.some((y) => y.toLowerCase() === x.toLowerCase()),
          )
          .slice(0, 6)
          .map((x) => (
            <button type="button" key={x} onClick={() => add(x)}>
              + {x}
            </button>
          ))}
      </div>
    </div>
  );
}

function App() {
  const [userId, setUserId] = useState(
    () => localStorage.getItem("applywise-user-id") || "",
  );
  const [modal, setModal] = useState<"login" | "register" | "about" | null>(
      null,
    ),
    [auth, setAuth] = useState({ email: "", password: "", confirmPassword: "" }),
    [authBusy, setAuthBusy] = useState(false);
  const [apps, setApps] = useState<Application[]>([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [matches, setMatches] = useState<Match[]>([]),
    [form, setForm] = useState(blank),
    [toast, setToast] = useState<ToastState>(null),
    [busy, setBusy] = useState(false),
    [updatingId, setUpdatingId] = useState<string | null>(null);
  const [workspaceModal, setWorkspaceModal] = useState<
    "add" | "matches" | null
  >(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [appPage, setAppPage] = useState(0),
    [matchPage, setMatchPage] = useState(0),
    [appFilter, setAppFilter] = useState<Status | "All">("All"),
    [appQuery, setAppQuery] = useState(""),
    [recentJobs, setRecentJobs] = useState<RecentJob[]>([]),
    [appDateFilter, setAppDateFilter] = useState<
      "All" | "Today" | "7 days" | "30 days"
    >("All");
  const timer = useRef<number | undefined>(undefined);
  const headers: Record<string, string> = userId ? { "x-user-id": userId } : {};
  const tell = (message: string, tone: "success" | "error" = "success") => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ message, tone, id });
    timer.current = window.setTimeout(
      () => setToast((x) => (x?.id === id ? null : x)),
      3000,
    );
  };
  const normalize = (app: Application) => ({
    ...app,
    dateApplied: isoDate(app.dateApplied, app.createdAt),
  });
  const load = () => {
    if (!userId) return;
    void fetch("/api/applications", { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((x: Application[]) => setApps(x.map(normalize)));
    void fetch("/api/profile", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile);
    void fetch("/api/job-matches", { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMatches);
  };
  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [userId]);
  useEffect(() => {
    const key = `applywise-recent-jobs-${userId}`;
    try {
      const saved = userId ? JSON.parse(localStorage.getItem(key) || "[]") : [];
      setRecentJobs(Array.isArray(saved) ? saved.slice(0, 10) : []);
    } catch {
      setRecentJobs([]);
    }
  }, [userId]);
  const recordJobView = (match: RecentJob) => {
    if (!userId) return;
    const job: RecentJob = {
      id: match.id,
      title: match.title,
      company: match.company,
      url: match.url,
    };
    setRecentJobs((current) => {
      const next = [
        job,
        ...current.filter(
          (item) =>
            item.company.toLowerCase() !== job.company.toLowerCase() ||
            item.title.toLowerCase() !== job.title.toLowerCase(),
        ),
      ].slice(0, 10);
      localStorage.setItem(`applywise-recent-jobs-${userId}`, JSON.stringify(next));
      return next;
    });
  };
  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!modal || modal === "about") return;
    if (modal === "register" && auth.password !== auth.confirmPassword)
      return tell("Passwords do not match.", "error");
    setAuthBusy(true);
    const r = await fetch(`/api/auth/${modal}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      }),
      d = await r.json().catch(() => ({ error: "The server is unavailable." }));
    setAuthBusy(false);
    if (!r.ok) return tell(d.error || "Could not continue.", "error");
    localStorage.setItem("applywise-user-id", d.userId);
    setUserId(d.userId);
    setModal(null);
    setAuth({ email: "", password: "", confirmPassword: "" });
    tell("Welcome to Applywise.");
  }
  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    body.append("resume", file);
    const r = await fetch("/api/resume/pdf", { method: "POST", headers, body }),
      d = await r
        .json()
        .catch(() => ({ error: "Could not import that resume." }));
    setBusy(false);
    if (!r.ok) return tell(d.error, "error");
    setProfile(d.profile);
    tell("Resume imported. Review your search profile.");
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const r = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(profile),
    });
    tell(
      r.ok ? "Search profile saved." : "Could not save your profile.",
      r.ok ? "success" : "error",
    );
  }
  async function find() {
    if (!profile)
      return tell("Upload a resume and save your profile first.", "error");
    const saved = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(profile),
    });
    if (!saved.ok) return tell("Could not save your search profile.", "error");
    setBusy(true);
    const r = await fetch("/api/job-matches/search", {
        method: "POST",
        headers,
      }),
      d = await r.json().catch(() => ({ error: "Could not find matches." }));
    setBusy(false);
    if (!r.ok) return tell(d.error, "error");
    setMatches(d);
    setMatchPage(0);
    tell(d.length ? `${d.length} tailored roles found.` : "No matches yet.");
    if (d.length) setWorkspaceModal("matches");
  }
  async function addMatch(match: Match) {
    const r = await fetch(`/api/job-matches/${match.id}/add`, {
        method: "POST",
        headers,
      }),
      saved = await r.json().catch(() => null);
    if (!r.ok) return tell(saved?.error || "Could not add this role.", "error");
    if (saved)
      setApps((x) => [normalize(saved), ...x.filter((y) => y.id !== saved.id)]);
    tell("Added to your tracker.");
  }
  async function addApp(e: FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(form),
      }),
      item = await r.json().catch(() => null);
    if (!r.ok)
      return tell(
        item?.error || "Complete the required application details.",
        "error",
      );
    setApps((x) => [normalize(item), ...x]);
    setForm(blank());
    setWorkspaceModal(null);
    tell("Application added.");
  }
  async function changeStatus(app: Application, status: Status) {
    setUpdatingId(app.id);
    const r = await fetch(`/api/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status }),
      }),
      saved = await r.json().catch(() => null);
    setUpdatingId(null);
    if (!r.ok) {
      return tell(
        saved?.error || "Could not update this application.",
        "error",
      );
    }
    setApps((x) => x.map((y) => (y.id === app.id ? normalize(saved) : y)));
    tell(`Marked as ${status}.`);
  }
  const filtered = apps.filter((app) => {
      const q = appQuery.trim().toLowerCase(),
        d = isoDate(app.dateApplied, app.createdAt),
        days = d
          ? Math.floor(
              (Date.now() - new Date(`${d}T00:00:00`).getTime()) / 86400000,
            )
          : Infinity;
      return (
        (appFilter === "All" || app.status === appFilter) &&
        (!q ||
          [app.company, app.role].some((x) => x.toLowerCase().includes(q))) &&
        (appDateFilter === "All" ||
          (appDateFilter === "Today"
            ? days === 0
            : days >= 0 && days <= parseInt(appDateFilter)))
      );
    }),
    currentApps = filtered.slice(appPage * 5, appPage * 5 + 5),
    currentMatches = matches.slice(matchPage * 4, matchPage * 4 + 4);
  if (!userId)
    return (
      <Landing
        open={setModal}
        modal={modal}
        close={() => setModal(null)}
        auth={auth}
        setAuth={setAuth}
        submit={signIn}
        busy={authBusy}
        toast={toast}
      />
    );
  return (
    <main className="app-shell">
      <nav className="site-nav">
        <a className="brand" href="#dashboard" aria-label="Applywise home">
          <Wordmark />
        </a>
        <div className="nav-actions">
          <button
            className="nav-link"
            onClick={() => setLogoutConfirm(true)}
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </nav>
      <header id="dashboard" className="dashboard-hero">
        <div>
          <p className="overline">JOB SEARCH WORKSPACE</p>
          <h1>
            Move every application <em>forward.</em>
          </h1>
          <p>
            {apps.length} opportunit{apps.length === 1 ? "y" : "ies"} organized
            in one focused workspace.
          </p>
        </div>
        <div className="dashboard-actions">
          <button
            className="secondary-action"
            onClick={() => setWorkspaceModal("matches")}
          >
            <ScanSearch size={17} />
            Discover Jobs
          </button>
          <button className="primary" onClick={() => setWorkspaceModal("add")}>
            <Plus size={17} />
            Add application
          </button>
        </div>
      </header>
      <section className="metric-row">
        <Metric label="Applications" value={apps.length} />
        <Metric
          label="In progress"
          value={
            apps.filter((x) => ["Screening", "Interview"].includes(x.status))
              .length
          }
        />
        <Metric
          label="Interviews"
          value={apps.filter((x) => x.status === "Interview").length}
        />
      </section>
      <section className="card discovery">
        <div className="discovery-intro">
          <span className="icon-well">
            <FileText size={19} />
          </span>
          <p className="overline">RESUME-POWERED DISCOVERY</p>
          <h2>Find roles worth pursuing</h2>
          <p>
            Upload your resume once, refine the details that matter, and find
            opportunities aligned with your experience.
          </p>
          <label className="upload-button">
            <Upload size={17} />
            {profile ? "Replace resume PDF" : "Upload resume PDF"}
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) =>
                e.target.files?.[0] && void upload(e.target.files[0])
              }
            />
          </label>
        </div>
        {profile && (
          <form className="profile-form" onSubmit={saveProfile}>
            <Chips
              label="Target roles"
              items={profile.targetRoles}
              setItems={(targetRoles) =>
                setProfile({ ...profile, targetRoles })
              }
              suggestions={roles}
              placeholder="Add a role"
            />
            <Chips
              label="Skills"
              items={profile.skills}
              setItems={(skills) => setProfile({ ...profile, skills })}
              suggestions={skills}
              placeholder="Add a skill"
            />
            <label>
              City / area
              <input
                value={profile.location}
                placeholder="e.g. Quezon City, Metro Manila"
                onChange={(e) =>
                  setProfile({ ...profile, location: e.target.value })
                }
              />
            </label>
            <div className="profile-actions">
              <button className="secondary-action">
                <Check size={16} />
                Save profile
              </button>
              <button
                type="button"
                className="primary"
                onClick={find}
                disabled={busy}
              >
                <ScanSearch size={16} />
                Find matches
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="workspace">
        <section className="main-column">
          <section className="card applications">
            <Title
              overline="YOUR APPLICATIONS"
              title="Tracker"
              text="Keep your next steps visible and update each stage in place."
            />
            <div className="tracker-filters">
              <input
                value={appQuery}
                onChange={(e) => {
                  setAppQuery(e.target.value);
                  setAppPage(0);
                }}
                placeholder="Search company or role"
                aria-label="Search applications"
              />
              <select
                value={appFilter}
                onChange={(e) => {
                  setAppFilter(e.target.value as Status | "All");
                  setAppPage(0);
                }}
                aria-label="Filter by status"
              >
                <option value="All">All statuses</option>
                {statuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                value={appDateFilter}
                onChange={(e) => {
                  setAppDateFilter(e.target.value as typeof appDateFilter);
                  setAppPage(0);
                }}
                aria-label="Filter by applied date"
              >
                <option value="All">Any date</option>
                <option value="Today">Applied today</option>
                <option value="7 days">Last 7 days</option>
                <option value="30 days">Last 30 days</option>
              </select>
            </div>
            {apps.length ? (
              <>
                <div className="app-list">
                  {currentApps.map((app) => (
                    <article className="app-row" key={app.id}>
                      <div className="app-identity">
                        <b>{app.company}</b>
                        <span>{app.role}</span>
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noreferrer">
                            View posting <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <label
                        className={`status-select ${app.status.toLowerCase()}`}
                      >
                        <span className="sr-only">
                          Update status for {app.company}
                        </span>
                        <select
                          value={app.status}
                          disabled={updatingId === app.id}
                          onChange={(e) =>
                            void changeStatus(app, e.target.value as Status)
                          }
                        >
                          {statuses.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <div className="app-dates">
                        <small>
                          Applied {date(app.dateApplied, app.createdAt)}
                        </small>
                        <small>Updated {updated(app.updatedAt)}</small>
                      </div>
                    </article>
                  ))}
                </div>
                <Pagination
                  page={appPage}
                  total={filtered.length}
                  size={5}
                  set={setAppPage}
                />
              </>
            ) : (
              <div className="empty-state">
                <LayoutDashboard size={25} />
                <h3>Your tracker is ready</h3>
                <p>Add an application or save a match to get started.</p>
              </div>
            )}
          </section>
        </section>
        <aside className="card recent-searches">
          <h2>Recently viewed</h2>
          <p>Roles you opened from Discover matches.</p>
          {recentJobs.length ? (
            <ul className="recent-jobs-list">
              {recentJobs.map((job) => (
                <li key={`${job.company}-${job.title}`}>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => recordJobView(job)}
                  >
                    <b>{job.title}</b>
                    <span>{job.company}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="recent-jobs-empty">No jobs viewed yet.</p>
          )}
        </aside>
      </section>
      {false && matches.length > 0 && (
        <section className="card matches" id="matches">
          <div className="section-head">
            <Title
              overline="RECOMMENDED FOR YOU"
              title="Possible matches"
              text="A clear view of why each role may fit."
            />
            <button className="text-button" onClick={find}>
              Refresh <RefreshCw size={15} />
            </button>
          </div>
          <div className="match-grid">
            {currentMatches.map((match) => {
              const tracked = apps.find(
                (app) =>
                  app.company.trim().toLowerCase() ===
                    match.company.trim().toLowerCase() &&
                  app.role.trim().toLowerCase() ===
                    match.title.trim().toLowerCase(),
              );
              return (
                <article key={match.id} className="match">
                  <div
                    className={`match-score ${match.band.replace(" ", "-").toLowerCase()}`}
                  >
                    <strong>{match.score}%</strong>
                    <small>match</small>
                  </div>
                  <div className="match-content">
                    <b>{match.title}</b>
                    <p>
                      {match.company}
                      <span>•</span>
                      <MapPin size={13} />
                      {match.location}
                    </p>
                    <div className="reason-chips">
                      {match.reasons.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                    <small>via {match.source}</small>
                  </div>
                  <div className="match-actions">
                    <a
                      href={match.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => recordJobView(match)}
                    >
                      View job <ExternalLink size={14} />
                    </a>
                    <button
                      className="secondary-action"
                      onClick={() => addMatch(match)}
                      disabled={Boolean(tracked)}
                    >
                      {tracked
                        ? `In tracker · ${tracked.status}`
                        : "Add to tracker"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={matchPage}
            total={matches.length}
            size={4}
            set={setMatchPage}
          />
        </section>
      )}
      <WorkspaceModal
        kind={workspaceModal}
        close={() => setWorkspaceModal(null)}
        form={form}
        setForm={setForm}
        submit={addApp}
        matches={currentMatches}
        totalMatches={matches.length}
        apps={apps}
        addMatch={addMatch}
        recordJobView={recordJobView}
        refresh={find}
        page={matchPage}
        setPage={setMatchPage}
      />
      {logoutConfirm && (
        <LogoutConfirm
          close={() => setLogoutConfirm(false)}
          logout={() => {
            localStorage.removeItem("applywise-user-id");
            setLogoutConfirm(false);
            setUserId("");
          }}
        />
      )}
      {busy && (
        <div className="analyzing">
          <LoaderCircle size={18} />
          Working on it…
        </div>
      )}
      <Toast toast={toast} />
    </main>
  );
}

function Landing({
  open,
  modal,
  close,
  auth,
  setAuth,
  submit,
  busy,
  toast,
}: {
  open: (x: "login" | "register" | "about" | null) => void;
  modal: "login" | "register" | "about" | null;
  close: () => void;
  auth: { email: string; password: string; confirmPassword: string };
  setAuth: (x: {
    email: string;
    password: string;
    confirmPassword: string;
  }) => void;
  submit: (e: FormEvent) => void;
  busy: boolean;
  toast: ToastState;
}) {
  const [showRenderNotice, setShowRenderNotice] = useState(true);
  return (
    <main className="landing">
      <nav className="site-nav">
        <a className="brand" href="#top">
          <Wordmark />
        </a>
        <div className="nav-actions">
          <button className="nav-link" onClick={() => open("about")}>
            About
          </button>
          <button className="nav-link" onClick={() => open("login")}>
            Log in
          </button>
          <button className="primary compact" onClick={() => open("register")}>
            Create account
          </button>
        </div>
      </nav>
      <section id="top" className="landing-hero">
        <div>
          <p className="overline">A CALMER JOB SEARCH</p>
          <h1>
            Make your next move <em>with clarity.</em>
          </h1>
          <p>
            One focused workspace to track applications, discover relevant
            roles, and keep every next step moving.
          </p>
          <div className="hero-actions">
            <button className="primary large" onClick={() => open("register")}>
              Build my workspace <ArrowRight size={17} />
            </button>
            <button className="secondary-action" onClick={() => open("about")}>
              How it works
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="folder-tab">APPLICATIONS</div>
          <div className="folder-files">
            <article className="application-file file-back">
              <span className="file-mark" />
              <div>
                <small>INTERVIEW</small>
                <strong>Product Designer</strong>
                <p>Northstar Studio</p>
              </div>
            </article>
            <article className="application-file file-middle">
              <span className="file-mark" />
              <div>
                <small>SCREENING</small>
                <strong>Frontend Developer</strong>
                <p>Arc &amp; Co.</p>
              </div>
            </article>
            <article className="application-file file-front">
              <span className="file-mark complete" />
              <div>
                <small>APPLIED</small>
                <strong>Product Analyst</strong>
                <p>Horizon Labs</p>
              </div>
              <Check size={17} />
            </article>
          </div>
        </div>
      </section>
      <section className="landing-grid">
        <Feature
          icon={<BriefcaseBusiness />}
          title="A living tracker"
          text="Keep every opportunity, link, and stage in one clear view."
        />
        <Feature
          icon={<ScanSearch />}
          title="Smarter discovery"
          text="Turn your resume into a profile and surface roles that fit."
        />
        <Feature
          icon={<Sparkles />}
          title="Focused momentum"
          text="See what matters next and make every application count."
        />
      </section>
      <section className="landing-about">
        <p className="overline">BUILT FOR REAL JOB SEARCHES</p>
        <h2>
          Less spreadsheet. More <em>momentum.</em>
        </h2>
        <p>
          Applywise brings your application tracker and role discovery into one
          thoughtful, practical system.
        </p>
      </section>
      <footer className="landing-footer">
        <Wordmark />
        <p>Make your next move with clarity.</p>
        <div>
          <button onClick={() => open("about")}>About</button>
          <button onClick={() => open("login")}>Log in</button>
          <button onClick={() => open("register")}>Create account</button>
        </div>
        <small>© {new Date().getFullYear()} Applywise</small>
      </footer>
      {showRenderNotice && (
        <RenderNotice close={() => setShowRenderNotice(false)} />
      )}
      <Modal
        kind={modal}
        close={close}
        auth={auth}
        setAuth={setAuth}
        submit={submit}
        busy={busy}
        open={open}
      />
      <Toast toast={toast} />
    </main>
  );
}
function RenderNotice({ close }: { close: () => void }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [close]);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal service-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-notice-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close" aria-label="Close notice" onClick={close}>
          <X />
        </button>
        <span className="service-notice-icon">
          <RefreshCw size={21} />
        </span>
        <p className="overline">QUICK NOTE</p>
        <h2 id="service-notice-title">The app may take a moment to start.</h2>
        <p>
          Applywise is hosted on Render's free plan. If it has been inactive,
          the first request may take up to a minute while the service wakes up.
        </p>
        <button className="primary full service-notice-action" onClick={close}>
          Got it
        </button>
      </section>
    </div>
  );
}
const Feature = ({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) => (
  <article className="feature">
    <span className="icon-well">{icon}</span>
    <h2>{title}</h2>
    <p>{text}</p>
  </article>
);
const Metric = ({ label, value }: { label: string; value: number }) => (
  <article className="metric">
    <strong>{value}</strong>
    <span>{label}</span>
  </article>
);
const Title = ({
  overline,
  title,
  text,
}: {
  overline: string;
  title: string;
  text: string;
}) => (
  <div className="section-title">
    <div>
      <p className="overline">{overline}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  </div>
);
function Pagination({
  page,
  total,
  size,
  set,
}: {
  page: number;
  total: number;
  size: number;
  set: (x: number) => void;
}) {
  const pages = Math.ceil(total / size);
  return pages < 2 ? null : (
    <div className="pagination">
      <button disabled={page === 0} onClick={() => set(page - 1)}>
        <ChevronLeft size={16} />
        Previous
      </button>
      <span>
        {page + 1} of {pages}
      </span>
      <button disabled={page >= pages - 1} onClick={() => set(page + 1)}>
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function LogoutConfirm({
  close,
  logout,
}: {
  close: () => void;
  logout: () => void;
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [close]);
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal logout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="logout-icon">
          <LogOut size={21} />
        </span>
        <p className="overline">LEAVING APPLYWISE</p>
        <h2 id="logout-title">Log out of your workspace?</h2>
        <p>Your applications and profile will remain safely saved.</p>
        <div className="logout-actions">
          <button className="secondary-action" onClick={close} autoFocus>
            Stay logged in
          </button>
          <button className="primary logout-button" onClick={logout}>
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}

function WorkspaceModal({
  kind,
  close,
  form,
  setForm,
  submit,
  matches,
  totalMatches,
  apps,
  addMatch,
  recordJobView,
  refresh,
  page,
  setPage,
}: {
  kind: "add" | "matches" | null;
  close: () => void;
  form: ReturnType<typeof blank>;
  setForm: (form: ReturnType<typeof blank>) => void;
  submit: (event: FormEvent) => void;
  matches: Match[];
  totalMatches: number;
  apps: Application[];
  addMatch: (match: Match) => void;
  recordJobView: (match: RecentJob) => void;
  refresh: () => void;
  page: number;
  setPage: (page: number) => void;
}) {
  useEffect(() => {
    if (!kind) return;
    const key = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [kind]);
  if (!kind) return null;
  const isAdd = kind === "add";
  return (
    <div className="modal-backdrop workspace-backdrop" onMouseDown={close}>
      <section
        className={`modal workspace-modal ${isAdd ? "application-modal" : "matches-modal"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close" aria-label="Close dialog" onClick={close}>
          <X />
        </button>
        {isAdd ? (
          <>
            <p className="overline">TRACK AN OPPORTUNITY</p>
            <h2 id="workspace-modal-title">Add an application</h2>
            <p>Save the details you need to keep this opportunity moving.</p>
            <form className="application-form modal-form" onSubmit={submit}>
              <label>
                Company
                <input
                  required
                  autoFocus
                  placeholder="e.g. Acme Inc."
                  value={form.company}
                  onChange={(event) =>
                    setForm({ ...form, company: event.target.value })
                  }
                />
              </label>
              <label>
                Role
                <input
                  required
                  placeholder="e.g. Product Designer"
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value })
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as Status })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Date applied
                <input
                  type="date"
                  value={form.dateApplied}
                  onChange={(event) =>
                    setForm({ ...form, dateApplied: event.target.value })
                  }
                />
              </label>
              <label className="span-two">
                Job posting link
                <input
                  type="url"
                  placeholder="https://company.com/careers/job"
                  value={form.url}
                  onChange={(event) =>
                    setForm({ ...form, url: event.target.value })
                  }
                />
              </label>
              <div className="form-actions">
                <button className="primary">
                  <Plus size={16} />
                  Add application
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="section-head modal-head">
              <Title
                overline="RECOMMENDED FOR YOU"
                title="Possible matches"
                text="A clear view of why each role may fit."
              />
              <button className="text-button ad" onClick={refresh}>
                Refresh  <RefreshCw size={15} />
              </button>
            </div>
            {totalMatches ? (
              <>
                <div className="match-grid">
                  {matches.map((match) => {
                    const tracked = apps.find(
                      (app) =>
                        app.company.trim().toLowerCase() ===
                          match.company.trim().toLowerCase() &&
                        app.role.trim().toLowerCase() ===
                          match.title.trim().toLowerCase(),
                    );
                    return (
                      <article key={match.id} className="match">
                        <div
                          className={`match-score ${match.band.replace(" ", "-").toLowerCase()}`}
                        >
                          <strong>{match.score}%</strong>
                          <small>match</small>
                        </div>
                        <div className="match-content">
                          <b>{match.title}</b>
                          <p>
                            {match.company}
                            <span aria-hidden="true">&bull;</span>
                            <MapPin size={13} />
                            {match.location}
                          </p>
                          <div className="reason-chips">
                            {match.reasons.map((reason) => (
                              <span key={reason}>{reason}</span>
                            ))}
                          </div>
                          <small>via {match.source}</small>
                        </div>
                        <div className="match-actions">
                          <a
                            href={match.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => recordJobView(match)}
                          >
                            View job <ExternalLink size={14} />
                          </a>
                          <button
                            className="secondary-action"
                            onClick={() => addMatch(match)}
                            disabled={Boolean(tracked)}
                          >
                            {tracked
                              ? `In tracker · ${tracked.status}`
                              : "Add to tracker"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <Pagination
                  page={page}
                  total={totalMatches}
                  size={4}
                  set={setPage}
                />
              </>
            ) : (
              <div className="empty-state">
                <ScanSearch size={25} />
                <h3>No matches yet</h3>
                <p>Upload a resume, then select Find matches to get started.</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function Modal({
  kind,
  close,
  auth,
  setAuth,
  submit,
  busy,
  open,
}: {
  kind: "login" | "register" | "about" | null;
  close: () => void;
  auth: { email: string; password: string; confirmPassword: string };
  setAuth: (x: {
    email: string;
    password: string;
    confirmPassword: string;
  }) => void;
  submit: (e: FormEvent) => void;
  busy: boolean;
  open: (x: "login" | "register" | "about" | null) => void;
}) {
  const focus = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  useEffect(() => {
    if (!kind) return;
    focus.current?.focus();
    setShowPassword(false);
    setShowConfirmPassword(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [kind]);
  if (!kind) return null;
  const about = kind === "about";
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="Close dialog" onClick={close}>
          <X />
        </button>
        <Wordmark />
        <p className="overline">
          {about
            ? "ABOUT APPLYWISE"
            : kind === "login"
              ? "WELCOME BACK"
              : "START YOUR SEARCH"}
        </p>
        <h2 id="modal-title">
          {about
            ? "Built for the search behind your next chapter."
            : kind === "login"
              ? "Welcome back."
              : "Create your workspace."}
        </h2>
        <p>
          {about
            ? "Applywise turns scattered job-search tasks into a simple, personal system for tracking opportunities and discovering relevant roles."
            : kind === "login"
              ? "Log in to continue tracking your progress and exploring tailored matches."
              : "Create your private workspace in less than a minute."}
        </p>
        {!about && (
          <form className="auth-form" onSubmit={submit}>
            <label>
              Email
              <input
                ref={focus}
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    kind === "login" ? "current-password" : "new-password"
                  }
                  placeholder="At least 8 characters"
                  value={auth.password}
                  onChange={(e) =>
                    setAuth({ ...auth, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              <small>
                {kind === "register"
                  ? "Use at least 8 characters."
                  : "Enter the password for your account."}
              </small>
            </label>
            {kind === "register" && (
              <label>
                Confirm password
                <span className="password-field">
                  <input
                    required
                    minLength={8}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={auth.confirmPassword}
                    onChange={(e) =>
                      setAuth({ ...auth, confirmPassword: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </span>
              </label>
            )}
            <button className="primary full" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}{" "}
              {busy
                ? kind === "login"
                  ? "Logging in..."
                  : "Creating..."
                : kind === "login"
                  ? "Log in"
                  : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        {!about && (
          <p className="auth-switch">
            {kind === "login"
              ? "New to Applywise?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => open(kind === "login" ? "register" : "login")}
            >
              {kind === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
function Toast({ toast }: { toast: ToastState }) {
  return toast
    ? createPortal(
        <div
          className={`toast ${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.tone === "success" ? <Check size={17} /> : <X size={17} />}{" "}
          {toast.message}
        </div>,
        document.body,
      )
    : null;
}
class RenderBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="render-error">
        <Wordmark />
        <h1>Applywise couldn't load</h1>
        <p>{this.state.error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RenderBoundary>
      <App />
    </RenderBoundary>
  </StrictMode>,
);
