import { useEffect, useState } from "react";
import { watchItem } from "../items/listings";
import { watchMessages, watchMyDeals, watchMyOffersForItem, watchOffer } from "./offers";

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

export function useMyDeals(uid) {
  return useWatch(uid, (next, fail) => watchMyDeals(uid, next, fail), NONE, "We couldn't load your deals. Refresh to try again.");
}

export function useOffer(id) {
  return useWatch(id, (next, fail) => watchOffer(id, next, fail), null, "We couldn't load this deal. Refresh to try again.");
}

export function useMyOffersForItem(itemId, uid) {
  return useWatch(uid && itemId ? `${itemId}:${uid}` : null,
    (next, fail) => watchMyOffersForItem(itemId, uid, next, fail), NONE, "We couldn't check your offers on this item.");
}

export function useLiveItem(itemId) {
  return useWatch(itemId, (next, fail) => watchItem(itemId, next, fail), null, "We couldn't load this item.");
}

export function useMessages(offerId) {
  return useWatch(offerId, (next, fail) => watchMessages(offerId, next, fail), NONE, "We couldn't load messages.");
}
