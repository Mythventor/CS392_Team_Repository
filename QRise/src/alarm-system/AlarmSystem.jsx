import { useEffect, useRef, useState } from 'react';
import { AlarmScheduler } from './scheduler';
import { AlarmSound } from './sound';
import { displayTime } from '../alarms/model';
import { QR_MISMATCH_LIMIT, recordMismatchAttempt } from './verification';
import {
  closeAlarmNotifications,
  notificationPermission,
  registerNotificationWorker,
  requestNotificationPermission,
  showAlarmNotification,
} from './notifications';
import './AlarmSystem.css';

// scanAndVerify({ alarm, signal }) must resolve to literal true only for a valid QR.
export default function AlarmSystem({ alarms, onOneShotFired, onFailsafe, scanAndVerify }) {
  const [scheduler] = useState(() => new AlarmScheduler());
  const [sound] = useState(() => new AlarmSound());
  const [queue, setQueue] = useState([]);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState(() => notificationPermission());
  const dialog = useRef(null);
  const video = useRef(null);
  const scanController = useRef(null);
  const mismatchAttempts = useRef(new Map());
  const current = queue[0];
  const ringing = queue.length > 0;

  useEffect(() => {
    scheduler.sync(alarms, new Date());
    function check() {
      const due = scheduler.tick(new Date());
      if (!due.length) return;
      try { sound.start(); }
      catch (error) { setAudioError(error.message); }
      setQueue(previous => [...previous, ...due]);
      due.forEach(alarm => {
        const { clock, period } = displayTime(alarm.time);
        showAlarmNotification(alarm, `${clock} ${period}`).catch(() => {});
      });
      const once = due.filter(alarm => !alarm.days.length).map(alarm => alarm.id);
      if (once.length) onOneShotFired?.(once);
    }
    check();
    const interval = window.setInterval(check, 500);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [alarms, onOneShotFired, scheduler, sound]);

  useEffect(() => {
    if (!ringing) return;
    dialog.current.showModal();
    return () => {
      sound.stop();
      closeAlarmNotifications().catch(() => {});
    };
  }, [ringing, sound]);

  useEffect(() => {
    if (notifyPermission === 'granted') registerNotificationWorker().catch(() => {});
  }, [notifyPermission]);

  useEffect(() => () => {
    scanController.current?.abort();
    sound.dispose();
  }, [sound]);

  async function enableSound() {
    try {
      await sound.enable();
      if (ringing) sound.start();
      setAudioReady(true);
      setAudioError('');
    } catch (error) { setAudioError(error.message); }
  }

  async function enableNotifications() {
    try { setNotifyPermission(await requestNotificationPermission()); }
    catch { setNotifyPermission(notificationPermission()); }
  }

  async function verify() {
    if (!scanAndVerify || scanController.current) return;
    const controller = new AbortController();
    scanController.current = controller;
    setScanning(true);
    setScanMessage('');
    try {
      const verified = await scanAndVerify({ alarm: current, signal: controller.signal, video: video.current });
      if (controller.signal.aborted) return;
      if (verified === true) {
        const occurrenceKey = current.occurrenceId ?? current.id;
        mismatchAttempts.current.delete(occurrenceKey);
        setQueue(previous => previous.filter(item => (item.occurrenceId ?? item.id) !== occurrenceKey));
        setScanMessage(`QR verified. ${current.label} was turned off.`);
      } else {
        const attemptKey = current.occurrenceId ?? current.id;
        const now = Date.now();
        const attempts = recordMismatchAttempt(mismatchAttempts.current.get(attemptKey) ?? [], now);
        if (attempts.length >= QR_MISMATCH_LIMIT) {
          mismatchAttempts.current.delete(attemptKey);
          onFailsafe?.([current.id]);
          setQueue(previous => previous.filter(item => (item.occurrenceId ?? item.id) !== attemptKey));
          setScanMessage(`Failsafe activated. ${current.label} was disabled after three incorrect scans within five minutes.`);
        } else {
          mismatchAttempts.current.set(attemptKey, attempts);
          setScanMessage('QR code did not match. The alarm is still ringing. Try again.');
        }
      }
    } catch {
      if (!controller.signal.aborted) setScanMessage('Could not scan the QR code. Check camera access and try again.');
    } finally {
      if (!controller.signal.aborted) {
        scanController.current = null;
        setScanning(false);
      }
    }
  }

  function cancelScan() {
    scanController.current?.abort();
    scanController.current = null;
    setScanning(false);
    setScanMessage('Scan cancelled. The alarm is still ringing.');
  }

  return <section className="alarm-system" aria-label="Alarm system">
    <button className="secondary" onClick={enableSound}>Enable alarm sound</button>
    <p role="status">{audioReady ? 'Alarm sound enabled for this session.' : 'Enable sound before leaving an alarm set.'}</p>
    {notifyPermission === 'default' && <button className="secondary" onClick={enableNotifications}>Enable notifications</button>}
    <p role="status">{{
      granted: 'Notifications are on. You will also get a notification when an alarm rings while QRise is in the background.',
      denied: 'Notifications are blocked. Allow them for this site in your browser settings to get alarm notifications.',
      unsupported: 'This browser does not support notifications. On iPhone, add QRise to your Home Screen first.',
    }[notifyPermission] ?? 'Turn on notifications to be alerted when an alarm rings while QRise is in the background.'}</p>
    <p>Keep QRise open and your device awake. This web preview cannot reliably ring while the browser is closed or your phone is locked.</p>
    {!ringing && audioError && <p role="alert">{audioError}</p>}
    {!ringing && scanMessage && <p role="status">{scanMessage}</p>}
    {current && <dialog className="ringing-dialog" ref={dialog} aria-labelledby="ringing-title" onCancel={event => event.preventDefault()}>
      <p className="ringing-eyebrow">Time to rise</p>
      <h2 id="ringing-title">{current.label}</h2>
      <p className="ringing-time">{displayTime(current.time).clock} {displayTime(current.time).period}</p>
      <p>Walk to your printed QR code and scan it to turn off this alarm.</p>
      {queue.length > 1 && <p>{queue.length - 1} more alarm(s) waiting.</p>}
      {audioError && <><p role="alert">{audioError}</p><button className="secondary" onClick={enableSound}>Enable alarm sound</button></>}
      <button className="primary" onClick={verify} disabled={!scanAndVerify || scanning}>{scanning ? 'Scanning…' : 'Scan QR code'}</button>
      {scanning && <button className="secondary" type="button" onClick={cancelScan}>Cancel scan</button>}
      <video className="qr-camera-preview" ref={video} aria-label="QR code camera preview" autoPlay muted playsInline hidden={!scanning} />
      {!scanAndVerify && <p role="status">QR scanner is not connected yet. Person 3’s scanner must be integrated to dismiss this alarm.</p>}
      <p role="status">{scanMessage}</p>
    </dialog>}
  </section>;
}
