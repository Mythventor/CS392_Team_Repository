import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import AlarmManagement from "./alarms/AlarmManagement";
import { displayTime, repeatLabel } from "./alarms/model";
import { nextOccurrence } from "./alarm-system/scheduler";
import AlarmSystem from "./alarm-system/AlarmSystem";
import { readAlarms, readQrCodes, writeAlarms, writeQrCodes } from "./storage";
import { createQrPayload, findMatchingQrCode } from "./qr/model";
import CheckInPage, { CheckInHomeCard } from "./checkin/CheckIn";
import { locationSearch, readLocation } from "./checkin/model";
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
    { id: "checkin", label: "Check-in", icon: "✓" },
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

function getInitialQrCodes() {
  try {
    return { qrCodes: readQrCodes(), error: "" };
  } catch {
    return {
      qrCodes: [],
      error: "Saved QR codes could not be loaded. Generate a code to replace the saved data.",
    };
  }
}

function QrCodeImage({ qrCode, alarmLabel }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(createQrPayload(qrCode.id), {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 240,
    }).then((url) => {
      if (current) setImage(url);
    }).catch(() => {
      if (current) setError("This QR code image could not be generated.");
    });
    return () => { current = false; };
  }, [qrCode.id]);

  if (error) return <p role="alert">{error}</p>;
  return image
    ? <>
      <img className="qr-code-image" src={image} alt={`QR code paired with ${alarmLabel}`} />
      <a className="qr-image-download" href={image} download={`qrise-${alarmLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "alarm"}.png`}>
        Download image
      </a>
    </>
    : <p role="status">Preparing QR code…</p>;
}

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
  );
}

function QrSetup({ alarms, qrCodes, onCreate, onPrint, printingCode }) {
  return (
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
        </div>
      )}
      <p className="qr-note" role="status">Camera access is requested only when you choose to scan a code. Saved QR pairings stay on this device.</p>
    </section>
  );
}

export default function App() {
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

  useEffect(() => {
    if (!printingCode) return undefined;
    function finishPrint() {
      setPrintingCode("");
    }
    window.addEventListener("afterprint", finishPrint);
    window.print();
    return () => window.removeEventListener("afterprint", finishPrint);
  }, [printingCode]);

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
        />
        <footer className="app-footer">QRise · Plan a better morning</footer>
      </main>
    </div>
  );
}
