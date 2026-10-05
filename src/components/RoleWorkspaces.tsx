import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, Check, Clock3, MapPin, RefreshCw, Send, ShieldCheck, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import type { OpportunityStatus, PlacementInterestStatus, Profile, ProjectStatus } from '../types/models'
import './RoleWorkspaces.css'

interface WorkspaceProps {
  profile: Profile
}

interface ProjectSnapshot {
  id: string
  resident_id: string
  assigned_student_id: string | null
  title: string
  description: string
  trade_category: string
  location: string
  status: ProjectStatus
  created_at: string
}

interface HourSnapshot {
  id: string
  student_id: string
  project_id: string
  hours_logged: number
  status: 'pending' | 'approved'
  teacher_id: string | null
  created_at: string
}

interface OpportunitySnapshot {
  id: string
  partner_id: string
  organization_name: string
  title: string
  trade_category: string
  description: string
  learning_goals: string
  supervision_plan: string
  location: string
  compensation_status: 'paid' | 'unpaid_educational' | 'to_be_determined'
  status: OpportunityStatus
  created_at: string
}

interface InterestSnapshot {
  id: string
  opportunity_id: string
  student_id: string
  status: PlacementInterestStatus
  teacher_id: string | null
  created_at: string
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === 'pending' || value === 'approved' || value === 'in_progress' || value === 'completed'
}

function isOpportunityStatus(value: unknown): value is OpportunityStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'closed'
}

function parseOpportunities(value: unknown): OpportunitySnapshot[] {
  if (!Array.isArray(value)) throw new Error('The placement listings response was not a list.')

  return value.map((item) => {
    const row = recordOf(item)
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.partner_id !== 'string' ||
      typeof row.organization_name !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.trade_category !== 'string' ||
      typeof row.description !== 'string' ||
      typeof row.learning_goals !== 'string' ||
      typeof row.supervision_plan !== 'string' ||
      typeof row.location !== 'string' ||
      (row.compensation_status !== 'paid' &&
        row.compensation_status !== 'unpaid_educational' &&
        row.compensation_status !== 'to_be_determined') ||
      !isOpportunityStatus(row.status) ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('A placement listing has missing or invalid fields.')
    }

    return {
      id: row.id,
      partner_id: row.partner_id,
      organization_name: row.organization_name,
      title: row.title,
      trade_category: row.trade_category,
      description: row.description,
      learning_goals: row.learning_goals,
      supervision_plan: row.supervision_plan,
      location: row.location,
      compensation_status: row.compensation_status,
      status: row.status,
      created_at: row.created_at,
    }
  })
}

function parseInterests(value: unknown): InterestSnapshot[] {
  if (!Array.isArray(value)) throw new Error('The placement interest response was not a list.')

  return value.map((item) => {
    const row = recordOf(item)
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.opportunity_id !== 'string' ||
      typeof row.student_id !== 'string' ||
      (row.status !== 'pending' && row.status !== 'approved' && row.status !== 'rejected') ||
      (typeof row.teacher_id !== 'string' && row.teacher_id !== null) ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('A placement interest has missing or invalid fields.')
    }

    return {
      id: row.id,
      opportunity_id: row.opportunity_id,
      student_id: row.student_id,
      status: row.status,
      teacher_id: row.teacher_id,
      created_at: row.created_at,
    }
  })
}

function parseProjects(value: unknown): ProjectSnapshot[] {
  if (!Array.isArray(value)) throw new Error('The projects response was not a list.')

  return value.map((item) => {
    const row = recordOf(item)
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.resident_id !== 'string' ||
      (typeof row.assigned_student_id !== 'string' && row.assigned_student_id !== null) ||
      typeof row.title !== 'string' ||
      typeof row.description !== 'string' ||
      typeof row.trade_category !== 'string' ||
      !isProjectStatus(row.status) ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('A project record has missing or invalid fields.')
    }

    return {
      id: row.id,
      resident_id: row.resident_id,
      assigned_student_id: row.assigned_student_id,
      title: row.title,
      description: row.description,
      trade_category: row.trade_category,
      location: typeof row.location === 'string' ? row.location : '',
      status: row.status,
      created_at: row.created_at,
    }
  })
}

function parseHours(value: unknown): HourSnapshot[] {
  if (!Array.isArray(value)) throw new Error('The field-hours response was not a list.')

  return value.map((item) => {
    const row = recordOf(item)
    const hours = row?.hours_logged
    const parsedHours = typeof hours === 'number'
      ? hours
      : typeof hours === 'string'
        ? Number(hours)
        : Number.NaN

    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.student_id !== 'string' ||
      typeof row.project_id !== 'string' ||
      !Number.isFinite(parsedHours) ||
      parsedHours <= 0 ||
      (row.status !== 'pending' && row.status !== 'approved') ||
      (typeof row.teacher_id !== 'string' && row.teacher_id !== null) ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('A field-hour record has missing or invalid fields.')
    }

    return {
      id: row.id,
      student_id: row.student_id,
      project_id: row.project_id,
      hours_logged: parsedHours,
      status: row.status,
      teacher_id: row.teacher_id,
      created_at: row.created_at,
    }
  })
}

function readableDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function InlineNotice({ children, kind = 'error' }: {
  children: string
  kind?: 'error' | 'success'
}) {
  return <p className={`workspace-notice is-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>
}

interface StudentWorkspaceProps extends WorkspaceProps {
  preview?: boolean
}

interface StudentWorkspaceData {
  availableProjects: ProjectSnapshot[]
  myProjects: ProjectSnapshot[]
  myHours: HourSnapshot[]
  projectTitles: Map<string, string>
}

export function StudentWorkspace({ profile, preview = false }: StudentWorkspaceProps) {
  const [availableProjects, setAvailableProjects] = useState<ProjectSnapshot[]>([])
  const [myProjects, setMyProjects] = useState<ProjectSnapshot[]>([])
  const [myHours, setMyHours] = useState<HourSnapshot[]>([])
  const [projectTitles, setProjectTitles] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [loggingHours, setLoggingHours] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [hoursInput, setHoursInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadWorkspace = useCallback(async (): Promise<StudentWorkspaceData> => {
    const [availableResult, mineResult, hoursResult] = await Promise.all([
      supabase
        .from('projects')
        .select('id, resident_id, assigned_student_id, title, description, trade_category, status, created_at')
        .eq('status', 'approved')
        .is('assigned_student_id', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, resident_id, assigned_student_id, title, description, trade_category, status, created_at')
        .eq('assigned_student_id', profile.id)
        .in('status', ['approved', 'in_progress', 'completed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('field_hours')
        .select('id, student_id, project_id, hours_logged, status, teacher_id, created_at')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false }),
    ])

    if (availableResult.error) throw availableResult.error
    if (mineResult.error) throw mineResult.error
    if (hoursResult.error) throw hoursResult.error

    const available = parseProjects(availableResult.data)
    const mine = parseProjects(mineResult.data)
    const hours = parseHours(hoursResult.data)
    const relatedProjectIds = [...new Set(hours.map((entry) => entry.project_id))]
    const titlesResult = relatedProjectIds.length
      ? await supabase.from('projects').select('id, title').in('id', relatedProjectIds)
      : { data: [], error: null }

    if (titlesResult.error) throw titlesResult.error

    const titles = new Map<string, string>()
    for (const item of titlesResult.data ?? []) {
      const row = recordOf(item)
      if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') {
        throw new Error('A project linked to your hour log has invalid data.')
      }
      titles.set(row.id, row.title)
    }

    return {
      availableProjects: available,
      myProjects: mine,
      myHours: hours,
      projectTitles: titles,
    }
  }, [profile.id])

  function applyWorkspace(data: StudentWorkspaceData) {
    setAvailableProjects(data.availableProjects)
    setMyProjects(data.myProjects)
    setMyHours(data.myHours)
    setProjectTitles(data.projectTitles)
    setErrorMessage('')
  }

  useEffect(() => {
    let active = true
    void loadWorkspace()
      .then((data) => {
        if (active) applyWorkspace(data)
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load student workspace.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadWorkspace])

  async function refresh() {
    setIsRefreshing(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      applyWorkspace(await loadWorkspace())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not refresh the project list.')
    } finally {
      setIsRefreshing(false)
    }
  }

  async function claimProject(project: ProjectSnapshot) {
    setClaimingId(project.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({ assigned_student_id: profile.id })
        .eq('id', project.id)
        .eq('status', 'approved')
        .is('assigned_student_id', null)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('This project was just claimed or is no longer available. Refresh to see current projects.')

      setAvailableProjects((current) => current.filter((item) => item.id !== project.id))
      setMyProjects((current) => [{ ...project, assigned_student_id: profile.id }, ...current])
      setSuccessMessage(`Your interest in “${project.title}” was sent for teacher approval. Do not begin work until it is approved.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not claim this project.')
    } finally {
      setClaimingId(null)
    }
  }

  async function submitHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const hours = Number(hoursInput)
    if (
      !activeProjects.some((project) => project.id === selectedProjectId) ||
      !Number.isFinite(hours) ||
      hours < 0.25 ||
      hours > 12
    ) {
      setErrorMessage('Choose an active project and enter between 0.25 and 12 hours.')
      return
    }
    if (Math.round(hours * 4) !== hours * 4) {
      setErrorMessage('Enter hours in 15-minute increments (for example, 1.25).')
      return
    }

    setLoggingHours(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.from('field_hours').insert({
        student_id: profile.id,
        project_id: selectedProjectId,
        hours_logged: hours,
        status: 'pending',
        teacher_id: null,
      })
      if (error) throw error

      setHoursInput('')
      setSuccessMessage('Your field hours were submitted for teacher review.')
      applyWorkspace(await loadWorkspace())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit your field hours.')
    } finally {
      setLoggingHours(false)
    }
  }

  const approvedHours = myHours
    .filter((entry) => entry.status === 'approved')
    .reduce((total, entry) => total + entry.hours_logged, 0)
  const pendingHours = myHours
    .filter((entry) => entry.status === 'pending')
    .reduce((total, entry) => total + entry.hours_logged, 0)
  const activeProjects = myProjects.filter((project) => project.status === 'in_progress')
  const awaitingApprovalProjects = myProjects.filter((project) => project.status === 'approved')

  return (
    <section className="role-workspace" aria-labelledby="student-workspace-title">
      <div className="workspace-heading">
        <div>
          <p className="workspace-eyebrow">Learning in the field</p>
          <h2 id="student-workspace-title">{preview ? 'Student perspective' : 'Your projects'}</h2>
        </div>
        <button className="workspace-secondary-button" disabled={isLoading || isRefreshing} onClick={() => void refresh()} type="button">
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </div>

      {preview && <InlineNotice kind="success">Read-only admin preview. Project claims and hour submissions are disabled; sign in with a student account to make changes.</InlineNotice>}
      {errorMessage && <InlineNotice>{errorMessage}</InlineNotice>}
      {successMessage && <InlineNotice kind="success">{successMessage}</InlineNotice>}

      <div className="student-stat-grid">
        <article className="student-stat"><span>Approved hours</span><strong>{approvedHours.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></article>
        <article className="student-stat"><span>Awaiting sign-off</span><strong>{pendingHours.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></article>
        <article className="student-stat"><span>Active projects</span><strong>{activeProjects.length}</strong></article>
      </div>

      <div className="workspace-section-heading">
        <div><p className="workspace-eyebrow">Find an opportunity</p><h3>Approved projects</h3></div>
        <span className="workspace-count">{availableProjects.length}</span>
      </div>
      {isLoading ? (
        <p className="workspace-empty" role="status">Loading approved projects...</p>
      ) : availableProjects.length === 0 ? (
        <p className="workspace-empty">There are no unclaimed approved projects right now. Check back later.</p>
      ) : (
        <div className="workspace-card-grid">
          {availableProjects.map((project) => (
            <article className="opportunity-card" key={project.id}>
              <div className="opportunity-meta">
                <span className="workspace-tag"><Wrench size={13} aria-hidden="true" />{project.trade_category}</span>
                <time>{readableDate(project.created_at)}</time>
              </div>
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <p className="privacy-note"><ShieldCheck size={14} aria-hidden="true" /> Location details are shared through your teacher after approval.</p>
              <button
                className="workspace-primary-button"
                disabled={preview || claimingId !== null}
                onClick={() => void claimProject(project)}
                type="button"
              >
                {claimingId === project.id ? 'Claiming...' : 'Claim project'}
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="student-work-columns">
        <section>
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Teacher sign-off required</p><h3>Awaiting assignment approval</h3></div></div>
          {awaitingApprovalProjects.length === 0 ? (
            <p className="workspace-empty">No claimed projects are waiting for teacher approval.</p>
          ) : (
            <div className="workspace-list">
              {awaitingApprovalProjects.map((project) => (
                <article className="workspace-list-card" key={project.id}>
                  <span className="workspace-tag">{project.trade_category}</span>
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                  <p className="privacy-note"><Clock3 size={14} aria-hidden="true" />Your teacher must approve this assignment before you start.</p>
                </article>
              ))}
            </div>
          )}
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Your assignments</p><h3>Active projects</h3></div></div>
          {activeProjects.length === 0 ? (
            <p className="workspace-empty">Claim an approved project to see it here.</p>
          ) : (
            <div className="workspace-list">
              {activeProjects.map((project) => (
                <article className="workspace-list-card" key={project.id}>
                  <span className="workspace-tag">{project.trade_category}</span>
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                  <p className="privacy-note"><MapPin size={14} aria-hidden="true" /> Ask your teacher for approved location and safety details.</p>
                  <button className="workspace-secondary-button" onClick={() => setSelectedProjectId(project.id)} type="button">Log hours for this project</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Teacher verification</p><h3>Submit field hours</h3></div></div>
          <form className="workspace-form" onSubmit={(event) => void submitHours(event)}>
            <label className="workspace-field">
              <span>Active project</span>
              <select required value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                <option value="">Choose a project</option>
                {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
            <label className="workspace-field">
              <span>Hours worked</span>
              <input
                inputMode="decimal"
                max="12"
                min="0.25"
                onChange={(event) => setHoursInput(event.target.value)}
                placeholder="e.g. 1.5"
                required
                step="0.25"
                type="number"
                value={hoursInput}
              />
            </label>
            <p className="workspace-helper">Submit only hours worked under an approved assignment. Your teacher must verify the entry.</p>
            <button className="workspace-primary-button" disabled={preview || loggingHours || activeProjects.length === 0} type="submit">
              <Send size={15} aria-hidden="true" />{loggingHours ? 'Submitting...' : 'Submit for approval'}
            </button>
          </form>
        </section>
      </div>

      <section className="student-hours-section">
        <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Progress record</p><h3>Recent field hours</h3></div></div>
        {myHours.length === 0 ? (
          <p className="workspace-empty">Your field-hour submissions will appear here.</p>
        ) : (
          <div className="hours-table-wrap">
            <table className="hours-table">
              <thead><tr><th>Project</th><th>Hours</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {myHours.map((entry) => (
                  <tr key={entry.id}>
                    <td>{projectTitles.get(entry.project_id) ?? 'Project details unavailable'}</td>
                    <td>{entry.hours_logged.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{readableDate(entry.created_at)}</td>
                    <td><span className={`status-pill is-${entry.status}`}>{entry.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

const safeTasks = [
  { category: 'Carpentry', title: 'Fix cabinet hinges', description: 'A supervised, non-structural cabinet hinge adjustment.' },
  { category: 'Carpentry', title: 'Repair loose interior trim', description: 'A supervised repair of loose, non-structural interior trim.' },
  { category: 'Technology', title: 'Troubleshoot software configuration', description: 'Help with basic software setup or configuration; no account passwords should be shared.' },
  { category: 'Technology', title: 'Set up a personal device', description: 'Help set up a personal device using the owner’s guidance; do not handle private credentials.' },
  { category: 'Automotive', title: 'Wash and wax car details', description: 'Exterior cleaning and detailing only; no mechanical or under-vehicle work.' },
] as const

const unsafeAddressPattern = /\b\d{1,6}\s+[a-z0-9.'-]+(?:\s+[a-z0-9.'-]+){0,4}\s(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/i
const contactInfoPattern = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b)/i
const unsafeTaskPattern = /\b(?:rewir(?:e|ing)|electrical panel|power panel|plumb(?:ing)?|gas line|load-bearing|structural|foundation|roof repair|brake repair|engine repair|boiler|furnace|sewer|demolition)\b/i

export function ResidentWorkspace({ profile, preview = false }: StudentWorkspaceProps) {
  const [projectRows, setProjectRows] = useState<ProjectSnapshot[]>([])
  const [taskIndex, setTaskIndex] = useState(0)
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadProjects = useCallback(async (): Promise<ProjectSnapshot[]> => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, resident_id, assigned_student_id, title, description, trade_category, location, status, created_at')
      .eq('resident_id', profile.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return parseProjects(data)
  }, [profile.id])

  function applyProjects(projects: ProjectSnapshot[]) {
    setProjectRows(projects)
    setErrorMessage('')
  }

  useEffect(() => {
    let active = true
    void loadProjects()
      .then((projects) => {
        if (active) applyProjects(projects)
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not load your project postings.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadProjects])

  async function refresh() {
    setIsRefreshing(true)
    setErrorMessage('')
    try {
      applyProjects(await loadProjects())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not refresh project postings.')
    } finally {
      setIsRefreshing(false)
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const task = safeTasks[taskIndex]
    const trimmedLocation = location.trim()
    const trimmedNotes = notes.trim()

    if (!trimmedLocation || trimmedLocation.length > 100) {
      setErrorMessage('Enter a town or general neighborhood (100 characters or fewer).')
      return
    }
    if (unsafeAddressPattern.test(trimmedLocation) || contactInfoPattern.test(trimmedLocation)) {
      setErrorMessage('For safety, enter a town or neighborhood only—do not include a street address, phone number, or email.')
      return
    }
    if (trimmedNotes.length > 300 || contactInfoPattern.test(trimmedNotes)) {
      setErrorMessage('Keep project notes under 300 characters and do not include phone numbers, email addresses, or passwords.')
      return
    }
    if (unsafeTaskPattern.test(trimmedNotes)) {
      setErrorMessage('Those notes describe work outside the approved low-risk task list. Choose an eligible task and contact the school for other requests.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const description = trimmedNotes
        ? `${task.description}\n\nAdditional context: ${trimmedNotes}`
        : task.description
      const { error } = await supabase.from('projects').insert({
        resident_id: profile.id,
        assigned_student_id: null,
        title: task.title,
        description,
        trade_category: task.category,
        location: trimmedLocation,
        status: 'pending',
      })
      if (error) throw error
      setLocation('')
      setNotes('')
      setSuccessMessage('Your project was submitted for teacher safety review. It will not appear to students until approved.')
      applyProjects(await loadProjects())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit this project.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function markProjectComplete(project: ProjectSnapshot) {
    setCompletingId(project.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', project.id)
        .eq('resident_id', profile.id)
        .eq('status', 'in_progress')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('This project is no longer active or you are not allowed to update it. Refresh and try again.')

      applyProjects(await loadProjects())
      setSuccessMessage('Project marked complete. Thank you for supporting supervised, educational community work.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update project status.')
    } finally {
      setCompletingId(null)
    }
  }

  const pendingCount = projectRows.filter((project) => project.status === 'pending').length
  const activeCount = projectRows.filter((project) => project.status === 'approved' || project.status === 'in_progress').length
  const completedCount = projectRows.filter((project) => project.status === 'completed').length

  return (
    <section className="role-workspace" aria-labelledby="resident-workspace-title">
      <div className="workspace-heading">
        <div><p className="workspace-eyebrow">Community help, thoughtfully matched</p><h2 id="resident-workspace-title">{preview ? 'Resident perspective' : 'Your projects'}</h2></div>
        <button className="workspace-secondary-button" disabled={isLoading || isRefreshing} onClick={() => void refresh()} type="button"><RefreshCw size={15} aria-hidden="true" />Refresh</button>
      </div>
      {preview && <InlineNotice kind="success">Read-only admin preview. Posting and completion updates are disabled; sign in with a resident account to make changes.</InlineNotice>}
      {errorMessage && <InlineNotice>{errorMessage}</InlineNotice>}
      {successMessage && <InlineNotice kind="success">{successMessage}</InlineNotice>}

      <div className="resident-summary">
        <article><span>Awaiting teacher review</span><strong>{pendingCount}</strong></article>
        <article><span>Approved or in progress</span><strong>{activeCount}</strong></article>
        <article><span>Completed</span><strong>{completedCount}</strong></article>
      </div>

      <div className="resident-columns">
        <section>
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">A short list of pre-reviewed tasks</p><h3>Post a project</h3></div></div>
          <div className="safety-banner"><ShieldCheck size={18} aria-hidden="true" /><p>Projects require teacher approval before students can view them. Requests are limited to low-risk educational tasks—not licensed, structural, electrical, plumbing, mechanical, or emergency work.</p></div>
          <form className="workspace-form" onSubmit={(event) => void createProject(event)}>
            <label className="workspace-field">
              <span>Task</span>
              <select value={taskIndex} onChange={(event) => setTaskIndex(Number(event.target.value))}>
                {safeTasks.map((task, index) => <option key={task.title} value={index}>{task.category}: {task.title}</option>)}
              </select>
            </label>
            <div className="selected-task-note"><Wrench size={15} aria-hidden="true" />{safeTasks[taskIndex].description}</div>
            <label className="workspace-field">
              <span>Town or general neighborhood</span>
              <input
                autoComplete="off"
                maxLength={100}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Morristown"
                required
                value={location}
              />
              <span className="workspace-helper">Do not enter a street address. Share precise details only after teacher approval through an approved channel.</span>
            </label>
            <label className="workspace-field">
              <span>Additional context <small>(optional)</small></span>
              <textarea
                maxLength={300}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Share brief, task-related details. Do not include private contact information, passwords, or requests to do additional work."
                rows={3}
                value={notes}
              />
              <span className="workspace-helper">{notes.length}/300 characters</span>
            </label>
            <button className="workspace-primary-button" disabled={preview || isSubmitting} type="submit">
              <Send size={15} aria-hidden="true" />{isSubmitting ? 'Submitting...' : 'Submit for teacher review'}
            </button>
          </form>
        </section>

        <section>
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Progress at a glance</p><h3>Your postings</h3></div><span className="workspace-count">{projectRows.length}</span></div>
          {isLoading ? (
            <p className="workspace-empty" role="status">Loading your project postings...</p>
          ) : projectRows.length === 0 ? (
            <p className="workspace-empty">Your submitted projects and their review status will appear here.</p>
          ) : (
            <div className="workspace-list">
              {projectRows.map((project) => (
                <article className="workspace-list-card" key={project.id}>
                  <div className="opportunity-meta"><span className="workspace-tag">{project.trade_category}</span><span className={`status-pill is-${project.status}`}>{project.status.replace('_', ' ')}</span></div>
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                  <p className="privacy-note"><MapPin size={14} aria-hidden="true" />{project.location}</p>
                  {project.assigned_student_id && <p className="privacy-note"><ShieldCheck size={14} aria-hidden="true" />A student is assigned. Their identity is not shown here.</p>}
                  <time className="workspace-date">Posted {readableDate(project.created_at)}</time>
                  {project.status === 'in_progress' && (
                    <button
                      className="workspace-secondary-button completion-button"
                      disabled={preview || completingId !== null}
                      onClick={() => void markProjectComplete(project)}
                      type="button"
                    >
                      <Check size={15} aria-hidden="true" />
                      {completingId === project.id ? 'Updating...' : 'Mark project complete'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

function compensationLabel(status: OpportunitySnapshot['compensation_status']) {
  if (status === 'paid') return 'Paid arrangement stated by partner'
  if (status === 'unpaid_educational') return 'Unpaid educational placement stated by partner'
  return 'Compensation to be determined with school'
}

interface PlacementWorkspaceProps extends WorkspaceProps {
  preview?: boolean
}

export function PlacementWorkspace({ profile, preview = false }: PlacementWorkspaceProps) {
  const [opportunities, setOpportunities] = useState<OpportunitySnapshot[]>([])
  const [interests, setInterests] = useState<InterestSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadPlacements = useCallback(async () => {
    const [opportunityResult, interestResult] = await Promise.all([
      supabase
        .from('partner_opportunities')
        .select('id, partner_id, organization_name, title, trade_category, description, learning_goals, supervision_plan, location, compensation_status, status, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      supabase
        .from('placement_interests')
        .select('id, opportunity_id, student_id, status, teacher_id, created_at')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false }),
    ])
    if (opportunityResult.error) throw opportunityResult.error
    if (interestResult.error) throw interestResult.error
    return {
      opportunities: parseOpportunities(opportunityResult.data),
      interests: parseInterests(interestResult.data),
    }
  }, [profile.id])

  useEffect(() => {
    let active = true
    void loadPlacements()
      .then((data) => {
        if (active) {
          setOpportunities(data.opportunities)
          setInterests(data.interests)
          setErrorMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not load placement opportunities.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadPlacements])

  async function requestIntroduction(opportunity: OpportunitySnapshot) {
    setRequestingId(opportunity.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.from('placement_interests').insert({
        opportunity_id: opportunity.id,
        student_id: profile.id,
        status: 'pending',
        teacher_id: null,
      })
      if (error) throw error
      const result = await loadPlacements()
      setInterests(result.interests)
      setOpportunities(result.opportunities)
      setSuccessMessage('Your interest was sent to a teacher for review. Your contact details are not shared with the partner by this request.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit your interest.')
    } finally {
      setRequestingId(null)
    }
  }

  const latestInterest = new Map<string, InterestSnapshot>()
  for (const interest of interests) {
    if (!latestInterest.has(interest.opportunity_id)) latestInterest.set(interest.opportunity_id, interest)
  }

  return (
    <section className="role-workspace" aria-labelledby="placement-workspace-title">
      <div className="workspace-heading">
        <div>
          <p className="workspace-eyebrow">Trade learning, with school oversight</p>
          <h2 id="placement-workspace-title">{preview ? 'Student placement view' : 'Industry placements'}</h2>
        </div>
      </div>
      {preview && <InlineNotice kind="success">Read-only admin preview. Placement interest requests are disabled.</InlineNotice>}
      {errorMessage && <InlineNotice>{errorMessage}</InlineNotice>}
      {successMessage && <InlineNotice kind="success">{successMessage}</InlineNotice>}
      <div className="placement-safety-banner">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>Listings are educational introductions, not job offers or proof of qualifying apprenticeship/licensing hours. A teacher must review each interest before any contact or placement discussion. Compensation, age eligibility, work authorization, supervision, and school approval must be confirmed independently before participation.</p>
      </div>

      <div className="workspace-section-heading">
        <div><p className="workspace-eyebrow">Teacher-reviewed partners</p><h3>Learning opportunities</h3></div>
        <span className="workspace-count">{opportunities.length}</span>
      </div>
      {isLoading ? (
        <p className="workspace-empty" role="status">Loading approved placements...</p>
      ) : opportunities.length === 0 ? (
        <p className="workspace-empty">There are no approved industry placements right now.</p>
      ) : (
        <div className="workspace-card-grid">
          {opportunities.map((opportunity) => {
            const interest = latestInterest.get(opportunity.id)
            return (
              <article className="opportunity-card placement-card" key={opportunity.id}>
                <div className="opportunity-meta">
                  <span className="workspace-tag"><BriefcaseBusiness size={13} aria-hidden="true" />{opportunity.trade_category}</span>
                  <time>{readableDate(opportunity.created_at)}</time>
                </div>
                <h3>{opportunity.title}</h3>
                <p className="placement-org">{opportunity.organization_name} · {opportunity.location}</p>
                <p>{opportunity.description}</p>
                <div className="placement-detail"><strong>Learning goals</strong><p>{opportunity.learning_goals}</p></div>
                <div className="placement-detail"><strong>Supervision described</strong><p>{opportunity.supervision_plan}</p></div>
                <p className="compensation-disclosure">{compensationLabel(opportunity.compensation_status)}</p>
                {interest ? (
                  <p className={`placement-interest-status is-${interest.status}`}>
                    Interest status: {interest.status === 'pending' ? 'Waiting for teacher review' : interest.status}
                  </p>
                ) : (
                  <button
                    className="workspace-primary-button"
                    disabled={preview || requestingId !== null}
                    onClick={() => void requestIntroduction(opportunity)}
                    type="button"
                  >
                    <Send size={14} aria-hidden="true" />
                    {requestingId === opportunity.id ? 'Sending...' : 'Ask my teacher for an introduction'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

const partnerTradeOptions = ['Carpentry', 'Automotive', 'Welding', 'Electrical', 'Plumbing', 'Information technology', 'Graphic design', 'Allied health', 'Other'] as const

export function IndustryPartnerWorkspace({ profile, preview = false }: PlacementWorkspaceProps) {
  const [opportunities, setOpportunities] = useState<OpportunitySnapshot[]>([])
  const [organizationName, setOrganizationName] = useState('')
  const [title, setTitle] = useState('')
  const [tradeCategory, setTradeCategory] = useState<string>(partnerTradeOptions[0])
  const [description, setDescription] = useState('')
  const [learningGoals, setLearningGoals] = useState('')
  const [supervisionPlan, setSupervisionPlan] = useState('')
  const [location, setLocation] = useState('')
  const [compensationStatus, setCompensationStatus] = useState<OpportunitySnapshot['compensation_status']>('to_be_determined')
  const [interestCounts, setInterestCounts] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadPartnerWorkspace = useCallback(async () => {
    const { data, error } = await supabase
      .from('partner_opportunities')
      .select('id, partner_id, organization_name, title, trade_category, description, learning_goals, supervision_plan, location, compensation_status, status, created_at')
      .eq('partner_id', profile.id)
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = parseOpportunities(data)
    const countResult = await supabase.rpc('partner_approved_interest_counts')
    if (countResult.error) throw countResult.error
    if (!Array.isArray(countResult.data)) {
      throw new Error('The approved student introduction counts could not be read.')
    }

    const counts = new Map<string, number>()
    for (const item of countResult.data ?? []) {
      const row = recordOf(item)
      if (!row || typeof row.opportunity_id !== 'string' || !Number.isFinite(Number(row.approved_count))) {
        throw new Error('An approved student introduction count has invalid data.')
      }
      counts.set(row.opportunity_id, Number(row.approved_count))
    }
    return { opportunities: rows, interestCounts: counts }
  }, [profile.id])

  useEffect(() => {
    let active = true
    void loadPartnerWorkspace()
      .then((data) => {
        if (active) {
          setOpportunities(data.opportunities)
          setInterestCounts(data.interestCounts)
          setErrorMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not load partner opportunities.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadPartnerWorkspace])

  async function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (contactInfoPattern.test(description) || contactInfoPattern.test(learningGoals) || contactInfoPattern.test(supervisionPlan)) {
      setErrorMessage('Do not include personal phone numbers, email addresses, or private contact details in a public listing.')
      return
    }
    if (unsafeAddressPattern.test(location) || contactInfoPattern.test(location)) {
      setErrorMessage('Enter a town or general area only, not a street address or contact details.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { error } = await supabase.from('partner_opportunities').insert({
        partner_id: profile.id,
        organization_name: organizationName.trim(),
        title: title.trim(),
        trade_category: tradeCategory,
        description: description.trim(),
        learning_goals: learningGoals.trim(),
        supervision_plan: supervisionPlan.trim(),
        location: location.trim(),
        compensation_status: compensationStatus,
        status: 'pending',
      })
      if (error) throw error
      setOrganizationName('')
      setTitle('')
      setDescription('')
      setLearningGoals('')
      setSupervisionPlan('')
      setLocation('')
      const updated = await loadPartnerWorkspace()
      setOpportunities(updated.opportunities)
      setInterestCounts(updated.interestCounts)
      setSuccessMessage('Your learning placement was submitted for school review. Students will not see it until approved.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit the placement listing.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function closeOpportunity(opportunity: OpportunitySnapshot) {
    setClosingId(opportunity.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { data, error } = await supabase
        .from('partner_opportunities')
        .update({ status: 'closed' })
        .eq('id', opportunity.id)
        .eq('partner_id', profile.id)
        .eq('status', 'approved')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('This listing is no longer open or cannot be closed. Refresh and try again.')
      const updated = await loadPartnerWorkspace()
      setOpportunities(updated.opportunities)
      setInterestCounts(updated.interestCounts)
      setSuccessMessage('The listing is now closed to new student interest requests.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not close this listing.')
    } finally {
      setClosingId(null)
    }
  }

  return (
    <section className="role-workspace" aria-labelledby="partner-workspace-title">
      <div className="workspace-heading">
        <div><p className="workspace-eyebrow">Share skills and supervised learning</p><h2 id="partner-workspace-title">{preview ? 'Industry partner view' : 'Learning placements'}</h2></div>
      </div>
      {preview && <InlineNotice kind="success">Read-only admin preview. Listing and close actions are disabled.</InlineNotice>}
      {errorMessage && <InlineNotice>{errorMessage}</InlineNotice>}
      {successMessage && <InlineNotice kind="success">{successMessage}</InlineNotice>}
      <div className="placement-safety-banner">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>Post supervised learning opportunities—not a promise of employment, license credit, or school approval. State the compensation arrangement honestly. The school must independently review eligibility, supervision, safety, and any applicable work rules before an introduction.</p>
      </div>

      <div className="partner-placement-columns">
        <section>
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">For verified partner accounts</p><h3>Propose a learning placement</h3></div></div>
          <form className="workspace-form" onSubmit={(event) => void createOpportunity(event)}>
            <label className="workspace-field"><span>Organization name</span><input maxLength={120} onChange={(event) => setOrganizationName(event.target.value)} required value={organizationName} /></label>
            <label className="workspace-field"><span>Placement title</span><input maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introductory carpentry mentorship" required value={title} /></label>
            <label className="workspace-field"><span>Trade area</span><select onChange={(event) => setTradeCategory(event.target.value)} value={tradeCategory}>{partnerTradeOptions.map((trade) => <option key={trade}>{trade}</option>)}</select></label>
            <label className="workspace-field"><span>Learning description</span><textarea maxLength={1200} onChange={(event) => setDescription(event.target.value)} required rows={4} value={description} /></label>
            <label className="workspace-field"><span>Learning goals</span><textarea maxLength={600} onChange={(event) => setLearningGoals(event.target.value)} placeholder="What supervised skills would a student observe or practice?" required rows={3} value={learningGoals} /></label>
            <label className="workspace-field"><span>Adult supervision plan</span><textarea maxLength={600} onChange={(event) => setSupervisionPlan(event.target.value)} placeholder="Describe who supervises the student and how the school can verify the plan." required rows={3} value={supervisionPlan} /></label>
            <label className="workspace-field"><span>Town or general area</span><input maxLength={100} onChange={(event) => setLocation(event.target.value)} placeholder="No street address" required value={location} /></label>
            <label className="workspace-field"><span>Compensation arrangement stated by partner</span><select onChange={(event) => setCompensationStatus(event.target.value as OpportunitySnapshot['compensation_status'])} value={compensationStatus}><option value="to_be_determined">To be determined with school</option><option value="paid">Paid arrangement proposed</option><option value="unpaid_educational">Unpaid educational placement proposed</option></select><span className="workspace-helper">This disclosure does not determine whether an arrangement is lawful or whether hours qualify for any credential.</span></label>
            <button className="workspace-primary-button" disabled={preview || isSubmitting} type="submit"><Send size={14} aria-hidden="true" />{isSubmitting ? 'Submitting...' : 'Submit for school review'}</button>
          </form>
        </section>

        <section>
          <div className="workspace-section-heading"><div><p className="workspace-eyebrow">School-reviewed first</p><h3>Your listings</h3></div><span className="workspace-count">{opportunities.length}</span></div>
          {isLoading ? (
            <p className="workspace-empty" role="status">Loading your listings...</p>
          ) : opportunities.length === 0 ? (
            <p className="workspace-empty">Your submitted placements and their school review status appear here.</p>
          ) : (
            <div className="workspace-list">
              {opportunities.map((opportunity) => (
                <article className="workspace-list-card" key={opportunity.id}>
                  <div className="opportunity-meta"><span className="workspace-tag">{opportunity.trade_category}</span><span className={`status-pill is-${opportunity.status}`}>{opportunity.status}</span></div>
                  <h4>{opportunity.title}</h4>
                  <p className="placement-org">{opportunity.organization_name} · {opportunity.location}</p>
                  <p>{opportunity.description}</p>
                  <p className="workspace-helper">{interestCounts.get(opportunity.id) ?? 0} teacher-approved student introduction{interestCounts.get(opportunity.id) === 1 ? '' : 's'}.</p>
                  {opportunity.status === 'approved' && (
                    <button className="workspace-secondary-button completion-button" disabled={preview || closingId !== null} onClick={() => void closeOpportunity(opportunity)} type="button">
                      {closingId === opportunity.id ? 'Closing...' : 'Close listing'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

interface PartnerReviewQueueProps {
  teacherId: string
  readOnly?: boolean
}

interface PartnerReviewData {
  listings: OpportunitySnapshot[]
  interests: InterestSnapshot[]
  studentNames: Map<string, string>
  opportunityTitles: Map<string, string>
}

const partnerListingApprovalChecks = [
  'The partner has completed the school’s required organization and adult-vetting process.',
  'The learning goals and supervision plan have been reviewed for this placement.',
  'Compensation and eligibility details have been referred to the school’s authorized reviewer; this approval does not determine legal compliance.',
]

const studentIntroductionApprovalChecks = [
  'I confirmed the student is eligible for an introduction under current school procedures.',
  'I reviewed the placement scope, supervision, and any compensation/age requirements with the authorized school contact.',
  'I will arrange any contact exchange through an approved school channel rather than exposing student details in this app.',
]

function PartnerReviewDecision({
  checks,
  busy,
  readOnly,
  onApprove,
  onReject,
}: {
  checks: string[]
  busy: boolean
  readOnly: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const [confirmed, setConfirmed] = useState<boolean[]>(() => checks.map(() => false))
  const canApprove = confirmed.every(Boolean)

  return (
    <>
      <fieldset className="partner-review-checks" disabled={busy || readOnly}>
        <legend>Required school review</legend>
        {checks.map((check, index) => (
          <label key={check}>
            <input
              checked={confirmed[index]}
              onChange={(event) => setConfirmed((current) =>
                current.map((value, checkIndex) =>
                  checkIndex === index ? event.target.checked : value,
                ),
              )}
              type="checkbox"
            />
            <span>{check}</span>
          </label>
        ))}
      </fieldset>
      <div className="review-decision-buttons">
        <button className="review-approve" disabled={readOnly || busy || !canApprove} onClick={onApprove} type="button">
          {busy ? 'Saving...' : 'Approve'}
        </button>
        <button className="review-reject" disabled={readOnly || busy} onClick={onReject} type="button">Decline</button>
      </div>
    </>
  )
}

export function PartnerReviewQueue({ teacherId, readOnly = false }: PartnerReviewQueueProps) {
  const [listings, setListings] = useState<OpportunitySnapshot[]>([])
  const [interests, setInterests] = useState<InterestSnapshot[]>([])
  const [studentNames, setStudentNames] = useState<Map<string, string>>(new Map())
  const [opportunityTitles, setOpportunityTitles] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const fetchReviewData = useCallback(async (): Promise<PartnerReviewData> => {
    const [listingResult, interestResult] = await Promise.all([
      supabase
        .from('partner_opportunities')
        .select('id, partner_id, organization_name, title, trade_category, description, learning_goals, supervision_plan, location, compensation_status, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('placement_interests')
        .select('id, opportunity_id, student_id, status, teacher_id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])
    if (listingResult.error) throw listingResult.error
    if (interestResult.error) throw interestResult.error

    const pendingListings = parseOpportunities(listingResult.data)
    const pendingInterests = parseInterests(interestResult.data)
    const studentIds = [...new Set(pendingInterests.map((entry) => entry.student_id))]
    const opportunityIds = [...new Set(pendingInterests.map((entry) => entry.opportunity_id))]
    const [studentResult, opportunityResult] = await Promise.all([
      studentIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : Promise.resolve({ data: [], error: null }),
      opportunityIds.length
        ? supabase.from('partner_opportunities').select('id, title').in('id', opportunityIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (studentResult.error) throw studentResult.error
    if (opportunityResult.error) throw opportunityResult.error

    const names = new Map<string, string>()
    for (const item of studentResult.data ?? []) {
      const row = recordOf(item)
      if (!row || typeof row.id !== 'string' || typeof row.full_name !== 'string') {
        throw new Error('A student profile in the placement review queue is invalid.')
      }
      names.set(row.id, row.full_name)
    }

    const titles = new Map<string, string>()
    for (const item of opportunityResult.data ?? []) {
      const row = recordOf(item)
      if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') {
        throw new Error('A placement title in the review queue is invalid.')
      }
      titles.set(row.id, row.title)
    }

    return {
      listings: pendingListings,
      interests: pendingInterests,
      studentNames: names,
      opportunityTitles: titles,
    }
  }, [])

  function applyReviewData(data: PartnerReviewData) {
    setListings(data.listings)
    setInterests(data.interests)
    setStudentNames(data.studentNames)
    setOpportunityTitles(data.opportunityTitles)
    setErrorMessage('')
  }

  useEffect(() => {
    let active = true
    void fetchReviewData()
      .then((data) => {
        if (active) applyReviewData(data)
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not load placement reviews.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchReviewData])

  async function reviewListing(opportunity: OpportunitySnapshot, decision: 'approved' | 'rejected') {
    setActionId(opportunity.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { data, error } = await supabase
        .from('partner_opportunities')
        .update({ status: decision })
        .eq('id', opportunity.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('This listing is no longer awaiting review or you are not permitted to review it.')
      const updated = await fetchReviewData()
      applyReviewData(updated)
      setSuccessMessage(decision === 'approved'
        ? 'Placement listing approved and visible to students.'
        : 'Placement listing declined; it will not be shown to students.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update placement listing.')
    } finally {
      setActionId(null)
    }
  }

  async function reviewInterest(interest: InterestSnapshot, decision: 'approved' | 'rejected') {
    setActionId(interest.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const { data, error } = await supabase
        .from('placement_interests')
        .update({ status: decision, teacher_id: teacherId })
        .eq('id', interest.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('This student introduction is no longer awaiting review or you are not permitted to review it.')
      const updated = await fetchReviewData()
      applyReviewData(updated)
      setSuccessMessage(decision === 'approved'
        ? 'School-reviewed introduction approved. Contact exchange must still follow school policy.'
        : 'Student introduction declined.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update student introduction.')
    } finally {
      setActionId(null)
    }
  }

  async function refresh() {
    setIsLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      applyReviewData(await fetchReviewData())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not refresh placement reviews.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="teacher-review" aria-labelledby="partner-review-title">
      <div className="review-toolbar">
        <p id="partner-review-title"><BriefcaseBusiness aria-hidden="true" size={17} /> {readOnly ? 'Partner review preview' : 'Industry placement review'}</p>
        <button className="review-refresh" disabled={isLoading} onClick={() => void refresh()} type="button">
          <RefreshCw aria-hidden="true" size={15} />{isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {readOnly && <p className="review-message review-success">Read-only admin preview. Decisions are disabled in preview mode.</p>}
      {errorMessage && <p className="review-message review-error" role="alert">{errorMessage}</p>}
      {successMessage && <p className="review-message review-success" role="status">{successMessage}</p>}
      {isLoading ? (
        <p className="review-empty" role="status">Loading partner reviews...</p>
      ) : (
        <div className="review-columns">
          <section className="review-section" aria-labelledby="pending-partner-listings">
            <div className="review-section-heading">
              <div><p className="review-section-label">External partner safety check</p><h2 id="pending-partner-listings">New placement listings</h2></div>
              <span className="review-count">{listings.length}</span>
            </div>
            {listings.length === 0 ? (
              <p className="review-empty">No partner listings are waiting for review.</p>
            ) : (
              <div className="review-list">
                {listings.map((opportunity) => (
                  <article className="review-card" key={opportunity.id}>
                    <div className="review-card-topline"><span className="review-category">{opportunity.trade_category}</span><time className="review-date">{readableDate(opportunity.created_at)}</time></div>
                    <h3>{opportunity.title}</h3>
                    <p className="review-card-description">{opportunity.organization_name} · {opportunity.location}</p>
                    <p className="review-card-description">{opportunity.description}</p>
                    <p className="review-detail"><strong>Learning goals:</strong> {opportunity.learning_goals}</p>
                    <p className="review-detail"><strong>Supervision:</strong> {opportunity.supervision_plan}</p>
                    <p className="review-detail"><strong>Compensation stated:</strong> {compensationLabel(opportunity.compensation_status)}</p>
                    <PartnerReviewDecision
                      checks={partnerListingApprovalChecks}
                      busy={actionId !== null}
                      readOnly={readOnly}
                      onApprove={() => void reviewListing(opportunity, 'approved')}
                      onReject={() => void reviewListing(opportunity, 'rejected')}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="review-section" aria-labelledby="pending-placement-interests">
            <div className="review-section-heading">
              <div><p className="review-section-label">Student safeguarding review</p><h2 id="pending-placement-interests">Introduction requests</h2></div>
              <span className="review-count">{interests.length}</span>
            </div>
            {interests.length === 0 ? (
              <p className="review-empty">No student introduction requests are waiting for review.</p>
            ) : (
              <div className="review-list">
                {interests.map((interest) => (
                  <article className="review-card" key={interest.id}>
                    <div className="review-card-topline"><span className="review-category">Student request</span><time className="review-date">{readableDate(interest.created_at)}</time></div>
                    <h3>{studentNames.get(interest.student_id) ?? 'Student profile unavailable'}</h3>
                    <p className="review-card-description">{opportunityTitles.get(interest.opportunity_id) ?? 'Placement listing unavailable'}</p>
                    <p className="review-detail">Contact details remain private; this decision records school review only.</p>
                    <PartnerReviewDecision
                      checks={studentIntroductionApprovalChecks}
                      busy={actionId !== null}
                      readOnly={readOnly}
                      onApprove={() => void reviewInterest(interest, 'approved')}
                      onReject={() => void reviewInterest(interest, 'rejected')}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

interface AdminOverviewProps {
  onOpenMode: (mode: 'student' | 'resident' | 'teacher' | 'industry_partner') => void
}

export function AdminOverview({ onOpenMode }: AdminOverviewProps) {
  const [metrics, setMetrics] = useState<{
    students: number
    residents: number
    teachers: number
    industryPartners: number
    admins: number
    pendingProjects: number
    pendingHours: number
    pendingPlacements: number
    pendingPlacementInterests: number
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadMetrics = useCallback(async () => {
    const [students, residents, teachers, partners, admins, projects, hours, placements, interests] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'resident'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'industry_partner'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('field_hours').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('partner_opportunities').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('placement_interests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    const failed = [
      students.error,
      residents.error,
      teachers.error,
      partners.error,
      admins.error,
      projects.error,
      hours.error,
      placements.error,
      interests.error,
    ].find(Boolean)
    if (failed) throw failed
    return {
      students: students.count ?? 0,
      residents: residents.count ?? 0,
      teachers: teachers.count ?? 0,
      industryPartners: partners.count ?? 0,
      admins: admins.count ?? 0,
      pendingProjects: projects.count ?? 0,
      pendingHours: hours.count ?? 0,
      pendingPlacements: placements.count ?? 0,
      pendingPlacementInterests: interests.count ?? 0,
    }
  }, [])

  async function refreshMetrics() {
    setIsRefreshing(true)
    try {
      setMetrics(await loadMetrics())
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not refresh admin metrics.')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadMetrics()
      .then((data) => {
        if (active) {
          setMetrics(data)
          setErrorMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Could not load admin metrics.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadMetrics])

  return (
    <section className="admin-overview-workspace" aria-labelledby="admin-overview-title">
      <div className="workspace-heading">
        <div><p className="workspace-eyebrow">District-wide oversight</p><h2 id="admin-overview-title">Operations overview</h2></div>
        <button className="workspace-secondary-button" disabled={isLoading || isRefreshing} onClick={() => void refreshMetrics()} type="button">
          <RefreshCw size={15} aria-hidden="true" />{isRefreshing ? 'Refreshing...' : 'Refresh counts'}
        </button>
      </div>
      {errorMessage && <InlineNotice>{errorMessage}</InlineNotice>}
      <div className="admin-live-metrics">
        {[
          ['Students', metrics?.students],
          ['Residents', metrics?.residents],
          ['Teachers', metrics?.teachers],
          ['Industry partners', metrics?.industryPartners],
          ['Admins', metrics?.admins],
          ['Projects awaiting approval', metrics?.pendingProjects],
          ['Field-hour entries awaiting sign-off', metrics?.pendingHours],
          ['Partner listings awaiting review', metrics?.pendingPlacements],
          ['Student introductions awaiting review', metrics?.pendingPlacementInterests],
        ].map(([label, value]) => (
          <article className="admin-live-metric" key={label}>
            <span>{label}</span>
            <strong>{isLoading ? '—' : typeof value === 'number' ? value : '—'}</strong>
          </article>
        ))}
      </div>
      {!isLoading && !errorMessage && metrics && (
        <>
          <p className="workspace-helper">Counts reflect rows visible under the current Supabase policies. They are not evidence of complete district-wide access unless the admin role is authorized by RLS.</p>
          <div className="admin-shortcuts">
            <button onClick={() => onOpenMode('student')} type="button"><Clock3 size={16} aria-hidden="true" /> Open student workspace</button>
            <button onClick={() => onOpenMode('resident')} type="button"><Wrench size={16} aria-hidden="true" /> Open resident workspace</button>
            <button onClick={() => onOpenMode('teacher')} type="button"><Check size={16} aria-hidden="true" /> Open teacher review queue</button>
            <button onClick={() => onOpenMode('industry_partner')} type="button"><BriefcaseBusiness size={16} aria-hidden="true" /> Open partner workspace</button>
          </div>
        </>
      )}
    </section>
  )
}
