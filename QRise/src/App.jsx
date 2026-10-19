import { useCallback, useMemo, useState } from "react";
import AlarmManagement from "./alarms/AlarmManagement";
import { displayTime } from "./alarms/model";
import { nextOccurrence } from "./alarm-system/scheduler";
import AlarmSystem from "./alarm-system/AlarmSystem";
import { readAlarms, writeAlarms } from "./storage";
import "./App.css";

function getInitialAlarms() {
  try {
    return { alarms: readAlarms(), error: "" };
  } catch {
    return {
      alarms: [],
      error: "Saved alarms could not be loaded. Create an alarm to replace the saved data.",
    };
  }
}

function Navigation({ page, onNavigate }) {
  const items = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "alarms", label: "Alarms", icon: "◷" },
    { id: "qr", label: "QR code", icon: "▦" },
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

function HomeDashboard({ alarms }) {
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
          <p>Set your alarms here. When QR scanning is connected, you’ll get moving to turn them off.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="sun-orbit" />
          <span className="sun" />
          <span className="horizon horizon-back" />
          <span className="horizon horizon-front" />
        </div>
      </div>
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
  );
}

function QrSetup() {
  return (
    <section className="qr-page" aria-labelledby="qr-title">
      <div className="page-heading">
        <p className="eyebrow">Make getting up a little more active</p>
        <h1 id="qr-title">Your QR code</h1>
        <p>Scan a code to dismiss a ringing alarm. QR setup is not connected yet.</p>
      </div>
      <article className="qr-setup-card">
        <div className="qr-placeholder" aria-hidden="true">
          <span className="qr-placeholder-icon">▦</span>
        </div>
        <div className="qr-setup-copy">
          <span className="status-pill"><span /> Not set up</span>
          <h2>QR tools are coming soon</h2>
          <p>
            QR code creation, saving, and camera scanning will be available when the QR feature is integrated.
            Your alarms can still be created and scheduled in the meantime.
          </p>
          <button className="secondary" type="button" disabled>
            QR setup unavailable
          </button>
        </div>
      </article>
      <p className="qr-note" role="status">
        Ringing alarms currently require a connected QR scanner to dismiss.
      </p>
    </section>
  );
}

export default function App() {
  const [initial] = useState(getInitialAlarms);
  const [alarms, setAlarms] = useState(initial.alarms);
  const [storageError, setStorageError] = useState(initial.error);
  const [page, setPage] = useState("home");

  const updateAlarms = useCallback((nextAlarms) => {
    setAlarms(nextAlarms);
    try {
      writeAlarms(nextAlarms);
      setStorageError("");
    } catch {
      setStorageError("Your alarm changes are active for this session but could not be saved on this device.");
    }
  }, []);

  const disableOneShots = useCallback((ids) => {
    updateAlarms(
      alarms.map((alarm) => ids.includes(alarm.id) ? { ...alarm, enabled: false } : alarm),
    );
  }, [alarms, updateAlarms]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setPage("home"); }}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>QRise</span>
        </a>
        <Navigation page={page} onNavigate={setPage} />
        <span className="header-caption">Your morning, reimagined</span>
      </header>
      <main className="app-main">
        {storageError && <p className="storage-alert" role="alert">{storageError}</p>}
        {page === "qr" ? (
          <QrSetup />
        ) : (
          <>
            {page === "home" && <HomeDashboard alarms={alarms} />}
            <AlarmManagement alarms={alarms} onChange={updateAlarms} />
          </>
        )}
        <AlarmSystem alarms={alarms} onOneShotFired={disableOneShots} />
        <footer className="app-footer">QRise · Plan a better morning</footer>
      </main>
    </div>
  );
}
