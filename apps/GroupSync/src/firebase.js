import defaults from './firebase-config.json'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { collection, doc, getFirestore, onSnapshot, query, where, writeBatch } from 'firebase/firestore'
const env = import.meta.env
const config = { apiKey: env.VITE_FIREBASE_API_KEY || defaults.apiKey, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaults.authDomain, projectId: env.VITE_FIREBASE_PROJECT_ID || defaults.projectId, appId: env.VITE_FIREBASE_APP_ID || defaults.appId }
export const configured = Boolean(config.apiKey && config.projectId && config.appId)
const app = configured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null
export const login = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logout = () => signOut(auth)
export function watchProjects(email, receive, fail) {
  return onSnapshot(query(collection(db, 'projects'), where('members', 'array-contains', email)), snapshot => receive(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), fail)
}
export function watchDetails(id, receiveTasks, receiveEvents, fail) {
  const a = onSnapshot(collection(db, 'projects', id, 'tasks'), s => receiveTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail)
  const b = onSnapshot(collection(db, 'projects', id, 'events'), s => receiveEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail)
  return () => { a(); b() }
}
export async function createProject(project, event) {
  const batch = writeBatch(db)
  const { id, tasks, events: _events, ...metadata } = project
  void _events
  batch.set(doc(db, 'projects', id), metadata)
  tasks.forEach(task => batch.set(doc(db, 'projects', id, 'tasks', task.id), task))
  batch.set(doc(db, 'projects', id, 'events', event.id), event)
  await batch.commit()
}
export async function saveTask(projectId, task, event, remove = false) {
  const batch = writeBatch(db)
  const ref = doc(db, 'projects', projectId, 'tasks', task.id)
  if (remove) batch.delete(ref); else batch.set(ref, task)
  batch.set(doc(db, 'projects', projectId, 'events', event.id), event)
  await batch.commit()
}
export async function saveMembers(projectId, members, event) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'projects', projectId), { members })
  batch.set(doc(db, 'projects', projectId, 'events', event.id), event)
  await batch.commit()
}
