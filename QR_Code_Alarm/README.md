# QRise · Person 1: Alarm Management

This contribution contains the alarm settings feature only:

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

`src/App.jsx` is a minimal preview host with temporary React state. Alarms reset when the page reloads.

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

Person 2 owns scheduling, triggering, sounds, and ringing/dismissal. Person 3 owns QR generation and scanning. Person 4 owns the home screen, navigation, local storage, and app integration. This component implements none of those systems.

## Verify this feature

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover time/repeat labels and the alarm management controls. They do not test the full app workflow.
