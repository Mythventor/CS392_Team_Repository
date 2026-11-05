import { useEffect, useState } from "react";
import { watchBookedDays, watchMessages, watchMyLoans, watchMyRequestsForItem, watchRequest } from "./requests";

// Subscribes to a Firestore watcher and tracks loading and errors. `key` restarts it.
function useWatch(key, start, empty, errorText) {
  const [state, setState] = useState({ key: null, data: empty, loading: true, error: "" });
  useEffect(() => {
    if (!key) return undefined;
    return start(
      (data) => setState({ key, data, loading: false, error: "" }),
      (error) => {
        console.error(errorText, error);
        setState({ key, data: empty, loading: false, error: errorText });
      },
    );
    // `start`, `empty` and `errorText` are fixed for each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { data: empty, loading: false, error: "" };
  return state.key === key ? state : { data: empty, loading: true, error: "" };
}

const NONE = [];

export function useMyLoans(uid) {
  return useWatch(uid, (next, fail) => watchMyLoans(uid, next, fail), NONE, "We couldn't load your loans. Refresh to try again.");
}

export function useLoan(id) {
  return useWatch(id, (next, fail) => watchRequest(id, next, fail), null, "We couldn't load this request. Refresh to try again.");
}

export function useMyRequestsForItem(itemId, uid) {
  return useWatch(uid && itemId ? `${itemId}:${uid}` : null,
    (next, fail) => watchMyRequestsForItem(itemId, uid, next, fail), NONE, "We couldn't check your requests for this item.");
}

export function useBookedDays(itemId) {
  return useWatch(itemId, (next, fail) => watchBookedDays(itemId, next, fail), NONE, "We couldn't load this item's bookings.");
}

export function useMessages(requestId) {
  return useWatch(requestId, (next, fail) => watchMessages(requestId, next, fail), NONE, "We couldn't load messages.");
}
