import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import * as cloud from './firebase'
import { calendarFile, dateAfter, demoData, dueState, progress, starterTasks, statuses, templates, today } from './model'
import './App.css'

const nameOf = email => email?.split('@')[0] || 'Unassigned'
const initials = email => nameOf(email).slice(0, 2).toUpperCase()
const dateLabel = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'
const icons = { Overview: '◫', 'Task board': '▦', 'My tasks': '☑', Timeline: '◷', Team: '♧' }
function loadLocal() { try { return JSON.parse(localStorage.getItem('groupsync-v1')) || demoData() } catch { return demoData() } }
function App() {
  const dialogRef = useRef(null)
  const [user, setUser] = useState(null)
  const [localProjects, setLocalProjects] = useState(loadLocal)
  const [remoteProjects, setRemoteProjects] = useState([])
  const [details, setDetails] = useState({ id: '', tasks: [], events: [] })
  const [selected, setSelected] = useState('')
  const [view, setView] = useState('Overview')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All members')
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(!cloud.configured)
  const live = Boolean(user)
  const email = user?.email || 'alex@example.com'
  const projects = live ? remoteProjects : localProjects
  const base = projects.find(p => p.id === selected) || projects[0]
  const project = live && base ? { ...base, tasks: details.id === base.id ? details.tasks : [], events: details.id === base.id ? details.events : [] } : base
  const tasks = project?.tasks || []
  const events = [...(project?.events || [])].sort((a,b) => b.at.localeCompare(a.at))
  const visible = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'All members' || t.assignee === filter) && (view !== 'My tasks' || t.assignee === email))
  const due = tasks.filter(t => dueState(t) && t.assignee === email)
  useEffect(() => { if (!cloud.auth) return; return onAuthStateChanged(cloud.auth, value => { setUser(value); setReady(true) }) }, [])
  useEffect(() => { try { localStorage.setItem('groupsync-v1', JSON.stringify(localProjects)) } catch { /* Browser storage may be unavailable. */ } }, [localProjects])
  useEffect(() => { if (!user) return; return cloud.watchProjects(user.email, setRemoteProjects, e => setError(e.message)) }, [user])
  useEffect(() => { if (!live || !base?.id) return; const id = base.id; return cloud.watchDetails(id, tasks => setDetails(d => ({ ...(d.id === id ? d : { events: [] }), id, tasks })), events => setDetails(d => ({ ...(d.id === id ? d : { tasks: [] }), id, events })), e => setError(e.message)) }, [live, base?.id])
  useEffect(() => {
    if (!modal) return
    const previous = document.activeElement
    const dialog = dialogRef.current
    const controls = () => [...dialog.querySelectorAll('button:not(:disabled), input, textarea, select')]
    controls().find(el => el.tagName === 'INPUT')?.focus()
    function keydown(e) {
      if (e.key === 'Escape' && !busy) setModal(null)
      if (e.key === 'Tab') {
        const items = controls(); const first = items[0], last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = before; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [modal, busy])
  async function action(work) { setBusy(true); setError(''); try { await work(); setModal(null) } catch (e) { setError(e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed' ? 'Team sign-in needs one setup step: enable Google in Firebase Console → Authentication → Sign-in method.' : e.message || 'Something went wrong. Please try again.') } finally { setBusy(false) } }
  function event(text, evidence = '') { return { id: crypto.randomUUID(), actor: email, text, evidence, at: new Date().toISOString() } }
  function mutateLocal(update) { setLocalProjects(ps => ps.map(p => p.id === project.id ? update(p) : p)) }
  async function updateTask(task, remove = false) {
    const existing = tasks.find(t => t.id === task.id)
    const log = event(`${remove ? 'Deleted' : !existing ? 'Created' : existing.status !== task.status && task.status === 'Done' ? 'Completed' : 'Updated'} “${task.title}”${!remove && existing?.status !== task.status ? ` · ${task.status}` : ''}`, task.evidence)
    if (live) await cloud.saveTask(project.id, task, log, remove)
    else mutateLocal(p => ({ ...p, tasks: remove ? p.tasks.filter(t => t.id !== task.id) : existing ? p.tasks.map(t => t.id === task.id ? task : t) : [...p.tasks, task], events: [...p.events, log] }))
  }
  function create(e) {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    action(async () => {
      const members = [...new Set([email, ...String(data.get('members')).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)])]
      if (members.some(m => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m))) throw new Error('Enter valid member email addresses, separated by commas.')
      if (members.length > 30) throw new Error('A project can have up to 30 members.')
      const id = crypto.randomUUID(); const log = event('Created the project')
      const p = { id, name: data.get('name').trim(), description: data.get('description').trim(), due: data.get('due'), members, owner: email, tasks: starterTasks(data.get('template'), members, data.get('due')), events: [log] }
      if (!p.name) throw new Error('Give your project a name.')
      if (live) await cloud.createProject(p, log); else setLocalProjects(ps => [...ps, p])
      setSelected(id); setView('Overview')
    })
  }
  function submitTask(e) {
    e.preventDefault(); const data = new FormData(e.currentTarget)
    const task = { id: modal.task?.id || crypto.randomUUID(), ...Object.fromEntries(data.entries()) }
    action(async () => { task.title = task.title.trim(); if (!task.title) throw new Error('Add a task title.'); await updateTask(task) })
  }
  function downloadCalendar() {
    const url = URL.createObjectURL(new Blob([calendarFile(tasks.filter(t => t.assignee === email), project.name)], { type: 'text/calendar' }))
    const link = document.createElement('a'); link.href = url; link.download = 'groupsync-deadlines.ics'; link.click(); URL.revokeObjectURL(url)
  }
  const taskCard = task => <article className="task-card" key={task.id}>
    <div className="card-top"><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><button className="icon-button" aria-label={`Edit ${task.title}`} onClick={() => setModal({ type: 'task', task })}>•••</button></div>
    <button className="task-title" onClick={() => setModal({ type: 'task', task })}>{task.title}</button>
    {task.description && <p>{task.description}</p>}
    {task.evidence && <p className="evidence">✓ {task.evidence}</p>}
    <div className="card-bottom"><span className="avatar small" title={task.assignee || 'Unassigned'}>{task.assignee ? initials(task.assignee) : '?'}</span><span className={dueState(task) === 'Overdue' ? 'overdue' : ''}>◷ {dateLabel(task.due)}</span></div>
    <select aria-label={`Status for ${task.title}`} value={task.status} disabled={busy} onChange={e => action(() => updateTask({ ...task, status: e.target.value }))}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
  </article>
  return <div className="app-shell">
    <aside className="sidebar" inert={Boolean(modal)}><a className="brand" href="#" onClick={e => { e.preventDefault(); setView('Overview') }}><span className="brand-icon">g</span>GroupSync<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div><button className="workspace-switch" onClick={() => setModal({ type: 'project' })}><span className="workspace-icon">G</span><span>Project workspace<small>{projects.length} projects · {live ? 'Connected' : 'Local demo'}</small></span><span>＋</span></button>
      <nav>{Object.keys(icons).map(label => <button key={label} className={view === label ? 'active' : ''} onClick={() => { setView(label); setSearch(''); setFilter('All members') }}><span>{icons[label]}</span>{label}{label === 'My tasks' && <b>{tasks.filter(t => t.assignee === email && t.status !== 'Done').length}</b>}</button>)}</nav>
      <div className="project-label"><span>PROJECTS</span><button className="icon-button" aria-label="Create project" onClick={() => setModal({ type: 'project' })}>＋</button></div>
      <div className="project-list">{projects.map(p => <button key={p.id} className={p.id === project?.id ? 'selected' : ''} onClick={() => { setSelected(p.id); setView('Overview') }}><span className="project-square"/>{p.name}</button>)}</div>
      <div className="sidebar-tip"><span>Better together.</span><p>Small steps. Shared progress.<br/>One team moving forward.</p><button onClick={() => setModal({ type: 'project' })}>Start a project ＋</button></div>
      <div className="profile"><span className="avatar">{initials(email)}</span><div><strong>{live ? user.displayName || nameOf(email) : 'Alex Morgan'}</strong><small>{live ? 'Team member' : 'Demo workspace'}</small></div>{live && <button className="icon-button" aria-label="Sign out" onClick={() => action(cloud.logout)}>↪</button>}</div>
    </aside>
    <main inert={Boolean(modal)}><header className="topbar"><span className="breadcrumb">Workspace <span className="crumb">/</span> <strong>{view}</strong></span><select className="mobile-project" aria-label="Switch project" value={project?.id || ''} onChange={e => { setSelected(e.target.value); setFilter('All members'); setSearch('') }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div><span className="today">{new Date().toLocaleDateString(undefined,{ month: 'short', day: 'numeric', year: 'numeric' })}</span><button className="notification" aria-label={`${due.length} upcoming deadlines`} onClick={() => setView('My tasks')}>♧{due.length > 0 && <b>{due.length}</b>}</button><span className="avatar small">{initials(email)}</span></div></header>
      {!live && <div className="demo-banner"><span><strong>Try your team’s next chapter.</strong> Demo changes are saved on this browser only.</span>{cloud.configured ? <button disabled={busy || !ready} onClick={() => action(cloud.login)}>Sign in with Google</button> : <span className="muted">Firebase connection not configured</span>}</div>}
      {error && <div role="alert" className="error">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      <div className="content"><div className="page-heading"><div><div className="eyebrow">LET’S MAKE PROGRESS</div><h1>{view === 'Overview' ? 'A little clarity. A lot of progress.' : view === 'Timeline' ? 'Every contribution counts.' : view === 'Team' ? 'Good work starts with a great team.' : view === 'My tasks' ? 'Your next step starts here.' : 'From to-do to done.'}</h1><p>{view === 'Overview' ? 'Your team, your tasks, and everything moving forward.' : 'Keep the work visible and everyone on the same page.'}</p></div><button className="primary" onClick={() => setModal({ type: 'project' })}>＋ New project</button></div>
      {!project ? <div className="empty"><h2>Your next great project starts here.</h2><p>Create a workspace and invite your teammates by email.</p><button className="primary" onClick={() => setModal({ type: 'project' })}>Create your first project</button></div> : <>
      <section className="project-hero"><div className="hero-copy"><span className="project-tag">● ACTIVE PROJECT</span><h2>{project.name}</h2><p>{project.description || 'Make something great, together.'}</p><div className="hero-meta"><div className="avatar-stack">{project.members.slice(0,5).map(m => <span className="avatar small" title={m} key={m}>{initials(m)}</span>)}</div><span>{project.members.length} teammates</span><span className="meta-divider"/><span>◷ Due {dateLabel(project.due)}</span></div></div><div className="hero-progress"><div className="progress-ring" style={{ '--progress': `${progress(tasks)}%` }}><span>{progress(tasks)}<small>%</small></span></div><span>Project complete</span></div></section>
      {view === 'Overview' && <><section className="stats"><div><span>Total tasks <i>▦</i></span><strong>{tasks.length}<small>Across your project</small></strong></div><div><span>In progress <i className="purple">◴</i></span><strong>{tasks.filter(t => t.status === 'In progress').length}<small>Good things in motion</small></strong></div><div><span>Completed <i className="green">✓</i></span><strong>{tasks.filter(t => t.status === 'Done').length}<small>Steps worth celebrating</small></strong></div><div><span>Due soon <i className="orange">◷</i></span><strong>{tasks.filter(t => dueState(t)).length}<small>Let’s keep these on track</small></strong></div></section>
      {due.length > 0 && <div className="reminder"><span>◷ <strong>A heads-up for you</strong> · {due.length} assigned {due.length === 1 ? 'task needs' : 'tasks need'} attention soon.</span><button onClick={() => setView('My tasks')}>View my tasks</button></div>}</>}
      {['Overview','Task board','My tasks'].includes(view) && <section className="board-section"><div className="section-heading"><div><h2>{view === 'My tasks' ? 'My tasks' : 'Project tasks'} <span className="count">{visible.length}</span></h2><p>A clear plan. A shared sense of direction.</p></div><div className="toolbar">{view === 'My tasks' && <button className="secondary" onClick={downloadCalendar}>Export calendar</button>}<button className="primary" onClick={() => setModal({ type: 'task' })}>＋ Add task</button></div></div><div className="filters"><label className="search"><span>⌕</span><input aria-label="Search tasks" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}/></label><select aria-label="Filter by member" value={filter} onChange={e => setFilter(e.target.value)}><option>All members</option>{project.members.map(m => <option key={m} value={m}>{nameOf(m)}</option>)}</select><span className="board-view">▦ Board view</span></div><div className="board">{statuses.map((status,i) => <div className="column" key={status}><div className="column-heading"><h3><span className={`status-dot status-${i}`}/>{status}<span>{visible.filter(t => t.status === status).length}</span></h3><button className="icon-button" aria-label={`Add ${status} task`} onClick={() => setModal({ type:'task', task: { status } })}>＋</button></div>{visible.filter(t => t.status === status).map(taskCard)}{!visible.some(t => t.status === status) && <div className="column-empty">{search || filter !== 'All members' ? 'No matching tasks' : 'A little room for your next step.'}</div>}<button className="add-task" onClick={() => setModal({ type:'task', task: { status } })}>＋ Add task</button></div>)}</div></section>}
      {(view === 'Timeline' || view === 'Overview') && <section className="timeline-section"><div className="section-heading"><div><h2>Contribution timeline</h2><p>The work behind the progress, all in one place.</p></div>{view === 'Overview' && <button className="text-button" onClick={() => setView('Timeline')}>View all activity</button>}</div>{!events.length && <p className="empty-inline">Your team’s first contribution will appear here.</p>}{events.slice(0, view === 'Overview' ? 3 : 100).map(log => <article className="timeline-item" key={log.id}><span className="avatar">{initials(log.actor)}</span><div><p><strong>{nameOf(log.actor)}</strong> <span>{log.text}</span></p>{log.evidence && <blockquote>{log.evidence}</blockquote>}<time dateTime={log.at}>{new Date(log.at).toLocaleString()}</time></div><span className="activity-mark">✓</span></article>)}</section>}
      {view === 'Team' && <section className="team-section"><div className="section-heading"><div><h2>People make the project.</h2><p>Track each teammate’s workload and completed contributions.</p></div>{project.owner === email && <button className="primary" onClick={() => setModal({ type:'member' })}>＋ Invite member</button>}</div><div className="team-grid">{project.members.map(m => <article className="member-card" key={m}><span className="avatar">{initials(m)}</span><h3>{nameOf(m)}</h3><p>{m}</p><span className="role">{m === project.owner ? 'Project owner' : 'Team member'}</span><div><strong>{tasks.filter(t => t.assignee === m && t.status !== 'Done').length}<small>Open tasks</small></strong><strong>{tasks.filter(t => t.assignee === m && t.status === 'Done').length}<small>Completed</small></strong></div></article>)}</div><p className="help">Invited members can sign in with their Google account to see this project. Invitations grant access; GroupSync does not send email.</p></section>}
      </>}
      <footer>Made for shared goals and real progress.<span>GroupSync · Together, on track.</span></footer></div>
    </main>
    {modal && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setModal(null) }}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" disabled={busy} onClick={() => setModal(null)}>×</button>
      {error && <p role="alert" className="dialog-error">{error}</p>}
      {modal.type === 'project' ? <form onSubmit={create}><div className="eyebrow">A NEW CHAPTER</div><h2 id="modal-title">Make room for a great project.</h2><p>Start with an editable plan. No AI required.</p><label>Project name<input name="name" required maxLength={100} autoFocus placeholder="e.g. Campus companion"/></label><label>Description<textarea name="description" maxLength={1000} placeholder="What are we working toward?"/></label><div className="form-row"><label>Task template<select aria-label="Task template" name="template">{Object.keys(templates).map(t => <option key={t}>{t}</option>)}</select></label><label>Project deadline<input name="due" type="date" defaultValue={dateAfter(14)} required min={today()}/></label></div><label>Teammate emails<input name="members" placeholder="jamie@example.com, sam@example.com"/></label><p className="help">Template tasks are distributed evenly across teammates. Adjust any assignment or deadline afterward.</p><button className="primary full" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button></form> : modal.type === 'task' ? <form onSubmit={submitTask}><div className="eyebrow">ONE STEP FORWARD</div><h2 id="modal-title">{modal.task?.id ? 'Task details' : 'Add a task'}</h2><label>Task title<input name="title" autoFocus required maxLength={200} defaultValue={modal.task?.title}/></label><label>Description<textarea name="description" maxLength={3000} defaultValue={modal.task?.description}/></label><div className="form-row"><label>Assigned to<select aria-label="Assigned to" name="assignee" defaultValue={modal.task?.assignee || ''}><option value="">Unassigned</option>{project.members.map(m => <option key={m} value={m}>{m}</option>)}</select></label><label>Due date<input name="due" type="date" defaultValue={modal.task?.due || project.due}/></label></div><div className="form-row"><label>Status<select aria-label="Status" name="status" defaultValue={modal.task?.status || 'To do'}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Priority<select aria-label="Priority" name="priority" defaultValue={modal.task?.priority || 'Medium'}>{['Low','Medium','High'].map(s => <option key={s}>{s}</option>)}</select></label></div><label>Contribution note / evidence<textarea name="evidence" maxLength={3000} defaultValue={modal.task?.evidence} placeholder="What was completed? Add a summary or a link to your work."/></label><div className="modal-actions">{modal.task?.id && <button className="danger" type="button" disabled={busy} onClick={() => setModal({ type:'delete', task:modal.task })}>Delete task</button>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save task'}</button></div></form> : modal.type === 'delete' ? <div><h2 id="modal-title">Delete this task?</h2><p>“{modal.task.title}” will be removed. Its past contributions stay in the timeline.</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setModal({ type:'task', task:modal.task })}>Keep task</button><button className="danger" disabled={busy} onClick={() => action(() => updateTask(modal.task, true))}>Delete task</button></div></div> : <form onSubmit={e => { e.preventDefault(); const member = new FormData(e.currentTarget).get('email').trim().toLowerCase(); action(async () => { if (project.members.includes(member)) throw new Error('This teammate already has access.'); if (project.members.length >= 30) throw new Error('This project has reached 30 members.'); const members = [...project.members, member]; const log = event(`Invited ${member} to the project`); if (live) await cloud.saveMembers(project.id, members, log); else mutateLocal(p => ({ ...p, members, events: [...p.events, log] })) }) }}><h2 id="modal-title">Invite a teammate</h2><p>Grant access using their Google account email.</p><label>Email<input autoFocus type="email" name="email" required/></label><button className="primary full" disabled={busy}>Grant project access</button></form>}
    </section></div>}
  </div>
}
export default App
