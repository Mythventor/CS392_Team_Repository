import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
<<<<<<< HEAD
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "@firebase/auth";
import { get, onValue, push, ref, update } from "@firebase/database";
import { auth, database, firebaseConfigError } from "./firebase";
import { usernameToAuthEmail, validateUsername } from "./username";
=======
import AlarmManagement from "./alarms/AlarmManagement";
import { displayTime, repeatLabel } from "./alarms/model";
import { nextOccurrence } from "./alarm-system/scheduler";
import AlarmSystem from "./alarm-system/AlarmSystem";
import { readAlarms, readQrCodes, writeAlarms, writeQrCodes } from "./storage";
import { createQrPayload, findMatchingQrCode } from "./qr/model";
import CheckInPage, { CheckInHomeCard } from "./checkin/CheckIn";
import { locationSearch, readLocation } from "./checkin/model";
>>>>>>> 26ce73e83a285273d0ade50f5abe4a41945b6f67
import "./App.css";

function generateCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function authErrorMessage(error, mode) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "That username is already taken. Try another one.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Username or password is incorrect.";
    case "auth/weak-password":
      return "Choose a stronger password that meets the Firebase password policy.";
    case "auth/operation-not-allowed":
      return mode === "guest"
        ? "Guest access is not enabled. In Firebase Console, enable Authentication → Sign-in method → Anonymous."
        : "Username and password sign-in is not enabled. In Firebase Console, enable Authentication → Sign-in method → Email/Password.";
    case "auth/api-key-not-valid":
    case "auth/invalid-api-key":
      return "Firebase rejected the app's API key. Verify the key and project settings used by the deployed build.";
    case "auth/unauthorized-domain":
      return "This website is not authorized for Firebase Authentication. Add its hostname under Authentication → Settings → Authorized domains.";
    case "auth/network-request-failed":
      return "Could not reach Firebase. Check your network connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a little while before trying again.";
    default:
      return `${mode === "signup" ? "Account creation" : mode === "guest" ? "Guest access" : "Sign-in"} failed (${error?.code ?? "unknown error"}). Please try again.`;
  }
}

<<<<<<< HEAD
function databaseErrorMessage(error, action) {
  if (error?.code === "PERMISSION_DENIED" || error?.code === "permission-denied") {
    return `Firebase denied ${action}. Check that database.rules.json is deployed and the signed-in user owns this class.`;
  }
  return `Could not ${action}: ${error?.message ?? "unknown database error"}`;
}

function AccountForm({ mode, onSubmit, onBack, busy, error, available }) {
  const isSignup = mode === "signup";
=======
function Navigation({ page, onNavigate }) {
  const items = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "checkin", label: "Check-in", icon: "✓" },
    { id: "alarms", label: "Alarms", icon: "◷" },
    { id: "qr", label: "QR code", icon: "▦" },
  ];
>>>>>>> 26ce73e83a285273d0ade50f5abe4a41945b6f67

  return (
    <form className="account-form" onSubmit={onSubmit}>
      <h2>{isSignup ? "Create teacher account" : "Teacher sign-in"}</h2>
      <label>
        Username
        <input
          name="username"
          type="text"
          autoComplete="username"
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_-]{3,24}"
          title="Use 3–24 letters, numbers, underscores, or hyphens."
          required
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          required
        />
      </label>
      {isSignup && <p className="account-hint">Use at least 8 characters. Usernames are unique regardless of capitalization.</p>}
      {error && <p className="firebase-error" role="alert">{error}</p>}
      <div className="welcome-actions">
        <button className="primary" type="submit" disabled={busy || !available}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>
        <button className="secondary" type="button" onClick={onBack} disabled={busy}>Back</button>
      </div>
    </form>
  );
}

function WelcomePage({ view, setView, onSubmit, onGuest, busy, error, available }) {
  return (
    <main className="welcome-page">
      <section className="welcome-sheet" aria-labelledby="welcome-title">
        <div className="welcome-stamp" aria-hidden="true">H!</div>
        <h1 id="welcome-title">Here!</h1>
        {view === "home" ? (
          <>
            <div className="welcome-actions">
              <button className="primary" type="button" disabled={!available || busy} onClick={() => setView("signin")}>
                Teacher sign-in
              </button>
              <button className="secondary" type="button" disabled={!available || busy} onClick={() => setView("signup")}>
                Create teacher account
              </button>
              <button className="secondary" type="button" disabled={!available || busy} onClick={onGuest}>
                {busy ? "Connecting…" : "Continue as guest"}
              </button>
            </div>
            {error && <p className="firebase-error" role="alert">{error}</p>}
          </>
        ) : (
          <AccountForm
            mode={view}
            onSubmit={onSubmit}
            onBack={() => setView("home")}
            busy={busy}
            error={error}
            available={available}
          />
        )}
      </section>
    </main>
  );
}

function StudentMessage({ title, message }) {
  return (
    <main className="welcome-page">
      <section className="welcome-sheet">
        <h1>{title}</h1>
        {message && <p>{message}</p>}
      </section>
    </main>
  );
}

function StudentCheckInPage({ authStatus, user }) {
  const params = new URLSearchParams(window.location.search);
  const classId = params.get("checkin") ?? "";
  const code = params.get("code") ?? "";
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [student, setStudent] = useState({ name: "", studentId: "" });
  const [submitted, setSubmitted] = useState(false);
  const anonymousSignInStarted = useRef(false);

  useEffect(() => {
    if (!classId || !code || authStatus !== "ready") return undefined;
    if (!user) {
      if (anonymousSignInStarted.current) return undefined;
      anonymousSignInStarted.current = true;
      signInAnonymously(auth).catch((authError) => {
        setError(authErrorMessage(authError, "guest"));
        setLoading(false);
      });
      return undefined;
    }

    let active = true;
    get(ref(database, `publicClasses/${classId}`)).then((snapshot) => {
      if (!active) return;
      if (!snapshot.exists()) {
        setError("This class is unavailable. Ask your instructor for a current QR code.");
      } else {
        setClassInfo(snapshot.val());
      }
      setLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      setError(databaseErrorMessage(loadError, "load this check-in"));
      setLoading(false);
    });
    return () => { active = false; };
  }, [authStatus, classId, code, user]);

  const submitCheckIn = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const newCheckIn = push(ref(database, `checkins/${classId}`));
      if (!newCheckIn.key) throw new Error("Firebase did not create an attendance record ID.");
      await update(newCheckIn, {
        name: student.name.trim(),
        studentId: student.studentId.trim(),
        status: "Present",
        checkedInAt: Date.now(),
        sessionCode: code,
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError?.code === "PERMISSION_DENIED" || submitError?.code === "permission-denied"
        ? "This QR code has expired or is invalid. Ask your instructor to refresh it."
        : databaseErrorMessage(submitError, "submit your check-in"));
    }
  };

<<<<<<< HEAD
  if (!classId || !code) {
    return <StudentMessage title="Check-in unavailable" message="This QR link is incomplete. Ask your instructor for a current code." />;
  }
  if (authStatus === "error") {
    return <StudentMessage title="Check-in unavailable" message={error || firebaseConfigError || "Firebase guest access is unavailable. Contact your instructor."} />;
  }
  if (authStatus !== "ready" || loading) return <StudentMessage title="Loading…" />;
  if (error && !classInfo) return <StudentMessage title="Check-in unavailable" message={error} />;
  if (submitted) return <StudentMessage title="You're checked in!" message={classInfo?.name} />;

  return (
    <main className="welcome-page">
      <section className="student-sheet" aria-labelledby="student-checkin-title">
        <p className="student-class">{classInfo?.name}</p>
        <h1 id="student-checkin-title">Check in</h1>
        {classInfo?.prompt && <p className="student-prompt">{classInfo.prompt}</p>}
        <form className="class-form" onSubmit={submitCheckIn}>
          <label>
            Name
            <input
              autoComplete="name"
              value={student.name}
              onChange={(event) => setStudent((current) => ({ ...current, name: event.target.value }))}
              maxLength={120}
              required
            />
          </label>
          <label>
            Student ID
            <input
              autoComplete="off"
              value={student.studentId}
              onChange={(event) => setStudent((current) => ({ ...current, studentId: event.target.value }))}
              maxLength={80}
              required
            />
          </label>
          <button className="primary" type="submit">Submit check-in</button>
        </form>
        {error && <p className="firebase-error" role="alert">{error}</p>}
      </section>
    </main>
=======
function HomeDashboard({ alarms, onOpenCheckIn }) {
  const nextAlarm = useMemo(() => {
    const now = new Date();
    return alarms
      .filter((alarm) => alarm.enabled)
      .map((alarm) => ({ alarm, time: nextOccurrence(alarm, now) }))
      .filter((item) => item.time !== null)
      .sort((a, b) => a.time - b.time)[0] ?? null;
  }, [alarms]);
  const enabledCount = alarms.filter((alarm) => alarm.enabled).length;

  return (
    <section className="home-dashboard" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-copy">
          <p className="eyebrow">A better morning starts tonight</p>
          <h1 id="welcome-title">Rise with intention.</h1>
          <p>Pair alarms with printed QR codes, then get moving to scan one when it is time to rise. Now with QR check-in for classes, clubs, and events.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="sun-orbit" />
          <span className="sun" />
          <span className="horizon horizon-back" />
          <span className="horizon horizon-front" />
        </div>
      </div>
      <CheckInHomeCard onOpen={onOpenCheckIn} />
      <div className="overview-grid">
        <article className="overview-card next-alarm-card">
          <div className="overview-icon" aria-hidden="true">◷</div>
          <div>
            <p className="overview-label">Next alarm</p>
            {nextAlarm ? (
              <>
                <p className="overview-value">
                  {displayTime(nextAlarm.alarm.time).clock}
                  <span>{displayTime(nextAlarm.alarm.time).period}</span>
                </p>
                <p className="overview-detail">
                  {nextAlarm.alarm.label} · {new Date(nextAlarm.time).toLocaleDateString(undefined, { weekday: "long" })}
                </p>
              </>
            ) : (
              <>
                <p className="overview-value overview-empty">Nothing scheduled</p>
                <p className="overview-detail">Add an alarm to plan your next morning.</p>
              </>
            )}
          </div>
        </article>
        <article className="overview-card">
          <div className="overview-icon" aria-hidden="true">◉</div>
          <div>
            <p className="overview-label">Your schedule</p>
            <p className="overview-value">{enabledCount}<span>{enabledCount === 1 ? " alarm" : " alarms"}</span></p>
            <p className="overview-detail">{alarms.length - enabledCount} turned off</p>
          </div>
        </article>
      </div>
    </section>
>>>>>>> 26ce73e83a285273d0ade50f5abe4a41945b6f67
  );
}

function buildCheckInUrl(classItem) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("checkin", classItem.id);
  url.searchParams.set("code", classItem.sessionCode);
  return url.toString();
}

function GuestWorkspace({
  user,
  classes,
  records,
  selectedClass,
  selectedClassId,
  onSelectClass,
  onCreateClass,
  onUpdateClass,
  onDeleteClass,
  onRefreshCode,
  onError,
  onSignOut,
  dataLoading,
}) {
  const [newClassName, setNewClassName] = useState("");
  const [qrResult, setQrResult] = useState({ value: "", image: "", error: "" });
  const [settings, setSettings] = useState(false);
  const classRecords = records.filter((record) => record.classId === selectedClassId);
  const checkInUrl = selectedClass?.sessionCode ? buildCheckInUrl(selectedClass) : "";
  const qrImage = qrResult.value === checkInUrl ? qrResult.image : "";
  const qrError = qrResult.value === checkInUrl ? qrResult.error : "";

  const handleSignOut = () => {
    const confirmed = window.confirm(
      "Signing out ends access to this guest account and its classes. Continue only if you no longer need them.",
    );
    if (confirmed) onSignOut();
  };

  useEffect(() => {
    let active = true;
    if (!checkInUrl) return () => { active = false; };
    QRCode.toDataURL(checkInUrl, { errorCorrectionLevel: "M", margin: 2, width: 300 })
      .then((url) => {
        if (active) setQrResult({ value: checkInUrl, image: url, error: "" });
      })
      .catch((qrGenerationError) => {
        if (active) setQrResult({ value: checkInUrl, image: "", error: qrGenerationError.message || "QR code could not be generated." });
      });
    return () => { active = false; };
  }, [checkInUrl]);

  const exportClassCsv = () => {
    if (!selectedClass) return;
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["name", "studentId", "class", "status", "checkedInAt"],
      ...classRecords.map((record) => [
        record.name,
        record.studentId,
        selectedClass.name,
        record.status,
        new Date(record.checkedInAt).toISOString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedClass.name.replace(/[^a-z0-9_-]+/gi, "-")}-attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
<<<<<<< HEAD
    <main className="guest-main">
      <header className="guest-heading">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <h1>Here!</h1>
        <button className="link-button" type="button" onClick={handleSignOut}>End guest session</button>
      </header>

      <section className="guest-class-panel" aria-label="Guest attendance workspace">
        <div className="class-picker" aria-label="Classes">
          {classes.map((classItem) => (
            <button
              key={classItem.id}
              className={`class-tab${classItem.id === selectedClassId ? " is-selected" : ""}`}
              type="button"
              aria-pressed={classItem.id === selectedClassId}
              onClick={() => { onSelectClass(classItem.id); setSettings(false); }}
            >
              {classItem.name}
            </button>
          ))}
          <form
            className="new-class-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = newClassName.trim();
              if (!name) return;
              try {
                await onCreateClass(name);
                setNewClassName("");
              } catch (createError) {
                onError(databaseErrorMessage(createError, "create the class"));
              }
            }}
          >
            <input
              aria-label="New class name"
              placeholder="New class"
              value={newClassName}
              onChange={(event) => setNewClassName(event.target.value)}
              maxLength={100}
              required
            />
            <button className="add-class-button" type="submit" aria-label="Create class">+</button>
          </form>
=======
    <section className="qr-page" aria-labelledby="qr-title">
      <div className="page-heading">
        <p className="eyebrow">Make getting up a little more active</p>
        <h1 id="qr-title">Your QR code</h1>
        <p>Generate a unique code for each alarm, then print or save it somewhere you will need to get up to reach.</p>
      </div>
      {!alarms.length ? (
        <p className="qr-note">Create an alarm before generating its QR code.</p>
      ) : (
        <div className="qr-code-list">
          {alarms.map((alarm) => {
            const qrCode = qrCodes.find((item) => item.alarmId === alarm.id);
            return (
              <article
                className="qr-code-card"
                data-printing={printingCode === alarm.id ? "true" : undefined}
                key={alarm.id}
              >
                <div className="qr-code-art">
                  {qrCode
                    ? <QrCodeImage qrCode={qrCode} alarmLabel={alarm.label} />
                    : <div className="qr-placeholder" aria-hidden="true"><span className="qr-placeholder-icon">▦</span></div>}
                </div>
                <div className="qr-setup-copy">
                  <span className={`status-pill${qrCode ? " status-pill-ready" : ""}`}>
                    <span />{qrCode ? "Ready to print" : "Not set up"}
                  </span>
                  <h2>{alarm.label}</h2>
                  <p className="qr-alarm-time">
                    <span>{displayTime(alarm.time).clock} {displayTime(alarm.time).period}</span>
                    {" · "}{repeatLabel(alarm.days)}{alarm.enabled ? "" : " · Off"}
                  </p>
                  <p>
                    {qrCode
                      ? "This unique code is paired with this alarm. Scan it while this alarm is ringing to turn it off."
                      : "Create a one-of-a-kind code paired with this alarm. You can replace it later; the previous code will stop working."}
                  </p>
                  <div className="qr-code-actions">
                    <button className="primary" type="button" onClick={() => onCreate(alarm)}>
                      {qrCode ? "Replace QR code" : "Generate QR code"}
                    </button>
                    {qrCode && (
                      <button className="secondary" type="button" onClick={() => onPrint(alarm.id)}>Print QR code</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
>>>>>>> 26ce73e83a285273d0ade50f5abe4a41945b6f67
        </div>

        {dataLoading ? (
          <div className="empty-class"><p>Loading your classes…</p></div>
        ) : !selectedClass ? (
          <div className="empty-class">
            <h2>Start with a class</h2>
            <p>Create a class to generate its check-in QR code.</p>
          </div>
        ) : (
          <>
            <div className="qr-class-heading">
              <h2>{selectedClass.name}</h2>
              {selectedClass.meetingTime && <span>{selectedClass.meetingTime}</span>}
            </div>
            <div className="qr-display" aria-live="polite">
              {qrImage && <img className="qr-image" src={qrImage} alt={`Check-in QR code for ${selectedClass.name}`} />}
              {!qrImage && !qrError && <p>Generating QR code…</p>}
              {qrError && <p className="firebase-error" role="alert">{qrError}</p>}
            </div>
            <div className="qr-actions">
              <button
                className="secondary"
                type="button"
                onClick={async () => {
                  try {
                    await onRefreshCode(selectedClass);
                  } catch (refreshError) {
                    onError(databaseErrorMessage(refreshError, "refresh the QR code"));
                  }
                }}
              >
                Refresh code
              </button>
              <button className="secondary" type="button" disabled={!qrImage} onClick={() => window.open(qrImage, "_blank", "noopener,noreferrer")}>
                Open QR in new tab
              </button>
              <button className="secondary" type="button" onClick={() => setSettings((open) => !open)} aria-expanded={settings}>
                {settings ? "Close settings" : "Class settings"}
              </button>
            </div>

            {settings && (
              <form
                className="class-settings"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    await onUpdateClass(selectedClass.id, {
                      name: event.currentTarget.elements.namedItem("className").value.trim(),
                      meetingTime: event.currentTarget.elements.namedItem("meetingTime").value,
                      prompt: event.currentTarget.elements.namedItem("prompt").value.trim(),
                    });
                    setSettings(false);
                  } catch (updateError) {
                    onError(databaseErrorMessage(updateError, "save class settings"));
                  }
                }}
              >
                <label>
                  Class name
                  <input name="className" defaultValue={selectedClass.name} maxLength={100} required />
                </label>
                <label>
                  Meeting time
                  <input name="meetingTime" type="time" defaultValue={selectedClass.meetingTime || "09:00"} required />
                </label>
                <label>
                  Check-in prompt
                  <textarea name="prompt" defaultValue={selectedClass.prompt || ""} maxLength={300} />
                </label>
                <div className="settings-actions">
                  <button className="primary" type="submit">Save settings</button>
                  <button
                    className="link-button"
                    type="button"
                    onClick={async () => {
                      try {
                        await onDeleteClass(selectedClass);
                        setSettings(false);
                      } catch (deleteError) {
                        onError(databaseErrorMessage(deleteError, "remove the class"));
                      }
                    }}
                  >
                    Remove class
                  </button>
                </div>
              </form>
            )}
            <div className="class-export">
              <span>{classRecords.length} check-in{classRecords.length === 1 ? "" : "s"}</span>
              <button className="primary" type="button" onClick={exportClassCsv}>Export this class</button>
            </div>
          </>
        )}
        {user.isAnonymous && (
          <p className="local-data-note">Guest classes are linked to this browser’s anonymous account. Don’t clear browser data if you need to keep access.</p>
        )}
      </section>
    </main>
  );
}

function TeacherPage({ user, onSignOut, onContinueAsGuest, busy, error }) {
  const username = user.displayName || user.email?.split("@")[0] || "Teacher";
  return (
    <main className="welcome-page">
      <section className="welcome-sheet" aria-labelledby="welcome-title">
        <div className="welcome-stamp" aria-hidden="true">H!</div>
        <h1 id="welcome-title">Here!</h1>
        <h2 className="account-welcome">Welcome, {username}</h2>
        <p className="teacher-status-message">Teacher class management is not available yet.</p>
        {error && <p className="firebase-error" role="alert">{error}</p>}
        <div className="welcome-actions">
          <button className="primary" type="button" onClick={onContinueAsGuest} disabled={busy}>
            {busy ? "Connecting…" : "Continue as guest"}
          </button>
          <button className="secondary" type="button" onClick={onSignOut} disabled={busy}>Sign out</button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
<<<<<<< HEAD
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState(auth ? "loading" : "error");
  const [view, setView] = useState("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(firebaseConfigError);
  const [classes, setClasses] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsClassId, setRecordsClassId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classesLoadedUid, setClassesLoadedUid] = useState("");
  const isStudentCheckIn = new URLSearchParams(window.location.search).has("checkin");
  const authAvailable = Boolean(auth);
=======
  const [initial] = useState(getInitialAlarms);
  const [initialQr] = useState(getInitialQrCodes);
  const [alarms, setAlarms] = useState(initial.alarms);
  const [qrCodes, setQrCodes] = useState(initialQr.qrCodes);
  const [storageError, setStorageError] = useState(initial.error);
  const [qrStorageError, setQrStorageError] = useState(initialQr.error);
  const [printingCode, setPrintingCode] = useState("");
  // Where the user is (page + check-in view) lives in the address bar, so a refresh
  // reopens the same screen and the browser's Back button works.
  const [location, setLocation] = useState(() => readLocation(window.location.search));
  const { page, route: checkinRoute } = location;

  const go = useCallback((next) => {
    setLocation(next);
    const search = locationSearch(next);
    if (search !== window.location.search) {
      window.history.pushState(null, "", `${window.location.pathname}${search}`);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const restore = () => setLocation(readLocation(window.location.search));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const navigate = useCallback((nextPage) => go({ page: nextPage, route: null }), [go]);
  const changeCheckinRoute = useCallback((route) => go({ page: "checkin", route }), [go]);

  const updateAlarms = useCallback((nextAlarms) => {
    setAlarms(nextAlarms);
    try {
      writeAlarms(nextAlarms);
      setStorageError("");
    } catch {
      setStorageError("Your alarm changes are active for this session but could not be saved on this device.");
    }
  }, []);

  const disableAlarms = useCallback((ids) => {
    updateAlarms(
      alarms.map((alarm) => ids.includes(alarm.id) ? { ...alarm, enabled: false } : alarm),
    );
  }, [alarms, updateAlarms]);

  const saveQrCodes = useCallback((nextQrCodes) => {
    setQrCodes(nextQrCodes);
    try {
      writeQrCodes(nextQrCodes);
      setQrStorageError("");
    } catch {
      setQrStorageError("Your QR code changes are active for this session but could not be saved on this device.");
    }
  }, []);

  const createQrCode = useCallback((alarm) => {
    const id = crypto.randomUUID();
    saveQrCodes([
      ...qrCodes.filter((qrCode) => qrCode.alarmId !== alarm.id),
      { id, alarmId: alarm.id },
    ]);
  }, [qrCodes, saveQrCodes]);

  const scanAndVerify = useCallback(async ({ alarm, signal, video }) => {
    const { scanQrCode } = await import("./qr/scanner");
    const payload = await scanQrCode({ video, signal });
    if (payload === null || signal.aborted) return false;
    return findMatchingQrCode(payload, qrCodes, alarm.id) !== null;
  }, [qrCodes]);
>>>>>>> 26ce73e83a285273d0ade50f5abe4a41945b6f67

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthStatus("ready");
      setError("");
    }, (authError) => {
      setError(authErrorMessage(authError, "signin"));
      setAuthStatus("error");
    });
  }, []);

<<<<<<< HEAD
  useEffect(() => {
    if (!user?.isAnonymous) return undefined;

    const unsubscribe = onValue(ref(database, `owners/${user.uid}/classes`), (snapshot) => {
      const nextClasses = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value }))
        : [];
      setClasses(nextClasses);
      setSelectedClassId((current) => (
        nextClasses.some((item) => item.id === current) ? current : nextClasses[0]?.id ?? ""
      ));
      setClassesLoadedUid(user.uid);
      setError("");
    }, (loadError) => {
      setError(databaseErrorMessage(loadError, "load your classes"));
      setClassesLoadedUid(user.uid);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user?.isAnonymous || !selectedClassId) return undefined;
    const unsubscribe = onValue(ref(database, `checkins/${selectedClassId}`), (snapshot) => {
      const nextRecords = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, classId: selectedClassId, ...value }))
        : [];
      setRecords(nextRecords);
      setRecordsClassId(selectedClassId);
    }, (loadError) => {
      setError(databaseErrorMessage(loadError, "load attendance"));
    });
    return unsubscribe;
  }, [user, selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const submitCredentials = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    setError("");

    if (!validateUsername(username)) {
      setError("Username must be 3–24 characters and use only letters, numbers, underscores, or hyphens.");
      return;
    }
    if (view === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const email = usernameToAuthEmail(username);
      if (!auth) {
        setError(firebaseConfigError || "Firebase Authentication is unavailable.");
        return;
      }
      if (view === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (authError) {
      setError(authErrorMessage(authError, view));
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    if (!auth) {
      setError(firebaseConfigError || "Firebase Authentication is unavailable.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signOut(auth);
      await signInAnonymously(auth);
    } catch (authError) {
      setError(authErrorMessage(authError, "guest"));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError("");
    try {
      await signOut(auth);
      setView("home");
    } catch (authError) {
      setError(authErrorMessage(authError, "signin"));
    } finally {
      setBusy(false);
    }
  };

  const createClass = async (name) => {
    const classRef = push(ref(database, `owners/${user.uid}/classes`));
    if (!classRef.key) throw new Error("Firebase did not create a class ID.");
    const classItem = { name, meetingTime: "09:00", prompt: "", sessionCode: generateCode() };
    await update(ref(database), {
      [`owners/${user.uid}/classes/${classRef.key}`]: classItem,
      [`publicClasses/${classRef.key}`]: { ownerUid: user.uid, name, prompt: "" },
      [`sessionTokens/${classRef.key}`]: { ownerUid: user.uid, code: classItem.sessionCode },
    });
    setSelectedClassId(classRef.key);
  };

  const updateClass = async (classId, changes) => {
    const previous = classes.find((item) => item.id === classId);
    if (!previous) throw new Error("The selected class no longer exists.");
    await update(ref(database), {
      [`owners/${user.uid}/classes/${classId}`]: {
        name: changes.name,
        meetingTime: changes.meetingTime,
        prompt: changes.prompt,
        sessionCode: previous.sessionCode,
      },
      [`publicClasses/${classId}/name`]: changes.name,
      [`publicClasses/${classId}/prompt`]: changes.prompt,
    });
  };

  const refreshCode = async (classItem) => {
    const code = generateCode();
    await update(ref(database), {
      [`owners/${user.uid}/classes/${classItem.id}/sessionCode`]: code,
      [`sessionTokens/${classItem.id}`]: { ownerUid: user.uid, code },
    });
  };

  const deleteClass = async (classItem) => {
    await update(ref(database), {
      [`owners/${user.uid}/classes/${classItem.id}`]: null,
      [`publicClasses/${classItem.id}`]: null,
      [`sessionTokens/${classItem.id}`]: null,
      [`checkins/${classItem.id}`]: null,
    });
  };

  if (authStatus === "loading") {
    return <main className="welcome-page"><section className="welcome-sheet"><h1>Here!</h1><p>Connecting…</p></section></main>;
  }
  if (isStudentCheckIn) return <StudentCheckInPage authStatus={authStatus} user={user} />;
  if (authStatus === "error") {
    return (
      <WelcomePage
        view="home"
        setView={setView}
        onSubmit={submitCredentials}
        onGuest={continueAsGuest}
        busy={busy}
        error={error}
        available={false}
      />
    );
  }
  if (user?.isAnonymous) {
    return (
      <>
        {error && <p className="firebase-error global-error" role="alert">{error}</p>}
        <GuestWorkspace
          user={user}
          classes={classesLoadedUid === user.uid ? classes : []}
          records={recordsClassId === selectedClassId ? records : []}
          selectedClass={selectedClass}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          onCreateClass={createClass}
          onUpdateClass={updateClass}
          onDeleteClass={deleteClass}
          onRefreshCode={refreshCode}
          onError={setError}
          onSignOut={handleSignOut}
          dataLoading={classesLoadedUid !== user.uid}
=======
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); navigate("home"); }}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>QRise</span>
        </a>
        <Navigation page={page} onNavigate={navigate} />
        <span className="header-caption">Your morning, reimagined</span>
      </header>
      <main className="app-main" data-page={page}>
        {storageError && <p className="storage-alert" role="alert">{storageError}</p>}
        {qrStorageError && <p className="storage-alert" role="alert">{qrStorageError}</p>}
        {page === "checkin" ? (
          <CheckInPage route={checkinRoute} onRouteChange={changeCheckinRoute} />
        ) : page === "qr" ? (
          <QrSetup
            alarms={alarms}
            qrCodes={qrCodes}
            onCreate={createQrCode}
            onPrint={setPrintingCode}
            printingCode={printingCode}
          />
        ) : (
          <>
            {page === "home" && <HomeDashboard alarms={alarms} onOpenCheckIn={() => navigate("checkin")} />}
            <AlarmManagement alarms={alarms} onChange={updateAlarms} />
          </>
        )}
        <AlarmSystem
          alarms={alarms}
          onOneShotFired={disableAlarms}
          onFailsafe={disableAlarms}
          scanAndVerify={scanAndVerify}
>>>>>>> 26ce73e83a285273d0ade50f5abe4a41945b6f67
        />
      </>
    );
  }
  if (user) {
    return (
      <TeacherPage
        user={user}
        onSignOut={handleSignOut}
        onContinueAsGuest={continueAsGuest}
        busy={busy}
        error={error}
      />
    );
  }
  return (
    <WelcomePage
      view={view}
      setView={(nextView) => { setError(""); setView(nextView); }}
      onSubmit={submitCredentials}
      onGuest={continueAsGuest}
      busy={busy}
      error={error}
      available={authAvailable}
    />
  );
}
