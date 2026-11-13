import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  linkWithCredential,
  updatePassword,
  updateProfile,
} from "@firebase/auth";
import { get, onValue, push, ref, update } from "@firebase/database";
import { auth, database, firebaseConfigError } from "./firebase";
import { usernameToAuthEmail, validateUsername } from "./username";
import { classAttendanceStatus, classMinutesLate } from "./classAttendance";
import { attendanceSessionForClass, formatMeetingTime, meetingDaysLabel, selectedMeetingDays } from "./classSchedule";
import "./App.css";

const APP_PAGES = new Set(["home", "classes", "account"]);

function readPage(search) {
  const requestedPage = new URLSearchParams(search).get("page");
  return APP_PAGES.has(requestedPage) ? requestedPage : "home";
}

function generateCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function authErrorMessage(error, mode) {
  switch (error?.code) {
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
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
    case "auth/requires-recent-login":
      return "For your security, sign out and sign in again before trying that change.";
    default:
      return `${mode === "signup" ? "Account creation" : mode === "guest" ? "Guest access" : "Sign-in"} failed (${error?.code ?? "unknown error"}). Please try again.`;
  }
}

function databaseErrorMessage(error, action) {
  if (error?.code === "PERMISSION_DENIED" || error?.code === "permission-denied") {
    return `Firebase denied ${action}. Check that database.rules.json is deployed and the signed-in user owns this class.`;
  }
  return `Could not ${action}: ${error?.message ?? "unknown database error"}`;
}

function Navigation({ page, onNavigate }) {
  const items = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "classes", label: "Classes", icon: "▤" },
    { id: "account", label: "Account", icon: "◉" },
  ];

  return (
    <nav className="app-nav" aria-label="Main navigation">
      {items.map((item) => (
        <button
          className="nav-item"
          key={item.id}
          type="button"
          aria-current={page === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function FeedbackFooter({ className = "" }) {
  return (
    <footer className={`app-footer ${className}`.trim()}>
      <a href="https://forms.gle/gu3r7aftXa8bx3eQ9" target="_blank" rel="noreferrer">Feedback</a>
    </footer>
  );
}

function AccountForm({ mode, onSubmit, onBack, busy, error, available }) {
  const isSignup = mode === "signup";

  return (
    <form className="account-form" onSubmit={onSubmit}>
      <h2>{isSignup ? "Create teacher account" : "Teacher sign-in"}</h2>
      {isSignup && (
        <label>
          Display name
          <input name="displayName" type="text" autoComplete="name" maxLength={60} required />
        </label>
      )}
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
      <FeedbackFooter />
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
      <FeedbackFooter />
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
  const [discussionResponse, setDiscussionResponse] = useState("");
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
    const response = discussionResponse.trim();
    if (classInfo?.requireDiscussionResponse && !response) {
      setError("Please answer the discussion prompt before checking in.");
      return;
    }
    try {
      const newCheckIn = push(ref(database, `checkins/${classId}`));
      if (!newCheckIn.key) throw new Error("Firebase did not create an attendance record ID.");
      const checkedInAt = Date.now();
      const checkedInTime = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: classInfo?.timeZone || undefined,
      }).format(checkedInAt);
      const sessionId = attendanceSessionForClass({ ...classInfo, id: classId }, checkedInAt).sessionId;
      if (!sessionId) {
        throw new Error("This class's recurring schedule is incomplete. Ask your instructor to update its settings.");
      }
      const checkInRecord = {
        name: student.name.trim(),
        studentId: student.studentId.trim(),
        status: "Present",
        checkedInTime,
        sessionId,
        arrivalStatus: classAttendanceStatus(
          checkedInAt,
          classInfo?.meetingTime,
          classInfo?.graceMinutes ?? 5,
          classInfo?.timeZone,
        ),
        sessionCode: code,
      };
      if (classInfo?.prompt && response) checkInRecord.discussionResponse = response;
      await update(newCheckIn, checkInRecord);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError?.code === "PERMISSION_DENIED" || submitError?.code === "permission-denied"
        ? "This QR code has expired or is invalid. Ask your instructor to refresh it."
        : databaseErrorMessage(submitError, "submit your check-in"));
    }
  };

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
          {classInfo?.prompt && (
            <label>
              <span className="student-prompt">{classInfo.prompt}</span>
              Your response{classInfo.requireDiscussionResponse ? " (required)" : " (optional)"}
              <textarea
                value={discussionResponse}
                onChange={(event) => setDiscussionResponse(event.target.value)}
                maxLength={1000}
                required={Boolean(classInfo.requireDiscussionResponse)}
              />
            </label>
          )}
          <button className="primary" type="submit">Submit check-in</button>
        </form>
        {error && <p className="firebase-error" role="alert">{error}</p>}
      </section>
      <FeedbackFooter />
    </main>
  );
}

function HomeDashboard({ onOpenClasses }) {
  return (
    <section className="home-dashboard" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-copy">
          <p className="eyebrow">Attendance, made simpler</p>
          <h1 id="welcome-title">Make every check-in count.</h1>
          <p>Create classes, share a QR code, and keep attendance organized in one place.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="sun-orbit" />
          <span className="sun" />
          <span className="horizon horizon-back" />
          <span className="horizon horizon-front" />
        </div>
      </div>
      <article className="overview-card">
        <div className="overview-icon" aria-hidden="true">▤</div>
        <div>
          <p className="overview-label">Your classes</p>
          <p className="overview-value">Manage attendance</p>
          <p className="overview-detail">Create a class and share its QR check-in code.</p>
          <button className="primary home-class-button" type="button" onClick={onOpenClasses}>Open classes</button>
        </div>
      </article>
    </section>
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

function ClassWorkspace({
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
  onRotateAttendance,
  onError,
  onCreateAccount,
  onEndGuest,
  guestSignup,
  onSignupSubmit,
  onSignupBack,
  busy,
  error,
  available,
  dataLoading,
}) {
  const [newClassName, setNewClassName] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [guestClassCreated, setGuestClassCreated] = useState(false);
  const [qrResult, setQrResult] = useState({ value: "", image: "", error: "" });
  const [activePanel, setActivePanel] = useState(null);
  const [recurringEnabled, setRecurringEnabled] = useState(Boolean(selectedClass?.recurring));
  const [now, setNow] = useState(Date.now);
  const rotatedSession = useRef("");
  const attendanceSession = selectedClass ? attendanceSessionForClass(selectedClass, now) : null;
  const activeSessionId = attendanceSession?.sessionId || "";
  const classRecords = records.filter((record) => (
    record.classId === selectedClassId
    && (
      !selectedClass?.recurring
      || (attendanceSession?.clearsAt && now < attendanceSession.clearsAt)
      || record.sessionId === activeSessionId
    )
  ));
  const checkInUrl = selectedClass?.sessionCode ? buildCheckInUrl(selectedClass) : "";
  const qrImage = qrResult.value === checkInUrl ? qrResult.image : "";
  const qrError = qrResult.value === checkInUrl ? qrResult.error : "";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      !selectedClass?.recurring
      || !activeSessionId
      || selectedClass.attendanceSessionId === activeSessionId
    ) return;
    const rotationKey = `${selectedClass.id}:${activeSessionId}`;
    if (rotatedSession.current === rotationKey) return;
    rotatedSession.current = rotationKey;
    onRotateAttendance(selectedClass, activeSessionId).catch((rotationError) => {
      rotatedSession.current = "";
      onError(databaseErrorMessage(rotationError, "prepare attendance for the next class meeting"));
    });
  }, [selectedClass, activeSessionId, now, onRotateAttendance, onError]);

  const endGuestSession = async () => {
    const confirmed = window.confirm(
      "End this guest session and permanently delete its class and attendance data? This cannot be undone. Create an account instead to keep your data.",
    );
    if (!confirmed) return;
    try {
      await onEndGuest();
    } catch (endError) {
      onError(databaseErrorMessage(endError, "end the guest session and delete its data"));
    }
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
      ["name", "studentId", "class", "status", "checkedInTime", "arrivalStatus", "discussionResponse"],
      ...classRecords.map((record) => [
        record.name,
        record.studentId,
        selectedClass.name,
        record.status,
        record.checkedInTime || (record.checkedInAt
          ? new Intl.DateTimeFormat("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
              timeZone: selectedClass.timeZone || undefined,
            }).format(record.checkedInAt)
          : ""),
        record.arrivalStatus || (record.checkedInAt
          ? classAttendanceStatus(
              record.checkedInAt,
              selectedClass.meetingTime,
              selectedClass.graceMinutes ?? 5,
              selectedClass.timeZone,
            )
          : "Unknown"),
        record.discussionResponse || "",
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
    <main className={`guest-main${activePanel ? " has-panel" : ""}`}>
      {user.isAnonymous && (
        <header className="guest-heading guest-session-heading">
          <div>
            <h1>Guest session</h1>
            <p>Your data is temporary. Create an account to keep this class and its attendance.</p>
          </div>
          <div className="guest-session-actions">
            {!guestSignup && <button className="secondary" type="button" onClick={onCreateAccount}>Create account</button>}
            {guestSignup && <button className="secondary" type="button" onClick={onSignupBack}>Back to class</button>}
            <button className="link-button" type="button" onClick={endGuestSession} disabled={busy || dataLoading}>
              End guest session
            </button>
          </div>
        </header>
      )}

      <section className="guest-class-panel" aria-label="Class attendance workspace">
        {error && !guestSignup && <p className="firebase-error" role="alert">{error}</p>}
        {guestSignup ? (
          <AccountForm
            mode="signup"
            onSubmit={onSignupSubmit}
            onBack={onSignupBack}
            busy={busy}
            error={error}
            available={available}
          />
        ) : (
          <>
        <div className="class-picker" aria-label="Classes">
          {classes.map((classItem) => (
            <button
              key={classItem.id}
              className={`class-tab${classItem.id === selectedClassId ? " is-selected" : ""}`}
              type="button"
              aria-pressed={classItem.id === selectedClassId}
              onClick={() => {
                onSelectClass(classItem.id);
                setRecurringEnabled(Boolean(classItem.recurring));
                setActivePanel(null);
              }}
            >
              {classItem.name}
            </button>
          ))}
          {(!user.isAnonymous || (classes.length === 0 && !guestClassCreated)) && <form
            className="new-class-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = newClassName.trim();
              if (!name || creatingClass) return;
              setCreatingClass(true);
              try {
                await onCreateClass(name);
                setNewClassName("");
                if (user.isAnonymous) setGuestClassCreated(true);
              } catch (createError) {
                onError(databaseErrorMessage(createError, "create the class"));
              } finally {
                setCreatingClass(false);
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
              disabled={creatingClass}
            />
            <button className="add-class-button" type="submit" aria-label="Create class" disabled={creatingClass}>+</button>
          </form>}
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
              <p>
                {selectedClass.recurring && `${meetingDaysLabel(selectedClass.meetingDays)} · `}
                {formatMeetingTime(selectedClass.meetingTime)}
              </p>
            </div>
            <div className={`qr-workspace${activePanel ? " with-panel" : ""}`}>
              <div className="qr-display" aria-live="polite">
                {qrImage && <img className="qr-image" src={qrImage} alt={`Check-in QR code for ${selectedClass.name}`} />}
                {!qrImage && !qrError && <p>Generating QR code…</p>}
                {qrError && <p className="firebase-error" role="alert">{qrError}</p>}
              </div>
              <aside className="qr-side-panel" aria-label="Class actions and responses">
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
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      setRecurringEnabled(Boolean(selectedClass.recurring));
                      setActivePanel((open) => open === "settings" ? null : "settings");
                    }}
                    aria-expanded={activePanel === "settings"}
                  >
                    {activePanel === "settings" ? "Close settings" : "Class settings"}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setActivePanel((open) => open === "responses" ? null : "responses")}
                    aria-expanded={activePanel === "responses"}
                  >
                    {activePanel === "responses" ? "Hide responses" : "View responses"}
                  </button>
                </div>
                <div className="class-export">
                  <span>{classRecords.length} response{classRecords.length === 1 ? "" : "s"}</span>
                  <button className="primary" type="button" onClick={exportClassCsv}>Export this class</button>
                </div>
              </aside>
              {activePanel === "responses" && (
                <section className="attendance-feed workspace-drawer" aria-label={`${selectedClass.name} responses`}>
                  <h3>Responses ({classRecords.length})</h3>
                  {classRecords.length === 0 ? (
                    <p className="attendance-empty">No one has checked in yet.</p>
                  ) : (
                    <ol>
                      {[...classRecords].sort((a, b) => (
                        String(b.checkedInTime ?? "").localeCompare(String(a.checkedInTime ?? ""))
                      )).map((record) => {
                        const checkedInTime = record.checkedInTime || (record.checkedInAt
                          ? new Intl.DateTimeFormat("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                              timeZone: selectedClass.timeZone || undefined,
                            }).format(record.checkedInAt)
                          : "");
                        const arrivalStatus = record.arrivalStatus || (record.checkedInAt
                          ? classAttendanceStatus(
                              record.checkedInAt,
                              selectedClass.meetingTime,
                              selectedClass.graceMinutes ?? 5,
                              selectedClass.timeZone,
                            )
                          : "Unknown");
                        const minutesLate = classMinutesLate(checkedInTime, selectedClass.meetingTime);
                        return (
                          <li key={record.id}>
                            <div className="attendance-feed-person">
                              <strong>{record.name}</strong>
                              <span>{record.studentId}</span>
                            </div>
                            <div className="attendance-feed-meta">
                              <time>{checkedInTime || "Time unavailable"}</time>
                              <span>{arrivalStatus === "Late" && minutesLate !== null
                                ? `Late · ${minutesLate} ${minutesLate === 1 ? "minute" : "minutes"}`
                                : arrivalStatus}</span>
                            </div>
                            {selectedClass.prompt && (
                              <p className="attendance-feed-response">
                                {record.discussionResponse || "No response"}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}
              {activePanel === "settings" && (
                <form
                  className="class-settings workspace-drawer"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    try {
                      const prompt = event.currentTarget.elements.namedItem("prompt").value.trim();
                      const requireDiscussionResponse = event.currentTarget.elements.namedItem("requireDiscussionResponse").checked;
                      const graceEnabled = event.currentTarget.elements.namedItem("graceEnabled").checked;
                      const graceValue = Number(event.currentTarget.elements.namedItem("graceMinutes").value);
                      const meetingDays = [...event.currentTarget.querySelectorAll('input[name="meetingDay"]:checked')]
                        .map((input) => Number(input.value))
                        .sort((a, b) => a - b);
                      if (requireDiscussionResponse && !prompt) {
                        throw new Error("Add a discussion prompt before requiring students to answer it.");
                      }
                      if (graceEnabled && (!Number.isInteger(graceValue) || graceValue < 1 || graceValue > 60)) {
                        throw new Error("Set the grace period to a whole number from 1 to 60 minutes, or turn it off.");
                      }
                      if (recurringEnabled && !meetingDays.length) {
                        throw new Error("Select at least one meeting day for a recurring class.");
                      }
                      await onUpdateClass(selectedClass.id, {
                        name: event.currentTarget.elements.namedItem("className").value.trim(),
                        meetingTime: event.currentTarget.elements.namedItem("meetingTime").value,
                        prompt,
                        requireDiscussionResponse,
                        graceMinutes: graceEnabled ? graceValue : 0,
                        recurring: recurringEnabled,
                        meetingDays: meetingDays.join(","),
                      });
                      setActivePanel(null);
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
                  <label className="setting-toggle">
                    <input
                      name="recurring"
                      type="checkbox"
                      checked={recurringEnabled}
                      onChange={(event) => setRecurringEnabled(event.target.checked)}
                    />
                    This class meets on a recurring weekly schedule
                  </label>
                  {recurringEnabled && (
                    <fieldset className="meeting-days">
                      <legend>Meeting days</legend>
                      {[
                        ["1", "Monday"],
                        ["2", "Tuesday"],
                        ["3", "Wednesday"],
                        ["4", "Thursday"],
                        ["5", "Friday"],
                        ["6", "Saturday"],
                        ["0", "Sunday"],
                      ].map(([value, label]) => (
                        <label className="meeting-day-option" key={value}>
                          <input
                            type="checkbox"
                            name="meetingDay"
                            value={value}
                            defaultChecked={selectedMeetingDays(selectedClass.meetingDays).includes(Number(value))}
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <label>
                    Discussion prompt
                    <textarea name="prompt" defaultValue={selectedClass.prompt || ""} maxLength={300} />
                  </label>
                  <label className="setting-toggle">
                    <input
                      name="requireDiscussionResponse"
                      type="checkbox"
                      defaultChecked={Boolean(selectedClass.requireDiscussionResponse)}
                    />
                    Require students to answer the discussion prompt
                  </label>
                  <label className="setting-toggle">
                    <input
                      name="graceEnabled"
                      type="checkbox"
                      defaultChecked={(selectedClass.graceMinutes ?? 5) > 0}
                    />
                    Allow a grace period after the meeting time
                  </label>
                  <label>
                    Grace period (minutes)
                    <input
                      name="graceMinutes"
                      type="number"
                      min="1"
                      max="60"
                      defaultValue={selectedClass.graceMinutes ?? 5}
                    />
                    <span className="account-hint">Uncheck the grace-period option to mark check-ins late immediately after the meeting time.</span>
                  </label>
                  <div className="settings-actions">
                    <button className="primary" type="submit">Save settings</button>
                    <button
                      className="link-button"
                      type="button"
                      onClick={async () => {
                        try {
                          await onDeleteClass(selectedClass);
                          if (user.isAnonymous) setGuestClassCreated(false);
                          setActivePanel(null);
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
            </div>
          </>
        )}
          </>
        )}
      </section>
      <FeedbackFooter />
    </main>
  );
}

function ProfileMenu({ user, classes, onNavigate, onOpenClass }) {
  const displayName = user.displayName || user.email?.split("@")[0] || "Account";
  const closeMenu = (event) => {
    const menu = event.currentTarget.closest("details");
    if (menu) menu.open = false;
  };

  return (
    <details className="profile-menu">
      <summary>{displayName}<span aria-hidden="true">⌄</span></summary>
      <div className="profile-menu-panel">
        <button type="button" onClick={(event) => { closeMenu(event); onNavigate("account"); }}>Account settings</button>
        <p>Your classes</p>
        {classes.length ? classes.map((classItem) => (
          <button
            key={classItem.id}
            type="button"
            onClick={(event) => { closeMenu(event); onOpenClass(classItem.id); }}
          >
            {classItem.name}
          </button>
        )) : <span className="profile-menu-empty">No classes yet</span>}
      </div>
    </details>
  );
}

function AccountPage({ user, onSaveProfile, onChangePassword, onSignOut, busy, error, onError }) {
  const username = user.email?.split("@")[0] || "Guest";
  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      await onSaveProfile(String(new FormData(event.currentTarget).get("displayName") || ""));
    } catch (saveError) {
      onError(saveError.message || "Could not save your profile.");
    }
  };
  const changePassword = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await onChangePassword(
        String(formData.get("currentPassword") || ""),
        String(formData.get("newPassword") || ""),
      );
      event.currentTarget.reset();
    } catch (passwordError) {
      onError(passwordError.message || "Could not change your password.");
    }
  };

  return (
    <section className="account-page" aria-labelledby="account-title">
      <div className="page-heading">
        <p className="eyebrow">Your QRise account</p>
        <h1 id="account-title">Account</h1>
        <p>{user.isAnonymous ? "You are using a guest account." : `Signed in as ${username}.`}</p>
      </div>
      {user.isAnonymous ? (
        <p className="local-data-note">Create an account to keep your class and attendance data.</p>
      ) : (
        <>
          <form className="account-form profile-form" onSubmit={saveProfile}>
            <label>
              Display name
              <input name="displayName" autoComplete="name" defaultValue={user.displayName || ""} maxLength={60} required />
            </label>
            <p className="account-hint">Your classes are saved to this account and will be available when you sign in again.</p>
            <button className="primary" type="submit" disabled={busy}>Save profile</button>
          </form>
          <form className="account-form profile-form" onSubmit={changePassword}>
            <h2>Change password</h2>
            <label>
              Current password
              <input name="currentPassword" type="password" autoComplete="current-password" required />
            </label>
            <label>
              New password
              <input name="newPassword" type="password" autoComplete="new-password" minLength="8" required />
            </label>
            <button className="primary" type="submit" disabled={busy}>Update password</button>
          </form>
        </>
      )}
      {error && <p className="firebase-error" role="alert">{error}</p>}
      <div className="account-actions">
        <button className="secondary" type="button" onClick={onSignOut} disabled={busy}>
          {user.isAnonymous ? "End guest session" : "Sign out"}
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState(auth ? "loading" : "error");
  const [view, setView] = useState("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(firebaseConfigError);
  const [classes, setClasses] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsClassId, setRecordsClassId] = useState("");
  const [recordsUid, setRecordsUid] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classesLoadedUid, setClassesLoadedUid] = useState("");
  const isStudentCheckIn = new URLSearchParams(window.location.search).has("checkin");
  const authAvailable = Boolean(auth);
  const [page, setPage] = useState(() => readPage(window.location.search));

  const navigate = useCallback((nextPage) => {
    setPage(nextPage);
    const search = nextPage === "home" ? "" : `?page=${encodeURIComponent(nextPage)}`;
    if (search !== window.location.search) {
      window.history.pushState(null, "", `${window.location.pathname}${search}`);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const restore = () => setPage(readPage(window.location.search));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthStatus("ready");
      setError("");
      if (!currentUser) {
        setClasses([]);
        setRecords([]);
        setRecordsClassId("");
        setRecordsUid("");
        setSelectedClassId("");
        setClassesLoadedUid("");
        setView("home");
      }
    }, (authError) => {
      setError(authErrorMessage(authError, "signin"));
      setAuthStatus("error");
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;

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
      setClasses([]);
      setClassesLoadedUid("");
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (
      !user
      || classesLoadedUid !== user.uid
      || !selectedClassId
      || !classes.some((item) => item.id === selectedClassId)
    ) return undefined;
    const unsubscribe = onValue(ref(database, `checkins/${selectedClassId}`), (snapshot) => {
      const nextRecords = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, classId: selectedClassId, ...value }))
        : [];
      setRecords(nextRecords);
      setRecordsClassId(selectedClassId);
      setRecordsUid(user.uid);
    }, (loadError) => {
      setError(databaseErrorMessage(loadError, "load attendance"));
    });
    return unsubscribe;
  }, [user, selectedClassId, classesLoadedUid, classes]);

  const selectedClass = classesLoadedUid === user?.uid
    ? classes.find((item) => item.id === selectedClassId) ?? null
    : null;

  const submitCredentials = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const displayName = String(formData.get("displayName") || "").trim();
    setError("");

    if (!validateUsername(username)) {
      setError("Username must be 3–24 characters and use only letters, numbers, underscores, or hyphens.");
      return;
    }
    if (view === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (view === "signup" && (!displayName || displayName.length > 60)) {
      setError("Display name must be between 1 and 60 characters.");
      return;
    }

    setBusy(true);
    try {
      const email = usernameToAuthEmail(username);
      if (!auth) {
        setError(firebaseConfigError || "Firebase Authentication is unavailable.");
        return;
      }
      if (view === "signup") {
        const accountCredential = auth.currentUser?.isAnonymous
          ? await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password))
          : await createUserWithEmailAndPassword(auth, email, password);
        const credential = accountCredential;
        await updateProfile(credential.user, { displayName });
        setUser(credential.user);
        setView("home");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
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
    if (user.isAnonymous && classes.length > 0) {
      throw new Error("Guest accounts can create only one class. Create an account to manage more classes.");
    }
    const classRef = push(ref(database, `owners/${user.uid}/classes`));
    if (!classRef.key) throw new Error("Firebase did not create a class ID.");
    const classItem = {
      name,
      meetingTime: "09:00",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      prompt: "",
      requireDiscussionResponse: false,
      graceMinutes: 5,
      sessionCode: generateCode(),
    };
    classItem.attendanceSessionId = attendanceSessionForClass({ ...classItem, id: classRef.key }).sessionId;
    await update(ref(database), {
      [`owners/${user.uid}/classes/${classRef.key}`]: classItem,
      [`publicClasses/${classRef.key}`]: {
        ownerUid: user.uid,
        name,
        prompt: "",
        meetingTime: classItem.meetingTime,
        timeZone: classItem.timeZone,
        requireDiscussionResponse: false,
        graceMinutes: 5,
        recurring: false,
        meetingDays: "",
        attendanceSessionId: classItem.attendanceSessionId,
      },
      [`sessionTokens/${classRef.key}`]: { ownerUid: user.uid, code: classItem.sessionCode },
    });
    setSelectedClassId(classRef.key);
  };

  const updateClass = async (classId, changes) => {
    const previous = classes.find((item) => item.id === classId);
    if (!previous) throw new Error("The selected class no longer exists.");
    const timeZone = previous.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const attendanceSessionId = attendanceSessionForClass({
      ...previous,
      ...changes,
      id: classId,
      timeZone,
    }).sessionId || "single";
    await update(ref(database), {
      [`owners/${user.uid}/classes/${classId}`]: {
        name: changes.name,
        meetingTime: changes.meetingTime,
        timeZone,
        prompt: changes.prompt,
        requireDiscussionResponse: changes.requireDiscussionResponse,
        graceMinutes: changes.graceMinutes,
        recurring: changes.recurring,
        meetingDays: changes.meetingDays,
        sessionCode: previous.sessionCode,
        attendanceSessionId,
      },
      [`publicClasses/${classId}/name`]: changes.name,
      [`publicClasses/${classId}/prompt`]: changes.prompt,
      [`publicClasses/${classId}/meetingTime`]: changes.meetingTime,
      [`publicClasses/${classId}/timeZone`]: timeZone,
      [`publicClasses/${classId}/requireDiscussionResponse`]: changes.requireDiscussionResponse,
      [`publicClasses/${classId}/graceMinutes`]: changes.graceMinutes,
      [`publicClasses/${classId}/recurring`]: changes.recurring,
      [`publicClasses/${classId}/meetingDays`]: changes.meetingDays,
      [`publicClasses/${classId}/attendanceSessionId`]: attendanceSessionId,
    });
  };

  const rotateAttendanceSession = useCallback(async (classItem, sessionId) => {
    const snapshot = await get(ref(database, `checkins/${classItem.id}`));
    const updates = {
      [`owners/${user.uid}/classes/${classItem.id}/attendanceSessionId`]: sessionId,
      [`publicClasses/${classItem.id}/attendanceSessionId`]: sessionId,
    };
    if (classItem.attendanceSessionId && snapshot.exists()) {
      for (const [recordId, record] of Object.entries(snapshot.val())) {
        if (record.sessionId !== sessionId) {
          updates[`checkins/${classItem.id}/${recordId}`] = null;
        }
      }
    }
    await update(ref(database), updates);
  }, [user]);

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

  const saveProfile = async (displayName) => {
    const cleanDisplayName = displayName.trim();
    if (!cleanDisplayName || cleanDisplayName.length > 60) {
      throw new Error("Display name must be between 1 and 60 characters.");
    }
    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
      throw new Error("Sign in to a teacher account before saving profile details.");
    }
    setBusy(true);
    setError("");
    try {
      await updateProfile(auth.currentUser, { displayName: cleanDisplayName });
      setUser({ ...auth.currentUser });
    } catch (profileError) {
      setError(`Could not save your profile: ${profileError?.message ?? "unknown authentication error"}`);
      throw profileError;
    } finally {
      setBusy(false);
    }
  };

  const changeAccountPassword = async (currentPassword, newPassword) => {
    const currentUser = auth?.currentUser;
    if (!currentUser || currentUser.isAnonymous || !currentUser.email) {
      throw new Error("Sign in to a teacher account before changing its password.");
    }
    if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
    setBusy(true);
    setError("");
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
    } catch (passwordError) {
      if (passwordError?.code === "auth/wrong-password" || passwordError?.code === "auth/invalid-credential") {
        throw new Error("The current password is incorrect.", { cause: passwordError });
      }
      if (passwordError?.code === "auth/weak-password") {
        throw new Error("Choose a stronger password that meets Firebase's password policy.", { cause: passwordError });
      }
      throw new Error(`Could not change your password: ${passwordError?.message ?? "unknown authentication error"}`, { cause: passwordError });
    } finally {
      setBusy(false);
    }
  };

  const endGuestSession = async () => {
    if (!user?.isAnonymous || !auth?.currentUser || auth.currentUser.uid !== user.uid) {
      throw new Error("The guest session is no longer active.");
    }
    if (classesLoadedUid !== user.uid) {
      throw new Error("Wait for the guest class data to finish loading, then try again.");
    }

    setBusy(true);
    setError("");
    try {
      const removals = {};
      for (const classItem of classes) {
        removals[`owners/${user.uid}/classes/${classItem.id}`] = null;
        removals[`publicClasses/${classItem.id}`] = null;
        removals[`sessionTokens/${classItem.id}`] = null;
        removals[`checkins/${classItem.id}`] = null;
      }
      if (Object.keys(removals).length) await update(ref(database), removals);
      await signOut(auth);
      setView("home");
    } catch (endError) {
      throw new Error(`Could not end the guest session safely: ${endError?.message ?? "unknown error"}`, { cause: endError });
    } finally {
      setBusy(false);
    }
  };

  const openClass = (classId) => {
    setSelectedClassId(classId);
    navigate("classes");
  };

  if (authStatus === "loading") {
    return (
      <main className="welcome-page">
        <section className="welcome-sheet"><h1>Here!</h1><p>Connecting…</p></section>
        <FeedbackFooter />
      </main>
    );
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
  if (!user) {
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

  if (user.isAnonymous) {
    return (
      <ClassWorkspace
        user={user}
        classes={classesLoadedUid === user.uid ? classes : []}
        records={recordsUid === user.uid && recordsClassId === selectedClassId ? records : []}
        selectedClass={selectedClass}
        selectedClassId={selectedClassId}
        onSelectClass={setSelectedClassId}
        onCreateClass={createClass}
        onUpdateClass={updateClass}
        onDeleteClass={deleteClass}
        onRefreshCode={refreshCode}
        onRotateAttendance={rotateAttendanceSession}
        onError={setError}
        onCreateAccount={() => { setError(""); setView("signup"); }}
        onEndGuest={endGuestSession}
        guestSignup={view === "signup"}
        onSignupSubmit={submitCredentials}
        onSignupBack={() => { setError(""); setView("home"); }}
        busy={busy}
        error={error}
        available={authAvailable}
        dataLoading={classesLoadedUid !== user.uid}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); navigate("home"); }}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>QRise</span>
        </a>
        <Navigation page={page} onNavigate={navigate} />
        <div className="profile-controls">
          <ProfileMenu
            user={user}
            classes={classesLoadedUid === user.uid ? classes : []}
            onNavigate={navigate}
            onOpenClass={openClass}
          />
          <button className="link-button profile-signout" type="button" onClick={handleSignOut} disabled={busy}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main" data-page={page}>
        {error && page !== "account" && <p className="firebase-error global-error" role="alert">{error}</p>}
        {page === "classes" ? (
          <ClassWorkspace
            user={user}
            classes={classesLoadedUid === user.uid ? classes : []}
            records={recordsUid === user.uid && recordsClassId === selectedClassId ? records : []}
            selectedClass={selectedClass}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            onCreateClass={createClass}
            onUpdateClass={updateClass}
            onDeleteClass={deleteClass}
            onRefreshCode={refreshCode}
            onRotateAttendance={rotateAttendanceSession}
            onError={setError}
            dataLoading={classesLoadedUid !== user.uid}
          />
        ) : page === "account" ? (
          <AccountPage
            user={user}
            onSaveProfile={saveProfile}
            onChangePassword={changeAccountPassword}
            onSignOut={handleSignOut}
            busy={busy}
            error={error}
            onError={setError}
          />
        ) : (
          <HomeDashboard onOpenClasses={() => navigate("classes")} />
        )}
        <FeedbackFooter />
      </main>
    </div>
  );
}
