import { useState } from "react";
import AlarmManagement from "./alarms/AlarmManagement";

// Minimal preview host. Person 4 can mount AlarmManagement in the app UI
// and provide persisted alarm state through alarms and onChange.
export default function App() {
  const [alarms, setAlarms] = useState([]);
  return <main><h1 className="project-name">QRise</h1><AlarmManagement alarms={alarms} onChange={setAlarms} /></main>;
}
