import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";

export function watchItem(id, next, error) {
  return onSnapshot(
    doc(db, "items", id),
    (snapshot) =>
      next(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null),
    error,
  );
}
export function watchMyItems(uid, next, error) {
  return onSnapshot(
    query(collection(db, "items"), where("ownerId", "==", uid)),
    (snapshot) => {
      next(
        snapshot.docs
          .map((row) => ({ ...row.data(), id: row.id }))
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() ?? 0) -
              (a.createdAt?.toMillis?.() ?? 0),
          ),
      );
    },
    error,
  );
}
export async function saveListing({ item, values, file, user, profile }) {
  const target = item
    ? doc(db, "items", item.id)
    : doc(collection(db, "items"));
  let photoURL = item?.photoURL || "";
  let photoPath = item?.photoPath || "";
  let uploadedPath = "";
  try {
    if (file) {
      uploadedPath = `items/${user.uid}/${target.id}/${crypto.randomUUID()}`;
      const uploaded = await uploadBytes(ref(storage, uploadedPath), file, {
        contentType: file.type,
      });
      photoURL = await getDownloadURL(uploaded.ref);
      photoPath = uploadedPath;
    }
    const data = {
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      pickupArea: values.pickupArea.trim(),
      photoURL,
      photoPath,
      updatedAt: serverTimestamp(),
    };
    if (item) await updateDoc(target, data);
    else
      await setDoc(target, {
        ...data,
        ownerId: user.uid,
        ownerName: profile?.displayName || user.displayName || "Student",
        status: "available",
        archived: false,
        createdAt: serverTimestamp(),
      });
  } catch (error) {
    // Only remove a newly uploaded photo if Firestore definitely did not reference it.
    // A lost response can mean the write succeeded: preserve the image if uncertain.
    if (uploadedPath) {
      try {
        const saved = await getDoc(target);
        if (saved.data()?.photoPath !== uploadedPath)
          await deleteObject(ref(storage, uploadedPath));
      } catch {
        /* Keep the image when the write outcome cannot be checked. */
      }
    }
    throw error;
  }
  if (uploadedPath && item?.photoPath && item.photoPath !== uploadedPath) {
    try {
      await deleteObject(ref(storage, item.photoPath));
    } catch {
      /* Listing saved; old image cleanup can be retried separately. */
    }
  }
  return target.id;
}
export function archiveListing(id) {
  return updateDoc(doc(db, "items", id), {
    archived: true,
    status: "unavailable",
    updatedAt: serverTimestamp(),
  });
}
