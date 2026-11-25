import { before, after, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore'
let env
const owner = 'owner@example.com', teammate = 'member@example.com'
const project = {name:'Demo',description:'Test',due:'2026-12-01',owner,members:[owner,teammate]}
const task = {id:'t1',title:'Build it',description:'',assignee:teammate,status:'To do',priority:'Medium',due:'2026-12-01',evidence:''}
const dbFor = (email, verified=true) => env.authenticatedContext(email, {email,email_verified:verified}).firestore()
before(async () => { env = await initializeTestEnvironment({projectId:'demo-groupsync',firestore:{rules:readFileSync('firestore.rules','utf8')}}) })
after(async () => { await env?.cleanup() })
beforeEach(async () => { await env.clearFirestore(); await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(),'projects/p1'),project) }) })
test('only verified invited members can read a project', async () => {
 await assertSucceeds(getDoc(doc(dbFor(teammate),'projects/p1')))
 await assertFails(getDoc(doc(dbFor('outsider@example.com'),'projects/p1')))
 await assertFails(getDoc(doc(dbFor(teammate,false),'projects/p1')))
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'projects/p1')))
})
test('membership query supports discovering invited projects',async () => {
 await assertSucceeds(getDocs(query(collection(dbFor(teammate),'projects'),where('members','array-contains',teammate))))
})
test('only owner may change membership; owner cannot be replaced', async () => {
 await assertFails(updateDoc(doc(dbFor(teammate),'projects/p1'),{members:[owner,teammate,'x@example.com']}))
 await assertSucceeds(updateDoc(doc(dbFor(owner),'projects/p1'),{members:[owner,teammate,'x@example.com']}))
 await assertFails(updateDoc(doc(dbFor(owner),'projects/p1'),{owner:teammate}))
})
test('project and template tasks can be created atomically', async () => {
 const db = dbFor(owner); const batch = writeBatch(db)
 batch.set(doc(db,'projects/new'),project);batch.set(doc(db,'projects/new/tasks/t1'),task)
 await assertSucceeds(batch.commit())
})
test('members may manage valid tasks; outsiders and invalid assignments are denied', async () => {
 const ref = doc(dbFor(teammate),'projects/p1/tasks/t1')
 await assertSucceeds(setDoc(ref,task))
 await assertFails(setDoc(doc(dbFor('outsider@example.com'),'projects/p1/tasks/t1'),task))
 await assertFails(updateDoc(ref,{assignee:'outsider@example.com'}))
 await assertFails(updateDoc(ref,{status:'Fake'}))
 await assertFails(updateDoc(ref,{title:''}))
 await assertSucceeds(updateDoc(ref,{status:'Done',evidence:'Delivered the demo'}))
 await assertSucceeds(deleteDoc(ref))
})
test('timeline entries are attributed to the writer and immutable', async () => {
 const ref = doc(dbFor(teammate),'projects/p1/events/e1')
 const log = {id:'e1',actor:teammate,text:'Completed task',evidence:'Demo link',at:new Date().toISOString()}
 await assertFails(setDoc(ref,{...log,actor:owner}))
 await assertSucceeds(setDoc(ref,log))
 await assertFails(updateDoc(ref,{text:'Rewritten'}))
 await assertFails(deleteDoc(ref))
})
