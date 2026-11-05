import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { safeNextPath } from "../auth/profileModel";
import { useAuth } from "../auth/useAuth";
import "./AccountPages.css";

const QUIET_ERRORS = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.500c3.500 0 6.700 1.200 9.200 3.600l6.900-6.900C35.900 2.400 30.500 0 24 0 14.600 0 6.500 5.400 2.600 13.200l8 6.200C12.500 13.700 17.800 9.500 24 9.500Z" />
      <path fill="#4285F4" d="M46.900 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.900c-.6 3-2.200 5.500-4.700 7.200l7.700 6c4.500-4.200 7-10.300 7-17.700Z" />
      <path fill="#FBBC05" d="M10.600 28.600a14.500 14.500 0 0 1 0-9.200l-8-6.200a24 24 0 0 0 0 21.600l8-6.200Z" />
      <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.200 1.400-4.900 2.300-8.200 2.300-6.200 0-11.500-4.200-13.400-9.900l-8 6.200C6.500 42.600 14.600 48 24 48Z" />
    </svg>
  );
}

export function SignInPage() {
  const { user, loading, error: profileError, signIn } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = safeNextPath(params.get("next"));

  if (user && !loading && !profileError) return <Navigate to={next} replace />;

  async function handleSignIn() {
    setBusy(true);
    setError("");
    try {
      await signIn();
    } catch (signInError) {
      if (!QUIET_ERRORS.has(signInError.code)) {
        console.error("Google sign-in failed", signInError);
        setError("We couldn't sign you in with Google. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const message = error || profileError;

  return (
    <div className="container account-page account-page-narrow">
      <div className="panel signin-panel">
        <h1>Welcome to BorrowBuddy</h1>
        <p>Sign in or create your account with Google. It only takes a moment.</p>
        <button
          type="button"
          className="button button-secondary button-block"
          onClick={handleSignIn}
          disabled={busy || (Boolean(user) && loading)}
        >
          <GoogleMark />
          {busy || (user && loading) ? "Signing in…" : "Continue with Google"}
        </button>
        {message && <p className="notice notice-error" role="alert">{message}</p>}
      </div>
    </div>
  );
}
