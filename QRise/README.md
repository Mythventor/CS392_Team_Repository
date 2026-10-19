# QRise · Alarm Management and Alarm System

Person 1 provides the alarm settings feature:

- Create, edit, and delete alarms.
- Set alarm times and repeat days.
- Enable and disable alarms.
- Provide an accessible alarm settings form and alarm list.

## Run the feature preview

Use Node.js 22.12+ (or a supported newer release).

```sh
npm ci
npm run dev
```

`src/App.jsx` connects alarm management to Person 2’s alarm system with temporary React state. Alarms and scheduler state reset when the page reloads.

## Component interface

`src/alarms/AlarmManagement.jsx` exports a controlled component:

```jsx
<AlarmManagement alarms={alarms} onChange={setAlarms} />
```

The parent supplies the array and receives the updated array after create, edit, delete, or enable/disable actions. Each alarm has this shape:

```js
{ id: 'uuid', label: 'Morning alarm', time: '07:00', days: [1, 2, 3, 4, 5], enabled: true }
```

Time is a local 24-hour `HH:mm` string. Repeat days use Sunday = 0 through Saturday = 6; an empty array means no repeat. The settings form defaults new alarms to weekdays at 07:00, enabled. Nothing is created until Save alarm is selected.

Person 2 implements scheduling, triggering, sound, and QR-gated ringing/dismissal in `src/alarm-system/`. Person 3 owns QR generation and scanning. Person 4 owns the home screen, navigation, local storage, and app integration. The alarm management component remains separate from those systems.

## Verify this feature

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover alarm management, scheduling, ringing, audio start/stop, failed verification, and successful dismissal using a test scanner adapter. Real camera scanning and persistence await integration.


## Person 2: Alarm System

Enable alarm sound once after opening the app, then create an alarm. Keep the page open and the device awake. Sound uses a generated looping tone, so no sound file or network fetch is required. The ringing dialog has no stop/snooze button and blocks Escape dismissal.

This is a browser preview, not a native mobile alarm: closed tabs, device sleep, browser audio restrictions, system volume, and OS suspension can prevent sound or delay triggering. Refreshing clears the current in-memory alarm. A native scheduling/background audio solution is required for reliable locked-phone wake-up behavior. See [browser autoplay restrictions](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) and [background timer throttling](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

### Integration contract for Persons 3 and 4

Mount `AlarmSystem` once at the app root, including while navigating between screens:

```jsx
<AlarmSystem
  alarms={alarms}
  onOneShotFired={disableOneShots}
  scanAndVerify={scanAndVerify}
/>
```

- `alarms` uses Person 1’s existing model. Times and repeat days use the device’s local timezone.
- `onOneShotFired(ids)` must disable the provided alarm IDs in parent state (and persist them when storage is added). The preview implements this. Disabling a consumed alarm does not dismiss its ringing screen.
- Person 3 supplies `async scanAndVerify({ alarm, signal })`. Open the camera UI, validate against the user's registered QR code, and resolve to literal `true` only after a match. Resolve `false` for a mismatch or cancellation; reject on camera/scanner errors. Failures leave sound running and permit retry. Honor the AbortSignal and release camera tracks when finished or aborted. Render scanner UI inside the ringing dialog (for example, portal into `.ringing-dialog`) so the modal does not make it inert.
- No scanner is mocked into the shipped app. Without the adapter the scan button is disabled and the screen explains the missing integration. The automated browser test alone supplies a fake verifier.
- Simultaneous alarms queue in order. Verification dismisses only the current occurrence; sound continues until the queue is empty. Active ringing survives edits/deletion of the underlying alarm.

A one-time alarm schedules at the next future occurrence of its time (tomorrow if today's time has passed). Repeating alarms select the next configured local weekday. Timers check every 500 ms and on focus/visibility changes. A delayed check rings overdue alarms once and advances repeating alarms to the next future occurrence, rather than replaying every missed day. Editing time/repeat days reschedules; disabling or deleting cancels pending occurrences. Scheduler state is in memory, so Person 4 must consider restoration and clock/timezone changes in final integration.

Files: `scheduler.js` handles scheduling, `sound.js` handles audio, and `AlarmSystem.jsx` handles the queue, ringing screen, and verification bridge.
