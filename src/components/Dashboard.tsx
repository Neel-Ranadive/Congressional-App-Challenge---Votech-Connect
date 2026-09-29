import { useCallback, useEffect, useState } from 'react'
import { Check, Clock3, LogOut, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import type { FieldHour, Profile, Project, ProjectStatus } from '../types/models'
import { supabase } from '../lib/supabaseClient'
import './Dashboard.css'

interface DashboardProps {
  profile: Profile
  onSignOut: () => Promise<void>
}

const dashboardDetails = {
  student: {
    label: 'Student dashboard',
    description: 'Explore approved community projects and keep track of your learning hours.',
    next: 'Approved projects and field-hour logging are the next dashboard features.',
  },
  resident: {
    label: 'Resident dashboard',
    description: 'Share a community project and follow its progress through teacher review.',
    next: 'Project posting and status tracking are the next dashboard features.',
  },
  teacher: {
    label: 'Teacher dashboard',
    description: 'Review community projects and verify students’ field-hour submissions.',
    next: '',
  },
} as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === 'pending' || value === 'approved' || value === 'in_progress' || value === 'completed'
}

function parseProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) throw new Error('The project queue response was invalid.')

  return value.map((item) => {
    const row = asRecord(item)
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.resident_id !== 'string' ||
      (typeof row.assigned_student_id !== 'string' && row.assigned_student_id !== null) ||
      typeof row.title !== 'string' ||
      typeof row.description !== 'string' ||
      typeof row.trade_category !== 'string' ||
      typeof row.location !== 'string' ||
      !isProjectStatus(row.status) ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('A project in the review queue has invalid data.')
    }

    return {
      id: row.id,
      resident_id: row.resident_id,
      assigned_student_id: row.assigned_student_id,
      title: row.title,
      description: row.description,
      trade_category: row.trade_category,
      location: row.location,
      status: row.status,
      created_at: row.created_at,
    }
  })
}

function parseFieldHours(value: unknown): FieldHour[] {
  if (!Array.isArray(value)) throw new Error('The field-hour queue response was invalid.')

  return value.map((item) => {
    const row = asRecord(item)
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
      row.status !== 'pending' ||
      (typeof row.teacher_id !== 'string' && row.teacher_id !== null) ||
      typeof row.created_at !== 'string'
    ) {
      throw new Error('A field-hour entry in the review queue has invalid data.')
    }

    return {
      id: row.id,
      student_id: row.student_id,
      project_id: row.project_id,
      hours_logged: parsedHours,
      status: 'pending',
      teacher_id: row.teacher_id,
      created_at: row.created_at,
    }
  })
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

interface ReviewQueueData {
  projects: Project[]
  fieldHours: FieldHour[]
  studentNames: Map<string, string>
  projectTitles: Map<string, string>
}

interface TeacherReviewQueueProps {
  teacherId: string
}

function TeacherReviewQueue({ teacherId }: TeacherReviewQueueProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [fieldHours, setFieldHours] = useState<FieldHour[]>([])
  const [studentNames, setStudentNames] = useState<Map<string, string>>(new Map())
  const [projectTitles, setProjectTitles] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [projectActionId, setProjectActionId] = useState<string | null>(null)
  const [hourActionId, setHourActionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const fetchQueue = useCallback(async (): Promise<ReviewQueueData> => {
    const [projectResult, hourResult] = await Promise.all([
      supabase
        .from('projects')
        .select('id, resident_id, assigned_student_id, title, description, trade_category, location, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('field_hours')
        .select('id, student_id, project_id, hours_logged, status, teacher_id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    if (projectResult.error) throw projectResult.error
    if (hourResult.error) throw hourResult.error

    const pendingProjects = parseProjects(projectResult.data)
    const pendingHours = parseFieldHours(hourResult.data)
    const studentIds = [...new Set(pendingHours.map((entry) => entry.student_id))]
    const relatedProjectIds = [...new Set(pendingHours.map((entry) => entry.project_id))]
    const [studentResult, relatedProjectResult] = await Promise.all([
      studentIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : Promise.resolve({ data: [], error: null }),
      relatedProjectIds.length
        ? supabase.from('projects').select('id, title').in('id', relatedProjectIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (studentResult.error) throw studentResult.error
    if (relatedProjectResult.error) throw relatedProjectResult.error

    const names = new Map<string, string>()
    for (const item of studentResult.data ?? []) {
      const row = asRecord(item)
      if (!row || typeof row.id !== 'string' || typeof row.full_name !== 'string') {
        throw new Error('A student profile linked to a field-hour entry has invalid data.')
      }
      names.set(row.id, row.full_name)
    }

    const titles = new Map<string, string>()
    for (const item of relatedProjectResult.data ?? []) {
      const row = asRecord(item)
      if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') {
        throw new Error('A project linked to a field-hour entry has invalid data.')
      }
      titles.set(row.id, row.title)
    }

    return {
      projects: pendingProjects,
      fieldHours: pendingHours,
      studentNames: names,
      projectTitles: titles,
    }
  }, [])

  function applyQueueData(data: ReviewQueueData) {
    setProjects(data.projects)
    setFieldHours(data.fieldHours)
    setStudentNames(data.studentNames)
    setProjectTitles(data.projectTitles)
    setErrorMessage('')
  }

  function showQueueError(error: unknown) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : 'Could not load the teacher review queue. Check your database permissions and try again.',
    )
  }

  useEffect(() => {
    let isActive = true
    void fetchQueue()
      .then((data) => {
        if (isActive) applyQueueData(data)
      })
      .catch((error: unknown) => {
        if (isActive) showQueueError(error)
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [fetchQueue])

  function refreshQueue() {
    setIsLoading(true)
    setErrorMessage('')
    setStatusMessage('')
    void fetchQueue()
      .then(applyQueueData)
      .catch(showQueueError)
      .finally(() => setIsLoading(false))
  }

  async function approveProject(project: Project) {
    setProjectActionId(project.id)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const { data, error } = await supabase
        .from('projects')
        .update({ status: 'approved' })
        .eq('id', project.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error('This project is no longer pending or you are not allowed to approve it. Refresh the queue and try again.')
      }

      setProjects((current) => current.filter((item) => item.id !== project.id))
      setStatusMessage(`Approved “${project.title}”.`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not approve this project.',
      )
    } finally {
      setProjectActionId(null)
    }
  }

  async function approveHours(entry: FieldHour) {
    setHourActionId(entry.id)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const { data, error } = await supabase
        .from('field_hours')
        .update({ status: 'approved', teacher_id: teacherId })
        .eq('id', entry.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error('This field-hour entry is no longer pending or you are not allowed to approve it. Refresh the queue and try again.')
      }

      setFieldHours((current) => current.filter((item) => item.id !== entry.id))
      setStatusMessage('Field hours approved and your teacher account recorded.')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not approve these field hours.',
      )
    } finally {
      setHourActionId(null)
    }
  }

  return (
    <div className="teacher-review">
      <div className="review-toolbar">
        <p><ShieldCheck aria-hidden="true" size={17} /> Teacher review queue</p>
        <button
          className="review-refresh"
          disabled={isLoading}
          onClick={refreshQueue}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={15} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {errorMessage && <p className="review-message review-error" role="alert">{errorMessage}</p>}
      {statusMessage && <p className="review-message review-success" role="status">{statusMessage}</p>}

      {isLoading ? (
        <p className="review-empty" role="status">Loading pending reviews...</p>
      ) : (
        <div className="review-columns">
          <section className="review-section" aria-labelledby="project-review-title">
            <div className="review-section-heading">
              <div>
                <p className="review-section-label">Project safety check</p>
                <h2 id="project-review-title">Pending projects</h2>
              </div>
              <span className="review-count">{projects.length}</span>
            </div>

            {projects.length === 0 ? (
              <p className="review-empty">No projects are waiting for review.</p>
            ) : (
              <div className="review-list">
                {projects.map((project) => (
                  <article className="review-card" key={project.id}>
                    <div className="review-card-topline">
                      <span className="review-category">{project.trade_category}</span>
                      <span className="review-date">Posted {formatDate(project.created_at)}</span>
                    </div>
                    <h3>{project.title}</h3>
                    <p className="review-card-description">{project.description}</p>
                    <p className="review-detail">
                      <MapPin aria-hidden="true" size={15} /> {project.location}
                    </p>
                    <button
                      className="review-approve"
                      disabled={projectActionId !== null || hourActionId !== null}
                      onClick={() => void approveProject(project)}
                      type="button"
                    >
                      <Check aria-hidden="true" size={16} />
                      {projectActionId === project.id ? 'Approving...' : 'Approve project'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="review-section" aria-labelledby="hour-review-title">
            <div className="review-section-heading">
              <div>
                <p className="review-section-label">Student progress</p>
                <h2 id="hour-review-title">Field hours to sign off</h2>
              </div>
              <span className="review-count">{fieldHours.length}</span>
            </div>

            {fieldHours.length === 0 ? (
              <p className="review-empty">No field-hour entries are waiting for sign-off.</p>
            ) : (
              <div className="review-list">
                {fieldHours.map((entry) => (
                  <article className="review-card hour-card" key={entry.id}>
                    <div className="review-card-topline">
                      <span className="review-category">
                        <Clock3 aria-hidden="true" size={14} />
                        {entry.hours_logged.toLocaleString(undefined, { maximumFractionDigits: 2 })} hours
                      </span>
                      <span className="review-date">Logged {formatDate(entry.created_at)}</span>
                    </div>
                    <h3>{studentNames.get(entry.student_id) ?? 'Student profile unavailable'}</h3>
                    <p className="review-card-description">
                      {projectTitles.get(entry.project_id) ?? 'Project details unavailable'}
                    </p>
                    <button
                      className="review-approve"
                      disabled={projectActionId !== null || hourActionId !== null}
                      onClick={() => void approveHours(entry)}
                      type="button"
                    >
                      <Check aria-hidden="true" size={16} />
                      {hourActionId === entry.id ? 'Signing off...' : 'Approve field hours'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Dashboard({ profile, onSignOut }: DashboardProps) {
  const [signOutError, setSignOutError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const details = dashboardDetails[profile.role]

  async function handleSignOut() {
    setIsSigningOut(true)
    setSignOutError('')

    try {
      await onSignOut()
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Could not sign out. Please try again.',
      )
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/" aria-label="VoTech Connect home">
          <span className="dashboard-brand-mark" aria-hidden="true">V</span>
          <span>VoTech <strong>Connect</strong></span>
        </a>
        <button
          className="sign-out-button"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
          type="button"
        >
          <LogOut aria-hidden="true" size={17} />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </header>

      <section className="dashboard-content" aria-labelledby="dashboard-title">
        <p className="dashboard-kicker">{details.label}</p>
        <h1 id="dashboard-title">Welcome, {profile.full_name}</h1>
        <p className="dashboard-description">{details.description}</p>

        <article className="dashboard-next">
          <span className="dashboard-role">{profile.role}</span>
          {profile.role === 'student' && profile.trade_area && (
            <p className="dashboard-trade">Trade area: {profile.trade_area}</p>
          )}
          {profile.role !== 'teacher' && <p>{details.next}</p>}
        </article>

        {profile.role === 'teacher' && <TeacherReviewQueue teacherId={profile.id} />}
        {signOutError && <p className="dashboard-error" role="alert">{signOutError}</p>}
      </section>
    </main>
  )
}

export default Dashboard
