import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { isAvailable, newestFirst } from "./model";

function itemFromSnapshot(snapshot) {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  return { id: snapshot.id, ...data, createdAt: data.createdAt?.toMillis?.() ?? 0 };
}

// Live list of items people can borrow right now, newest first.
export function useAvailableItems() {
  const [state, setState] = useState({ items: [], loading: true, error: null });

  useEffect(() => {
    const availableItems = query(collection(db, "items"), where("status", "==", "available"));
    return onSnapshot(
      availableItems,
      (snapshot) => {
        const items = snapshot.docs.map(itemFromSnapshot).filter((item) => isAvailable(item));
        setState({ items: newestFirst(items), loading: false, error: null });
      },
      (error) => {
        console.error("Could not load items", error);
        setState({ items: [], loading: false, error: "We couldn't load items right now. Please refresh and try again." });
      },
    );
  }, []);

  return state;
}
