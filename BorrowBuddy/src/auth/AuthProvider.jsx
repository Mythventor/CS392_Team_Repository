import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { AuthContext } from "./useAuth";

// Google sign-in creates the account, so signing up and logging in are the same step.
async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    // Some mobile browsers block pop-ups, so fall back to a full-page redirect.
    if (error.code === "auth/popup-blocked") await signInWithRedirect(auth, provider);
    else throw error;
  }
}

function signOut() {
  return firebaseSignOut(auth);
}

async function createProfileIfNeeded(user) {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;
  await setDoc(ref, {
    displayName: (user.displayName ?? "").slice(0, 60),
    photoURL: user.photoURL ?? null,
    campus: "",
    bio: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function saveProfileFor(user) {
  return ({ displayName, campus, bio }) =>
    updateDoc(doc(db, "users", user.uid), {
      displayName: displayName.trim(),
      campus,
      bio: bio.trim(),
      updatedAt: serverTimestamp(),
    });
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, profile: null, loading: true, error: null });

  useEffect(() => {
    let stopProfile = () => {};
    let currentUid = null;

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopProfile();
      stopProfile = () => {};
      currentUid = user?.uid ?? null;

      if (!user) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      setState({ user, profile: null, loading: true, error: null });
      const fail = (error) => {
        console.error("Could not load the profile", error);
        if (currentUid === user.uid) {
          setState({ user, profile: null, loading: false, error: "We couldn't load your profile. Please refresh and try again." });
        }
      };

      try {
        await createProfileIfNeeded(user);
      } catch (error) {
        fail(error);
        return;
      }
      // The person may have signed out while the profile was being created.
      if (currentUid !== user.uid) return;

      stopProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const profile = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
          setState({ user, profile, loading: false, error: null });
        },
        fail,
      );
    });

    return () => {
      currentUid = null;
      stopProfile();
      stopAuth();
    };
  }, []);

  const saveProfile = state.user ? saveProfileFor(state.user) : null;

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, saveProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
