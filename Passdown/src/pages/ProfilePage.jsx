import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BIO_MAX, NAME_MAX, validateProfile } from "../auth/profileModel";
import { useAuth } from "../auth/useAuth";
import { Avatar } from "../components/Avatar";
import { DEFAULT_SCHOOL, SCHOOLS } from "../items/model";
import "./AccountPages.css";

function ProfileForm({ user, profile, saveProfile, signOut }) {
  const [form, setForm] = useState({
    displayName: profile.displayName ?? "",
    school: profile.school ?? DEFAULT_SCHOOL,
    bio: profile.bio ?? "",
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: "idle", message: "" });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus({ state: "idle", message: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setStatus({ state: "saving", message: "" });
    try {
      await saveProfile(form);
      setStatus({ state: "saved", message: "Your profile is saved." });
    } catch (error) {
      console.error("Could not save the profile", error);
      setStatus({ state: "error", message: "We couldn't save your changes. Please try again." });
    }
  }

  return (
    <div className="container account-page">
      <h1>Your profile</h1>
      <Link to="/my-listings" className="text-link">Manage my listings</Link>

      <form className="panel profile-form" onSubmit={handleSubmit} noValidate>
        <div className="profile-identity">
          <Avatar name={form.displayName} photoURL={profile.photoURL} size={64} />
          <div>
            <p className="profile-email">{user.email}</p>
            <p className="field-hint">Your photo and email come from your Google account. Your email isn't shown to other students.</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="displayName">Name</label>
          <input
            id="displayName"
            value={form.displayName}
            onChange={(event) => update("displayName", event.target.value)}
            maxLength={NAME_MAX}
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? "displayName-error" : undefined}
          />
          {errors.displayName && <p className="field-error" id="displayName-error">{errors.displayName}</p>}
        </div>

        <div className="field">
          <label htmlFor="school">School</label>
          <select
            id="school"
            value={form.school}
            onChange={(event) => update("school", event.target.value)}
            aria-invalid={Boolean(errors.school)}
            aria-describedby={errors.school ? "school-error" : undefined}
          >
            {SCHOOLS.map((school) => <option key={school.id} value={school.id}>{school.label}</option>)}
          </select>
          {errors.school && <p className="field-error" id="school-error">{errors.school}</p>}
        </div>

        <div className="field">
          <label htmlFor="bio">Bio <span className="field-optional">(optional)</span></label>
          <textarea
            id="bio"
            rows={3}
            value={form.bio}
            onChange={(event) => update("bio", event.target.value)}
            maxLength={BIO_MAX}
            placeholder="Your year, major, or the kind of things you sell."
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={errors.bio ? "bio-error" : "bio-count"}
          />
          <p className="field-hint" id="bio-count">{form.bio.length} of {BIO_MAX} characters</p>
          {errors.bio && <p className="field-error" id="bio-error">{errors.bio}</p>}
        </div>

        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={status.state === "saving"}>
            {status.state === "saving" ? "Saving…" : "Save changes"}
          </button>
          <p
            className={status.state === "error" ? "form-status field-error" : "form-status"}
            role={status.state === "error" ? "alert" : "status"}
          >
            {status.message}
          </p>
        </div>
      </form>

      <div className="signout-row">
        <button type="button" className="button button-secondary" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, profile, loading, error, saveProfile, signOut } = useAuth();

  if (loading) {
    return <div className="container account-page"><p role="status">Loading your profile…</p></div>;
  }
  if (!user) {
    return <Navigate to={`/signin?next=${encodeURIComponent("/profile")}`} replace />;
  }
  if (error || !profile) {
    return (
      <div className="container account-page">
        <h1>Your profile</h1>
        <p className="notice notice-error" role="alert">
          {error || "We couldn't find your profile. Please refresh and try again."}
        </p>
        <div className="signout-row">
          <button type="button" className="button button-secondary" onClick={signOut}>Sign out</button>
          <Link to="/" className="text-link">Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <ProfileForm
      key={user.uid}
      user={user}
      profile={profile}
      saveProfile={saveProfile}
      signOut={signOut}
    />
  );
}
