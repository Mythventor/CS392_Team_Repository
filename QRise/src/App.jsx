import { useCallback, useState } from "react";
import AlarmManagement from "./alarms/AlarmManagement";
import AlarmSystem from "./alarm-system/AlarmSystem";

// Person 4 supplies persistence; Person 3 supplies scanAndVerify to AlarmSystem.
export default function App() {
  const [alarms, setAlarms] = useState([]);
  const disableOneShots = useCallback((ids) => {
    setAlarms(previous => previous.map(alarm => ids.includes(alarm.id) ? { ...alarm, enabled: false } : alarm));
  }, []);
  return <main>
    <h1 className="project-name">QRise</h1>
    <AlarmManagement alarms={alarms} onChange={setAlarms} />
    <AlarmSystem alarms={alarms} onOneShotFired={disableOneShots} />
  </main>;
}
