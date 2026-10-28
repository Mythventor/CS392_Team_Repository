import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { DAY_ORDER, DAYS, displayTime, repeatLabel } from "../alarms/model";
import { getCheckinBackend } from "./backend";
import {
  DEFAULT_EVENT,
  attendance,
  buildOccurrence,
  checkInLink,
  checkInTiming,
  cleanName,
  currentOccurrence,
  dateKey,
  inviteLink,
  occurrenceKeysFrom,
  parseCheckInLink,
  previousOccurrenceKeys,
  randomId,
  validateEvent,
} from "./model";
import { ACCEPTED_FILES, MAX_ROSTER, newNamesOnly, readNamesFile } from "./importNames";
import "./CheckIn.css";

const NAME_KEY = "qrise.checkinName";
const JOINED_KEY = "qrise.joinedEvents";
export const USED_KEY = "qrise.checkinUsed";

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
function rememberJoined(eventId) {
  const joined = readLocal(JOINED_KEY, []);
  if (!joined.includes(eventId)) writeLocal(JOINED_KEY, [...joined, eventId]);
  writeLocal(USED_KEY, true);
}

function appBaseUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function formatStamp(date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
function formatDay(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function eventTimeLabel(event) {
  const { clock, period } = displayTime(event.time);
  return `${clock} ${period}`;
}
function scheduleLabel(event) {
  if (!event.repeatDays.length) return `Once · ${formatDay(occurrenceStartDay(event.date))}`;
  return `${repeatLabel(event.repeatDays)} · from ${formatDay(occurrenceStartDay(event.date))}`;
}
function occurrenceStartDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function errorMessage(error) {
  if (error?.code === "permission-denied") return "You don't have permission to do that.";
  return error?.message || "Something went wrong. Try again.";
}

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function connectionMessage(error) {
  const code = error?.code ?? "";
  if (code === "auth/configuration-not-found" || code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation") {
    return "Check-in isn't set up yet: turn on Anonymous sign-in in the Firebase console (Authentication → Sign-in method → Anonymous).";
  }
  if (/not configured/i.test(error?.message ?? "")) {
    return "Check-in isn't set up for this site: Firebase settings were not found. See the Check-in section of the README.";
  }
  return "Check-in couldn't connect to the QRise database. Check your connection and reload the page.";
}

function useBackend() {
  const [state, setState] = useState({ backend: null, error: "" });
  useEffect(() => {
    let active = true;
    getCheckinBackend().then(
      (backend) => { if (active) setState({ backend, error: "" }); },
      (error) => { if (active) setState({ backend: null, error: connectionMessage(error) }); },
    );
    return () => { active = false; };
  }, []);
  return state;
}

// Subscribes while `subscribe` is non-null; resubscribes when `key` changes.
function useLive(subscribe, key, initial) {
  const [value, setValue] = useState({ key: null, data: initial, error: null });
  const enabled = Boolean(subscribe);
  const start = useEffectEvent((onData, onError) => subscribe(onData, onError));
  useEffect(() => {
    if (!enabled) return undefined;
    return start(
      (data) => setValue({ key, data, error: null }),
      (error) => setValue({ key, data: initial, error }),
    );
    // `initial` is a constant fallback for each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  if (!enabled || value.key !== key) return { data: initial, loading: enabled, error: null };
  return { data: value.data, loading: false, error: value.error };
}

function NameField({ name, onChange, label = "Your name" }) {
  return (
    <label className="ci-field">
      {label}
      <input
        value={name}
        maxLength={60}
        autoComplete="name"
        placeholder="e.g. Alex Kim"
        onChange={(e) => { onChange(e.target.value); writeLocal(NAME_KEY, e.target.value); }}
      />
    </label>
  );
}

function QrImage({ text, alt, downloadName }) {
  const [image, setImage] = useState({ text: null, url: "" });
  useEffect(() => {
    let current = true;
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: 320 })
      .then((url) => { if (current) setImage({ text, url }); })
      .catch(() => { if (current) setImage({ text, url: "" }); });
    return () => { current = false; };
  }, [text]);
  if (image.text !== text) return <p role="status" className="ci-muted">Preparing QR code…</p>;
  if (!image.url) return <p role="alert">This QR code image could not be generated.</p>;
  return (
    <>
      <img className="ci-qr" src={image.url} alt={alt} />
      <a className="qr-image-download" href={image.url} download={downloadName}>Download image</a>
    </>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }
  return <button type="button" className="secondary" onClick={copy}>{copied ? "Copied!" : label}</button>;
}

function EventEditor({ event, onSave, onClose }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(() => ({
    ...DEFAULT_EVENT,
    date: dateKey(new Date()),
    ...event,
  }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { dialog.current.showModal(); }, []);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const data = {
      title: cleanName(form.title),
      location: (form.location ?? "").trim().slice(0, 80),
      date: form.date,
      time: form.time,
      durationMinutes: Math.round(form.durationMinutes),
      repeatDays: [...form.repeatDays].sort(),
      opensMinutesBefore: Math.round(form.opensMinutesBefore),
      lateAfterMinutes: Math.round(form.lateAfterMinutes),
      roster: form.roster ?? [],
    };
    const problems = validateEvent(data);
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try { await onSave(data); }
    catch (error) { setErrors([errorMessage(error)]); setSaving(false); }
  }

  return (
    <dialog ref={dialog} className="ci-dialog" onCancel={onClose} aria-labelledby="event-editor-title">
      <form onSubmit={submit}>
        <div className="ci-dialog-heading">
          <h2 id="event-editor-title">{event ? "Edit event" : "New event"}</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <label className="ci-field">Event name
          <input value={form.title} maxLength={60} onChange={set("title")} placeholder="e.g. CS392 lecture" required autoFocus />
        </label>
        <label className="ci-field">Location <span className="ci-optional">optional</span>
          <input value={form.location} maxLength={80} onChange={set("location")} placeholder="e.g. Sanders 212" />
        </label>
        <div className="ci-field-row">
          <label className="ci-field">{form.repeatDays.length ? "Starts on" : "Date"}
            <input type="date" value={form.date} onChange={set("date")} required />
          </label>
          <label className="ci-field">Start time
            <input type="time" value={form.time} onChange={set("time")} required />
          </label>
        </div>
        <fieldset className="ci-fieldset">
          <legend>Repeat <span>{form.repeatDays.length ? repeatLabel(form.repeatDays) : "Does not repeat"}</span></legend>
          <div className="days">
            {DAY_ORDER.map((day) => (
              <button type="button" key={day} aria-pressed={form.repeatDays.includes(day)}
                onClick={() => setForm((f) => ({ ...f, repeatDays: f.repeatDays.includes(day) ? f.repeatDays.filter((d) => d !== day) : [...f.repeatDays, day] }))}>
                {DAYS[day]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="ci-field-row ci-field-row-3">
          <label className="ci-field">Length (min)
            <input type="number" min="5" max="1440" value={form.durationMinutes} onChange={set("durationMinutes")} />
          </label>
          <label className="ci-field">Opens (min before)
            <input type="number" min="0" max="1440" value={form.opensMinutesBefore} onChange={set("opensMinutesBefore")} />
          </label>
          <label className="ci-field">Late after (min)
            <input type="number" min="0" max="1440" value={form.lateAfterMinutes} onChange={set("lateAfterMinutes")} />
          </label>
        </div>
        {errors.map((error) => <p key={error} role="alert" className="ci-error">{error}</p>)}
        <div className="ci-dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : event ? "Save changes" : "Create event"}</button>
        </div>
      </form>
    </dialog>
  );
}

function ScanDialog({ onResult, onClose }) {
  const dialog = useRef(null);
  const video = useRef(null);
  const [message, setMessage] = useState("Point your camera at the event's QR code.");
  useEffect(() => {
    dialog.current.showModal();
    const controller = new AbortController();
    import("../qr/scanner")
      .then(({ scanQrCode }) => scanQrCode({ video: video.current, signal: controller.signal }))
      .then((payload) => {
        if (payload === null) return;
        const link = parseCheckInLink(payload);
        if (link) onResult(link);
        else setMessage("That isn't a QRise event code. Close this and try again.");
      })
      .catch(() => setMessage("Could not use the camera. Check camera access and try again."));
    return () => controller.abort();
  }, [onResult]);
  return (
    <dialog ref={dialog} className="ci-dialog" onCancel={onClose} aria-labelledby="scan-title">
      <div className="ci-dialog-heading">
        <h2 id="scan-title">Scan event code</h2>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
      <video className="qr-camera-preview" ref={video} aria-label="QR code camera preview" autoPlay muted playsInline />
      <p role="status" className="ci-muted">{message}</p>
    </dialog>
  );
}

function EventSummaryCard({ event, now, onOpen, role }) {
  const occurrence = currentOccurrence(event, now);
  const statusText = {
    open: "Check-in open now",
    upcoming: `Next: ${formatDay(occurrence.start)} · ${formatTime(occurrence.start)}`,
    ended: "No upcoming dates",
  }[occurrence.status];
  return (
    <article className="ci-event-card">
      <div>
        <span className={`status-pill${occurrence.status === "open" ? " status-pill-ready" : ""}`}><span />{statusText}</span>
        <h3>{event.title}</h3>
        <p className="ci-muted">
          <strong>{eventTimeLabel(event)}</strong> · {scheduleLabel(event)}{event.location ? ` · ${event.location}` : ""}
        </p>
        {role === "joined" && <p className="ci-muted">Organized by {event.ownerName || "someone else"}</p>}
      </div>
      <button type="button" className={role === "owner" ? "primary" : "secondary"} onClick={onOpen}>
        {role === "owner" ? "Manage" : "View"}
      </button>
    </article>
  );
}

function JoinedEventCard({ backend, eventId, now, onOpen }) {
  const { data: event, loading } = useLive((ok, fail) => backend.subscribeEvent(eventId, ok, fail), eventId, null);
  if (loading) return null;
  if (!event) return null;
  return <EventSummaryCard event={event} now={now} role="joined" onOpen={onOpen} />;
}

function EventList({ backend, name, setName, onOpen, onOpenJoined, onScan }) {
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const { data: owned, loading, error } = useLive((ok, fail) => backend.subscribeOwnedEvents(ok, fail), "owned", []);
  const joined = readLocal(JOINED_KEY, []).filter((id) => !owned.some((e) => e.id === id));
  const sorted = [...owned].sort((a, b) => currentOccurrence(a, now).start - currentOccurrence(b, now).start);

  async function create(data) {
    const id = await backend.createEvent(data, cleanName(name) || "Organizer");
    writeLocal(USED_KEY, true);
    setEditing(false);
    onOpen(id);
  }

  return (
    <>
      <div className="ci-toolbar">
        <NameField name={name} onChange={setName} label="Your name (shown to organizers)" />
        <div className="ci-toolbar-actions">
          <button type="button" className="secondary" onClick={onScan}>Scan event code</button>
          <button type="button" className="primary" onClick={() => setEditing(true)}>New event</button>
        </div>
      </div>
      <section aria-labelledby="owned-title" className="ci-section">
        <h2 id="owned-title">Events you organize</h2>
        {error && <p role="alert" className="ci-error">{errorMessage(error)}</p>}
        {loading ? <p role="status" className="ci-muted">Loading events…</p>
          : sorted.length ? <div className="ci-event-list">{sorted.map((event) => <EventSummaryCard key={event.id} event={event} now={now} role="owner" onOpen={() => onOpen(event.id)} />)}</div>
            : <p className="empty">No events yet. Create one, print its QR code, and let people scan in.</p>}
      </section>
      {joined.length > 0 && (
        <section aria-labelledby="joined-title" className="ci-section">
          <h2 id="joined-title">Events you joined</h2>
          <div className="ci-event-list">
            {joined.map((id) => <JoinedEventCard key={id} backend={backend} eventId={id} now={now} onOpen={() => onOpenJoined(id)} />)}
          </div>
        </section>
      )}
      {editing && <EventEditor onSave={create} onClose={() => setEditing(false)} />}
    </>
  );
}

function OccurrencePicker({ event, now, value, onChange }) {
  const current = currentOccurrence(event, now);
  const keys = useMemo(() => {
    const ahead = occurrenceKeysFrom(event, current.key, 7);
    const before = previousOccurrenceKeys(event, current.key, 6).reverse();
    return [...new Set([...before, ...ahead])];
  }, [event, current.key]);
  return (
    <label className="ci-field ci-inline-field">Date
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {keys.map((key) => (
          <option key={key} value={key}>
            {formatDay(occurrenceStartDay(key))}{key === current.key ? " (current)" : key < current.key ? " (past)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function AttendanceLists({ backend, event, occurrence, isOwner }) {
  const { data: members } = useLive((ok, fail) => backend.subscribeMembers(event.id, ok, fail), event.id, []);
  const { data: checkins, error } = useLive(
    (ok, fail) => backend.subscribeCheckins(event.id, occurrence.key, ok, fail), `${event.id}:${occurrence.key}`, []);
  const { present, absent } = attendance({ event, members, checkins, occurrence });
  const [actionError, setActionError] = useState("");
  const run = (fn) => fn().then(() => setActionError(""), (e) => setActionError(errorMessage(e)));
  const showAbsent = occurrence.status !== "upcoming";

  return (
    <div className="ci-attendance">
      {(error || actionError) && <p role="alert" className="ci-error">{actionError || errorMessage(error)}</p>}
      <section aria-labelledby="present-title" className="ci-list-card">
        <h3 id="present-title">Here <span className="ci-count">{present.length}</span></h3>
        {present.length ? (
          <ul className="ci-people">
            {present.map((person) => (
              <li key={person.id}>
                <span className="ci-person-name">{person.name}</span>
                <span className="ci-person-meta">
                  <time dateTime={person.checkedInAt.toISOString()}>{formatStamp(person.checkedInAt)}</time>
                  <span className={`ci-tag ci-tag-${person.timing}`}>{person.timing === "late" ? "Late" : "On time"}</span>
                  {person.addedAtCheckIn && <span className="ci-tag">Added at check-in</span>}
                  {person.manual && <span className="ci-tag">Marked by organizer</span>}
                  {isOwner && <button type="button" className="ci-link-button" onClick={() => run(() => backend.undoCheckIn(event.id, person.id))}>Undo</button>}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="ci-muted">No one has checked in{occurrence.status === "upcoming" ? " yet. Check-in opens " + formatTime(occurrence.opensAt) + "." : "."}</p>}
      </section>
      <section aria-labelledby="absent-title" className="ci-list-card">
        <h3 id="absent-title">{showAbsent ? "Absent" : "Expected"} <span className="ci-count">{absent.length}</span></h3>
        {absent.length ? (
          <ul className="ci-people">
            {absent.map((person) => (
              <li key={person.id}>
                <span className="ci-person-name">{person.name}</span>
                <span className="ci-person-meta">
                  {person.source === "invite" && <span className="ci-tag">Joined by invite</span>}
                  {isOwner && occurrence.status !== "upcoming" && (
                    <button type="button" className="ci-link-button" onClick={() => run(() => backend.markPresent(event.id, occurrence.key, person.name))}>Mark present</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="ci-muted">{showAbsent ? "Everyone expected is here." : "Add people below or share the invite link."}</p>}
      </section>
    </div>
  );
}

function ImportDialog({ analysis, fileName, existingNames, room, onImport, onClose }) {
  const dialog = useRef(null);
  const [columnId, setColumnId] = useState(analysis.suggested);
  const [unchecked, setUnchecked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  useEffect(() => { dialog.current.showModal(); }, []);
  const column = analysis.columns.find((c) => c.id === columnId);
  const { fresh, duplicates } = newNamesOnly(column?.names ?? [], existingNames);
  const chosen = fresh.filter((name) => !unchecked.has(name));
  const tooMany = chosen.length > room;

  function toggle(name) {
    setUnchecked((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    await onImport(chosen);
    setSaving(false);
  }

  return (
    <dialog ref={dialog} className="ci-dialog" onCancel={onClose} aria-labelledby="import-title">
      <form onSubmit={submit}>
        <div className="ci-dialog-heading">
          <h2 id="import-title">Import people</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <p className="ci-muted">From <strong>{fileName}</strong></p>
        {analysis.columns.length > 1 && (
          <label className="ci-field">Names are in
            <select value={columnId} onChange={(e) => { setColumnId(e.target.value); setUnchecked(new Set()); }}>
              {analysis.columns.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.names.length})</option>)}
            </select>
          </label>
        )}
        <p className="ci-muted ci-import-summary" role="status">
          {fresh.length} new {fresh.length === 1 ? "name" : "names"} found
          {duplicates.length > 0 && ` · ${duplicates.length} already on the list will be skipped`}
        </p>
        {fresh.length > 0 && (
          <>
            <div className="ci-import-tools">
              <button type="button" className="ci-link-button" onClick={() => setUnchecked(new Set())}>Select all</button>
              <button type="button" className="ci-link-button" onClick={() => setUnchecked(new Set(fresh))}>Select none</button>
            </div>
            <ul className="ci-import-list">
              {fresh.map((name) => (
                <li key={name}>
                  <label><input type="checkbox" checked={!unchecked.has(name)} onChange={() => toggle(name)} /> {name}</label>
                </li>
              ))}
            </ul>
          </>
        )}
        {tooMany && <p role="alert" className="ci-error">An event can have up to {MAX_ROSTER} people on its list. Unselect {chosen.length - room} to continue.</p>}
        <div className="ci-dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!chosen.length || tooMany || saving}>
            {saving ? "Adding…" : `Add ${chosen.length} ${chosen.length === 1 ? "person" : "people"}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function RosterEditor({ backend, event }) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(null);
  const fileInput = useRef(null);
  const { data: members } = useLive((ok, fail) => backend.subscribeMembers(event.id, ok, fail), `roster:${event.id}`, []);

  async function chooseFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const analysis = await readNamesFile(file);
      if (!analysis.columns.length) { setError(`No names were found in ${file.name}.`); return; }
      setError("");
      setImporting({ analysis, fileName: file.name });
    } catch (err) { setError(err.message); }
  }
  async function importNames(names) {
    const ok = await save([...event.roster, ...names.map((n) => ({ id: randomId(6), name: n }))]);
    if (ok) setImporting(null);
  }
  async function save(roster) {
    if (roster.length > MAX_ROSTER) { setError(`An event can have up to ${MAX_ROSTER} people on its list.`); return false; }
    try { await backend.updateEvent(event.id, { ...event, roster }); setError(""); return true; }
    catch (e) { setError(errorMessage(e)); return false; }
  }
  async function add(e) {
    e.preventDefault();
    const names = newName.split(/[\n,]/).map(cleanName).filter(Boolean);
    if (!names.length) return;
    await save([...event.roster, ...names.map((n) => ({ id: randomId(6), name: n }))]);
    setNewName("");
  }
  return (
    <section aria-labelledby="roster-title" className="ci-list-card">
      <h3 id="roster-title">Invited people <span className="ci-count">{event.roster.length}</span></h3>
      <form className="ci-add-row" onSubmit={add}>
        <label className="ci-sr-only" htmlFor="roster-name">Add people</label>
        <input id="roster-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add names, separated by commas" maxLength={600} />
        <button type="submit" className="secondary">Add</button>
      </form>
      <div className="ci-import-row">
        <button type="button" className="secondary" onClick={() => fileInput.current.click()}>Import from file</button>
        <span className="ci-muted ci-small">Spreadsheet (.xlsx, .csv) or text file. Names are found automatically.</span>
        <input ref={fileInput} type="file" accept={ACCEPTED_FILES} hidden aria-label="Import a list of names" onChange={chooseFile} />
      </div>
      {error && <p role="alert" className="ci-error">{error}</p>}
      {event.roster.length > 0 && (
        <ul className="ci-people ci-roster">
          {event.roster.map((person) => (
            <li key={person.id}>
              <span className="ci-person-name">{person.name}</span>
              <button type="button" className="ci-link-button" aria-label={`Remove ${person.name}`}
                onClick={() => save(event.roster.filter((p) => p.id !== person.id))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p className="ci-muted ci-small">People who scan the code without being on this list are added automatically.</p>
      {importing && (
        <ImportDialog
          analysis={importing.analysis}
          fileName={importing.fileName}
          existingNames={[...event.roster.map((p) => p.name), ...members.map((m) => m.name)]}
          room={MAX_ROSTER - event.roster.length}
          onImport={importNames}
          onClose={() => setImporting(null)}
        />
      )}
    </section>
  );
}

function EventManager({ backend, eventId, onBack }) {
  const now = useNow();
  const { data: event, loading } = useLive((ok, fail) => backend.subscribeEvent(eventId, ok, fail), eventId, null);
  const { data: code } = useLive(
    event?.ownerId === backend.uid ? (ok, fail) => backend.subscribeCode(eventId, ok, fail) : null, eventId, null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return undefined;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  if (loading) return <p role="status" className="ci-muted">Loading event…</p>;
  if (!event) return <div className="ci-section"><p className="empty">This event was deleted or the link is wrong.</p><button type="button" className="secondary" onClick={onBack}>Back to events</button></div>;
  const isOwner = event.ownerId === backend.uid;
  const current = currentOccurrence(event, now);
  const occurrence = selectedKey ? buildOccurrence(event, selectedKey, now) : current;
  const base = appBaseUrl();

  async function saveEdit(data) {
    await backend.updateEvent(event.id, { ...data, roster: event.roster });
    setEditing(false);
  }
  async function remove() {
    if (!window.confirm(`Delete "${event.title}" and all of its check-ins?`)) return;
    try { await backend.deleteEvent(event.id); onBack(); } catch (e) { setError(errorMessage(e)); }
  }
  async function replace() {
    if (!window.confirm("Replace the QR code? The old printed code will stop working.")) return;
    try { await backend.replaceCode(event.id); } catch (e) { setError(errorMessage(e)); }
  }
  const statusLine = {
    open: `Check-in is open until ${formatTime(occurrence.end)}. Arrivals after ${formatTime(occurrence.lateAt)} are marked late.`,
    upcoming: `Check-in opens ${formatDay(occurrence.opensAt)} at ${formatTime(occurrence.opensAt)}.`,
    ended: `This date ended at ${formatTime(occurrence.end)}.`,
  }[occurrence.status];

  return (
    <div className="ci-manager" data-printing={printing ? "true" : undefined}>
      <button type="button" className="ci-link-button ci-back" onClick={onBack}>← All events</button>
      <div className="ci-manager-head">
        <div>
          <p className="eyebrow">{isOwner ? "You organize this event" : `Organized by ${event.ownerName || "someone else"}`}</p>
          <h1>{event.title}</h1>
          <p className="ci-muted"><strong>{eventTimeLabel(event)}</strong> · {scheduleLabel(event)} · {event.durationMinutes} min{event.location ? ` · ${event.location}` : ""}</p>
        </div>
        {isOwner && (
          <div className="ci-head-actions">
            <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit event</button>
            <button type="button" className="secondary" onClick={remove}>Delete</button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="ci-error">{error}</p>}

      {isOwner && (
        <section className="ci-code-card" aria-labelledby="code-title">
          <div className="ci-code-art">
            {code ? <QrImage text={checkInLink(base, event.id, code)} alt={`Check-in QR code for ${event.title}`} downloadName={`qrise-checkin-${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`} />
              : <p role="status" className="ci-muted">Preparing QR code…</p>}
          </div>
          <div className="ci-code-copy">
            <h2 id="code-title">Check-in code</h2>
            <p className="ci-muted">Show this on a screen or print it at the door. People scan it with their phone camera to check in, and their arrival time is recorded.</p>
            <div className="qr-code-actions">
              <button type="button" className="primary" onClick={() => setPrinting(true)} disabled={!code}>Print code</button>
              <CopyButton text={inviteLink(base, event.id)} label="Copy invite link" />
              {code && <CopyButton text={checkInLink(base, event.id, code)} label="Copy check-in link" />}
              <button type="button" className="secondary" onClick={replace}>Replace code</button>
            </div>
            <p className="ci-muted ci-small">The invite link lets people see the event and join the list; only the code checks them in.</p>
          </div>
        </section>
      )}

      <div className="ci-occurrence-bar">
        <OccurrencePicker event={event} now={now} value={occurrence.key} onChange={setSelectedKey} />
        <p className={`ci-status ci-status-${occurrence.status}`} role="status">{statusLine}</p>
      </div>
      <AttendanceLists backend={backend} event={event} occurrence={occurrence} isOwner={isOwner} />
      {isOwner && <RosterEditor backend={backend} event={event} />}
      {editing && <EventEditor event={event} onSave={saveEdit} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AttendeeCheckIn({ backend, eventId, code, name, setName, onDone }) {
  const now = useNow(5000);
  const { data: event, loading } = useLive((ok, fail) => backend.subscribeEvent(eventId, ok, fail), eventId, null);
  const occurrence = event ? currentOccurrence(event, now) : null;
  const { data: checkins } = useLive(
    occurrence ? (ok, fail) => backend.subscribeCheckins(eventId, occurrence.key, ok, fail) : null,
    `${eventId}:${occurrence?.key}`, []);
  const { data: members } = useLive((ok, fail) => backend.subscribeMembers(eventId, ok, fail), `m:${eventId}`, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (loading) return <p role="status" className="ci-muted">Loading event…</p>;
  if (!event) return <div className="ci-section"><p className="empty">This event was deleted or the code is wrong.</p><button type="button" className="secondary" onClick={onDone}>Back to check-in</button></div>;
  const mine = checkins.find((c) => c.uid === backend.uid);

  async function checkIn(e) {
    e.preventDefault();
    const clean = cleanName(name);
    if (!clean) { setError("Enter your name so the organizer knows who you are."); return; }
    setBusy(true);
    try {
      await backend.checkIn(eventId, code, occurrence.key, clean, members.some((m) => m.uid === backend.uid));
      rememberJoined(eventId);
      setError("");
    } catch (err) {
      setError(err?.code === "permission-denied"
        ? "This check-in code isn't valid anymore. Ask the organizer for the current code."
        : errorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <section className="ci-attendee" aria-labelledby="attendee-title">
      <p className="eyebrow">Event check-in</p>
      <h1 id="attendee-title">{event.title}</h1>
      <p className="ci-muted"><strong>{formatDay(occurrence.start)} · {formatTime(occurrence.start)}</strong>{event.location ? ` · ${event.location}` : ""} · Organized by {event.ownerName || "someone else"}</p>
      {mine ? (
        <div className="ci-success" role="status">
          <span className="ci-success-icon" aria-hidden="true">✓</span>
          <div>
            <h2>You're checked in</h2>
            <p>Recorded at <time dateTime={mine.checkedInAt.toISOString()}>{formatStamp(mine.checkedInAt)}</time> · {checkInTiming(occurrence, mine.checkedInAt) === "late" ? "Late" : "On time"}</p>
          </div>
        </div>
      ) : occurrence.status === "open" ? (
        <form className="ci-checkin-form" onSubmit={checkIn}>
          <NameField name={name} onChange={setName} />
          <button type="submit" className="primary ci-big-button" disabled={busy}>{busy ? "Checking in…" : "Check in now"}</button>
        </form>
      ) : (
        <p className="ci-status ci-status-upcoming" role="status">
          {occurrence.status === "upcoming"
            ? `Check-in opens ${formatDay(occurrence.opensAt)} at ${formatTime(occurrence.opensAt)}. Scan the code again then.`
            : "Check-in for this event has closed."}
        </p>
      )}
      {error && <p role="alert" className="ci-error">{error}</p>}
      <button type="button" className="ci-link-button" onClick={onDone}>Go to my events</button>
    </section>
  );
}

function InviteView({ backend, eventId, name, setName, onDone }) {
  const now = useNow();
  const { data: event, loading } = useLive((ok, fail) => backend.subscribeEvent(eventId, ok, fail), eventId, null);
  const { data: members } = useLive((ok, fail) => backend.subscribeMembers(eventId, ok, fail), `m:${eventId}`, []);
  const [error, setError] = useState("");
  if (loading) return <p role="status" className="ci-muted">Loading invitation…</p>;
  if (!event) return <div className="ci-section"><p className="empty">This invitation is no longer valid.</p><button type="button" className="secondary" onClick={onDone}>Back to check-in</button></div>;
  const joined = members.some((m) => m.uid === backend.uid);
  const upcoming = occurrenceKeysFrom(event, currentOccurrence(event, now).key, 4).map((key) => buildOccurrence(event, key, now));

  async function join(e) {
    e.preventDefault();
    const clean = cleanName(name);
    if (!clean) { setError("Enter your name to join."); return; }
    try { await backend.joinEvent(eventId, clean); rememberJoined(eventId); setError(""); }
    catch (err) { setError(errorMessage(err)); }
  }

  return (
    <section className="ci-attendee" aria-labelledby="invite-title">
      <p className="eyebrow">You're invited</p>
      <h1 id="invite-title">{event.title}</h1>
      <p className="ci-muted"><strong>{eventTimeLabel(event)}</strong> · {scheduleLabel(event)}{event.location ? ` · ${event.location}` : ""} · Organized by {event.ownerName || "someone else"}</p>
      {upcoming.length > 0 && (
        <ul className="ci-dates">
          {upcoming.map((o) => <li key={o.key}>{formatDay(o.start)} · {formatTime(o.start)}</li>)}
        </ul>
      )}
      {joined ? (
        <div className="ci-success" role="status">
          <span className="ci-success-icon" aria-hidden="true">✓</span>
          <div><h2>You're on the list</h2><p>When you arrive, scan the event's QR code to check in.</p></div>
        </div>
      ) : (
        <form className="ci-checkin-form" onSubmit={join}>
          <NameField name={name} onChange={setName} />
          <button type="submit" className="primary ci-big-button">Join event</button>
        </form>
      )}
      {error && <p role="alert" className="ci-error">{error}</p>}
      <button type="button" className="ci-link-button" onClick={onDone}>Go to my events</button>
    </section>
  );
}

export default function CheckInPage({ route, onRouteChange }) {
  const { backend, error } = useBackend();
  const [name, setName] = useState(() => readLocal(NAME_KEY, ""));
  const [scanning, setScanning] = useState(false);
  const view = route ?? { view: "list" };
  const go = (next) => onRouteChange(next);

  return (
    <section className="ci-page" aria-label="Check-in">
      {view.view === "list" && (
        <div className="page-heading">
          <p className="eyebrow">Know who showed up</p>
          <h1>Check-in</h1>
          <p>Create an event, show its QR code at the door, and watch arrivals come in with a time stamp.</p>
        </div>
      )}
      {error && <p role="alert" className="storage-alert">{error}</p>}
      {!backend && !error && <p role="status" className="ci-muted">Connecting…</p>}
      {backend && view.view === "list" && (
        <EventList backend={backend} name={name} setName={setName}
          onOpen={(id) => go({ view: "manage", eventId: id })}
          onOpenJoined={(id) => go({ view: "manage", eventId: id })}
          onScan={() => setScanning(true)} />
      )}
      {backend && view.view === "manage" && <EventManager backend={backend} eventId={view.eventId} onBack={() => go(null)} />}
      {backend && view.view === "checkin" && <AttendeeCheckIn backend={backend} eventId={view.eventId} code={view.code} name={name} setName={setName} onDone={() => go(null)} />}
      {backend && view.view === "invite" && <InviteView backend={backend} eventId={view.eventId} name={name} setName={setName} onDone={() => go(null)} />}
      {scanning && <ScanDialog onClose={() => setScanning(false)} onResult={(link) => { setScanning(false); go({ view: "checkin", ...link }); }} />}
    </section>
  );
}

export function CheckInHomeCard({ onOpen }) {
  return (
    <article className="ci-home-card">
      <div className="ci-home-icon" aria-hidden="true">✓</div>
      <div>
        <p className="overview-label">New · Check-in</p>
        <p className="ci-home-title">Take attendance with one QR code</p>
        <p className="overview-detail">Create an event, let people scan in, and see who's here and who's missing, with arrival times.</p>
      </div>
      <button type="button" className="primary" onClick={onOpen}>Open check-in</button>
    </article>
  );
}
