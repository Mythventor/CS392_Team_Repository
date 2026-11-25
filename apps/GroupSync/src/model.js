export const statuses = ['To do', 'In progress', 'Done']
export const templates = {
  'Blank project': [],
  'Software project': ['Define requirements and success criteria', 'Design the user experience', 'Build the core features', 'Test and fix issues', 'Prepare the demo and documentation'],
  'Research project': ['Define the research question', 'Review sources and literature', 'Collect evidence and data', 'Analyze findings', 'Write and present the report'],
  'Presentation': ['Agree on the topic and outline', 'Research key points', 'Create the slides', 'Rehearse together', 'Deliver the presentation'],
}
export const today = () => dateAfter(0)
export function dateAfter(days) {
  const d = new Date(); d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function starterTasks(template, members, due) {
  const titles = templates[template] || []
  return titles.map((title, index) => ({ id: crypto.randomUUID(), title, description: '', assignee: members[index % members.length] || '', status: 'To do', priority: index === 0 ? 'High' : 'Medium', due, evidence: '' }))
}
export function dueState(task, date = today()) {
  if (task.status === 'Done' || !task.due) return ''
  if (task.due < date) return 'Overdue'
  if (task.due === date) return 'Due today'
  const soon = new Date(`${date}T12:00:00`); soon.setDate(soon.getDate() + 3)
  const threshold = `${soon.getFullYear()}-${String(soon.getMonth()+1).padStart(2,'0')}-${String(soon.getDate()).padStart(2,'0')}`
  if (task.due <= threshold) return 'Due soon'
  return ''
}
export function progress(tasks) {
  return tasks.length ? Math.round(tasks.filter(t => t.status === 'Done').length / tasks.length * 100) : 0
}
export function demoData() {
  const members = ['alex@example.com', 'jamie@example.com', 'sam@example.com', 'riley@example.com']
  const tasks = starterTasks('Software project', members, dateAfter(7))
  tasks[0].status = 'Done'; tasks[0].evidence = 'Requirements agreed and shared in the project brief.'
  tasks[1].status = 'Done'; tasks[1].evidence = 'Wireframes reviewed by the team.'
  tasks[2].status = 'In progress'; tasks[2].due = dateAfter(1)
  tasks[3].due = dateAfter(3)
  return [{ id: 'welcome', name: 'Campus companion', description: 'A better campus experience, built together.', due: dateAfter(14), owner: members[0], members, tasks, events: [{ id: 'welcome-event', actor: members[0], text: 'Completed “Define requirements and success criteria”', evidence: tasks[0].evidence, at: new Date().toISOString() }] }]
}
export function calendarFile(tasks, project) {
  const escape = value => String(value).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GroupSync//Tasks//EN', ...tasks.filter(t => t.due && t.status !== 'Done').flatMap(t => ['BEGIN:VEVENT', `UID:${t.id}@groupsync`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`, `DTSTART;VALUE=DATE:${t.due.replaceAll('-','')}`, `SUMMARY:${escape(t.title)}`, `DESCRIPTION:${escape(`${project}: ${t.description}`)}`, 'BEGIN:VALARM','TRIGGER:-PT24H','ACTION:DISPLAY','DESCRIPTION:Task due tomorrow','END:VALARM','END:VEVENT']), 'END:VCALENDAR'].join('\r\n')
}
