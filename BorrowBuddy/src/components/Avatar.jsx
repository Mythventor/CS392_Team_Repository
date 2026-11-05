import { useState } from "react";
import { initials } from "../auth/profileModel";

export function Avatar({ name, photoURL, size = 36 }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const style = { width: size, height: size, fontSize: size * 0.38 };

  if (photoURL && photoURL !== failedUrl) {
    return (
      <img
        className="avatar"
        style={style}
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(photoURL)}
      />
    );
  }
  return <span className="avatar avatar-initials" style={style} aria-hidden="true">{initials(name)}</span>;
}
