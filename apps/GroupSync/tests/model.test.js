import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarFile, dueState, progress, starterTasks } from '../src/model.js'
test('templates distribute responsibilities evenly without AI', () => {
 const tasks = starterTasks('Software project', ['a','b'], '2026-12-01')
 assert.equal(tasks.length, 5)
 assert.deepEqual(tasks.map(t => t.assignee), ['a','b','a','b','a'])
 assert.equal(new Set(tasks.map(t => t.id)).size,5)
 assert.ok(tasks.every(t => t.status === 'To do' && t.due === '2026-12-01'))
})
test('blank project has no generated tasks', () => assert.deepEqual(starterTasks('Blank project', [], ''), []))
test('completed tasks never trigger due reminders', () => {
 assert.equal(dueState({status:'Done',due:'2020-01-01'}, '2026-11-25'), '')
 assert.equal(dueState({status:'To do',due:'2026-11-24'}, '2026-11-25'), 'Overdue')
 assert.equal(dueState({status:'To do',due:'2026-11-25'}, '2026-11-25'), 'Due today')
})
test('progress handles an empty project and completed tasks', () => {
 assert.equal(progress([]),0)
 assert.equal(progress([{status:'Done'},{status:'To do'},{status:'In progress'}]),33)
})
test('calendar excludes completed tasks and escapes content', () => {
 const output = calendarFile([{id:'one',title:'Review, test', description:'A;B',due:'2026-12-01',status:'To do'},{id:'two',due:'2026-12-02',status:'Done'}], 'Demo')
 assert.ok(output.includes('SUMMARY:Review\\, test'))
 assert.ok(output.includes('DTSTART;VALUE=DATE:20261201'))
 assert.ok(output.includes('TRIGGER:-PT24H'))
 assert.ok(!output.includes('two@groupsync'))
})
