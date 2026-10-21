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

`src/App.jsx` provides the home dashboard and Home, Alarms, and QR code navigation. Alarm settings and QR-to-alarm pairings are saved in browser local storage and restored on reload. The QR code screen creates a unique printable/downloadable code per alarm. Scanning uses the device camera; camera access requires a secure browser context (HTTPS or localhost). Scheduler and ringing state reset when the page reloads.

If saved alarm data is unavailable or unreadable, QRise displays an error and starts with an empty in-memory schedule. If the browser blocks storage or saving fails, the app keeps the current session usable and reports that changes could not be saved.

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

Scheduling, triggering, sound, and QR-gated ringing/dismissal are implemented in `src/alarm-system/`. The alarm management component remains separate from the app shell and scheduler.

## Person 3: QR codes and verification

On the QR code screen, generate a code for each alarm and print it or download its PNG image. Replacing a code invalidates the previous one. Pairings are stored separately from alarm settings in local storage. Scan is available while an alarm is ringing; the live camera preview appears inside the ringing dialog. A code dismisses only the alarm it is paired with. A mismatch shows an error and leaves the alarm ringing; after three mismatches for the same ringing occurrence in a rolling five-minute window, the failsafe disables and dismisses that alarm. Camera errors can be retried, and cancelling a scan does not count as a mismatch. Camera tracks are stopped after a scan completes or is cancelled.

QR codes contain an opaque random identifier, not alarm details. Pairing records are local to this browser, so clearing browser storage or moving the app to another device requires generating new codes there. This browser implementation cannot dismiss an alarm after a page refresh because the in-memory ringing queue is not restored.

## Verify this feature

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover alarm management, local alarm and QR-pairing persistence, navigation, scheduling, ringing, audio start/stop, failed verification, failsafe behavior, and successful dismissal using a test scanner adapter. Real camera access requires a device/browser permission and should be verified on the target hardware.


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
  onFailsafe={disableAlarms}
/>
```

- `alarms` uses Person 1’s existing model. Times and repeat days use the device’s local timezone.
- `onOneShotFired(ids)` must disable the provided alarm IDs in parent state (and persist them when storage is added). The preview implements this. Disabling a consumed alarm does not dismiss its ringing screen.
- Person 3 supplies `async scanAndVerify({ alarm, signal })`. Open the camera UI, validate against the user's registered QR code, and resolve to literal `true` only after a match. Resolve `false` for a mismatch or cancellation; reject on camera/scanner errors. Failures leave sound running and permit retry. Honor the AbortSignal and release camera tracks when finished or aborted. Render scanner UI inside the ringing dialog (for example, portal into `.ringing-dialog`) so the modal does not make it inert. The app passes the dialog's video element as an additional `video` property.
- `onFailsafe(ids)` disables the provided alarms in parent state after three incorrect scans for a ringing occurrence within five minutes; the active occurrence is dismissed so sound can stop when the queue is empty.
- No scanner is mocked into the shipped app. The production app wires the camera scanner and local QR pairing validator; automated browser tests may supply a fake verifier.
- Simultaneous alarms queue in order. Verification dismisses only the current occurrence; sound continues until the queue is empty. Active ringing survives edits/deletion of the underlying alarm.

A one-time alarm schedules at the next future occurrence of its time (tomorrow if today's time has passed). Repeating alarms select the next configured local weekday. Timers check every 500 ms and on focus/visibility changes. A delayed check rings overdue alarms once and advances repeating alarms to the next future occurrence, rather than replaying every missed day. Editing time/repeat days reschedules; disabling or deleting cancels pending occurrences. Scheduler state is in memory, so Person 4 must consider restoration and clock/timezone changes in final integration.

Files: `scheduler.js` handles scheduling, `sound.js` handles audio, and `AlarmSystem.jsx` handles the queue, ringing screen, and verification bridge.

## Person 4: App UI & Integration

Person 4 provides the app shell and connects the alarm settings, alarm system, and QR verification features into one workflow:

- Build the home screen and navigation.
- Implement local storage for alarms and QR codes.
- Connect all features together.
- Handle errors and test the complete app workflow.

### Home screen and navigation

`src/App.jsx` renders the header, the Home / Alarms / QR code navigation, and the home dashboard. The dashboard shows the next scheduled alarm (time, label, and weekday, using the scheduler's `nextOccurrence`) and how many alarms are on or off. The alarm list and settings form appear on the Home and Alarms screens; the QR code screen lists every alarm with its pairing status. `AlarmSystem` is mounted once, outside the page switch, so scheduling and ringing continue while the user moves between screens.

### Local storage

`src/storage.js` saves alarms under `qrise.alarms` and QR pairings under `qrise.qrCodes` in browser local storage, and `App.jsx` restores both on load. Saved data is validated before use: alarms must match Person 1's model (valid `HH:mm` time, days 0–6, boolean `enabled`), and each QR pairing needs a UUID code ID with no duplicate codes or duplicate alarm pairings. Pairings are stored separately from alarm settings, so replacing a QR code does not change the alarm itself.

### Integration

`App.jsx` owns the `alarms` and `qrCodes` state and wires the features together:

```jsx
<AlarmManagement alarms={alarms} onChange={updateAlarms} />
<AlarmSystem
  alarms={alarms}
  onOneShotFired={disableAlarms}
  onFailsafe={disableAlarms}
  scanAndVerify={scanAndVerify}
/>
```

- `updateAlarms` updates state and persists the new array.
- `disableAlarms(ids)` turns off the given alarms and persists the change; it handles both consumed one-time alarms and the failsafe.
- `scanAndVerify` lazy-loads Person 3's camera scanner (`src/qr/scanner.js`), scans into the ringing dialog's video element, and returns `true` only when `findMatchingQrCode` finds the code paired with the ringing alarm.

### Error handling

- If saved alarms or QR pairings are missing, unreadable, or invalid, QRise shows an alert and starts with an empty list instead of crashing. Saving new data replaces the bad data.
- If the browser blocks storage or a save fails, changes stay active for the current session and the app reports that they could not be saved on this device. Alarm and QR storage errors are reported separately.
- If a QR code image cannot be generated, the card shows an error instead of a broken image.
- Camera errors during verification can be retried without stopping the alarm.

### Known limitations

Scheduler and ringing state are in memory. A page refresh restores saved alarms and pairings but clears any currently ringing alarm, so it cannot be dismissed after a refresh. Clock and timezone changes are picked up on the scheduler's next check (every 500 ms and on focus/visibility changes) rather than handled as a separate event. Reliable locked-phone wake-up requires a native app.

### End-to-end testing

The Playwright suite (`npm run test:e2e`) covers the complete workflow:

- Creating, editing, toggling, and deleting alarms.
- Home navigation, alarm persistence across reload, and printable QR pairing working together.
- Storage failures being announced while alarm controls stay usable.
- A scheduled alarm ringing, rejecting failed verification, and stopping only after success.
- Alarm management connected to scheduling with the production QR scanner.
- Three incorrect scans within five minutes triggering the failsafe.

Unit tests (`npm test`) cover storage save/restore and validation, the alarm model, the scheduler, QR matching, and the failsafe window.

## Deployment

QRise is deployed with Firebase Hosting as its own site, **qrise-cs392**, inside the team's Firebase project (`cs392-react-challenge-692dd`), so it has a separate URL from the other CS 392 React app. `firebase.json` serves the Vite build output (`dist/`) to that site and sends every path to `index.html`.

Live site: [https://qrise-cs392.web.app](https://qrise-cs392.web.app)

One-time setup (requires access to the team's Firebase project):

```sh
npm install -g firebase-tools
firebase login
```

The `.firebaserc` file already selects the project. The `qrise-cs392` site only needs to be created once:

```sh
firebase hosting:sites:create qrise-cs392
```

Deploy from the `QRise/` folder:

```sh
npm ci
npm run build
firebase deploy --only hosting
```

Firebase Hosting serves over HTTPS, so camera scanning works on phones.
