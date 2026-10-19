import { useEffect, useRef, useState } from "react";
import { DAY_ORDER, DAYS, displayTime, repeatLabel } from "./model";
import "./AlarmManagement.css";

function AlarmEditor({ alarm, onSave, onClose }) {
  const dialog = useRef(null);
  const [label, setLabel] = useState(alarm?.label ?? "");
  const [time, setTime] = useState(alarm?.time ?? "07:00");
  const [days, setDays] = useState(alarm?.days ?? [1, 2, 3, 4, 5]);
  const [enabled, setEnabled] = useState(alarm?.enabled ?? true);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  function submit(event) {
    event.preventDefault();
    onSave({
      id: alarm?.id ?? crypto.randomUUID(),
      label: label.trim() || "Morning alarm",
      time,
      days: [...days].sort(),
      enabled,
    });
  }
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="editor-title">
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <h2 id="editor-title">{alarm ? "Edit alarm" : "New alarm"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close editor"
          >
            Close
          </button>
        </div>
        <label className="field">
          Alarm time
          <input
            className="time-input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          Alarm name{" "}
          <input
            maxLength={60}
            placeholder="e.g. Early start"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>
            Repeat <span>{repeatLabel(days)}</span>
          </legend>
          <div className="days">
            {DAY_ORDER.map((day) => (
              <button
                type="button"
                key={day}
                aria-pressed={days.includes(day)}
                onClick={() =>
                  setDays((previous) =>
                    previous.includes(day)
                      ? previous.filter((d) => d !== day)
                      : [...previous, day],
                  )
                }
              >
                {DAYS[day]}
              </button>
            ))}
          </div>
          <div className="presets">
            {[
              ["Once", []],
              ["Weekdays", [1, 2, 3, 4, 5]],
              ["Every day", DAY_ORDER],
            ].map(([name, values]) => (
              <button type="button" key={name} onClick={() => setDays(values)}>
                {name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="enable-field">
          <span>
            Enable alarm<small>Include this alarm in your schedule</small>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            
            Save alarm
          </button>
        </div>
      </form>
    </dialog>
  );
}


// The parent owns alarm state. Persistence and scheduling belong to the app integration.
export default function AlarmManagement({ alarms, onChange }) {
  const [editor, setEditor] = useState(null);
  return <section className="alarm-management" aria-labelledby="alarm-heading">
    <div className="section-heading"><h1 id="alarm-heading">Alarm settings</h1><button className="primary" onClick={() => setEditor({})}>New alarm</button></div>
    {alarms.length ? <div className="alarm-list">{alarms.map(alarm => {
      const time = displayTime(alarm.time);
      return <article className="alarm-card" key={alarm.id}>
        <div><div className="alarm-time">{time.clock} <span>{time.period}</span></div><h2>{alarm.label}</h2><p>{repeatLabel(alarm.days)}</p></div>
        <div className="alarm-actions">
          <label className="toggle"><input type="checkbox" checked={alarm.enabled} onChange={() => onChange(alarms.map(item => item.id === alarm.id ? { ...item, enabled: !item.enabled } : item))} />Enable {alarm.label}</label>
          <div className="row-actions"><button className="secondary" aria-label={`Edit ${alarm.label}`} onClick={() => setEditor(alarm)}>Edit</button><button className="secondary" aria-label={`Delete ${alarm.label}`} onClick={() => onChange(alarms.filter(item => item.id !== alarm.id))}>Delete</button></div>
        </div>
      </article>;
    })}</div> : <p className="empty">No alarms yet. Select New alarm to add one.</p>}
    {editor && <AlarmEditor alarm={editor.id ? editor : null} onClose={() => setEditor(null)} onSave={alarm => {
      onChange(editor.id ? alarms.map(item => item.id === alarm.id ? alarm : item) : [...alarms, alarm]);
      setEditor(null);
    }} />}
  </section>;
}
