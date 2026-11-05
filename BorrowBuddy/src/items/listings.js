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
import { db } from "../lib/firebase";
import { uploadPhoto, discardUpload } from "./photoUpload";
const photoConfig = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
};

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
  let uploaded = null;
  let photoURL = item?.photoURL || "";
  let photoPublicId = item?.photoPublicId || "";
  try {
    if (file) {
      uploaded = await uploadPhoto(file, photoConfig);
      photoURL = uploaded.photoURL;
      photoPublicId = uploaded.photoPublicId;
    }
    const data = {
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      pickupArea: values.pickupArea.trim(),
      photoURL,
      photoPath: file ? "" : item?.photoPath || "",
      photoPublicId,
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
    if (uploaded) {
      try {
        const saved = await getDoc(target);
        if (saved.data()?.photoURL !== uploaded.photoURL)
          await discardUpload(uploaded, photoConfig);
      } catch {
        /* Preserve the photo if a lost response makes the write outcome uncertain. */
      }
    }
    throw error;
  }
  // Old photos are retained: permanent Cloudinary deletion requires a server secret.
  // The account owner can remove unused assets in the Media Library without exposing it.
  return target.id;
}
export function archiveListing(id) {
  return updateDoc(doc(db, "items", id), {
    archived: true,
    status: "unavailable",
    updatedAt: serverTimestamp(),
  });
}
