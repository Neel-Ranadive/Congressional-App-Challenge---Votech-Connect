import { useCallback, useRef, useState } from 'react'
import { BookOpen, ExternalLink, RefreshCw, Users } from 'lucide-react'
import './GoogleClassroomWorkspace.css'

interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GoogleTokenError {
  type: string
  message?: string
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface GoogleClassroomApi {
  initTokenClient: (options: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: GoogleTokenError) => void
  }) => GoogleTokenClient
  revoke: (accessToken: string, callback?: () => void) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleClassroomApi
      }
    }
  }
}

interface ClassroomCourse {
  id: string
  name: string
  section: string
  courseState: string
  enrollmentCode: string
}

interface ClassroomPerson {
  userId: string
  fullName: string
  emailAddress: string
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLASSROOM_CLIENT_ID?.trim() ?? ''
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
].join(' ')

let googleScriptPromise: Promise<void> | null = null

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
      ?? document.createElement('script')
    const fail = () => {
      googleScriptPromise = null
      reject(new Error('Could not load Google sign-in. Check the network or browser restrictions, then try again.'))
    }

    if (!script.src) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.googleIdentity = 'true'
      script.addEventListener('load', () => {
        if (window.google?.accounts.oauth2) resolve()
        else fail()
      }, { once: true })
      script.addEventListener('error', fail, { once: true })
      document.head.appendChild(script)
      return
    }

    script.addEventListener('load', () => {
      if (window.google?.accounts.oauth2) resolve()
      else fail()
    }, { once: true })
    script.addEventListener('error', fail, { once: true })
  })

  return googleScriptPromise
}

function parseCourses(value: unknown): ClassroomCourse[] {
  const root = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
  const courses = root?.courses
  if (courses === undefined) return []
  if (!Array.isArray(courses)) throw new Error('Google returned an invalid class list.')

  return courses.map((value) => {
    const course = typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : null
    if (
      !course ||
      typeof course.id !== 'string' ||
      typeof course.name !== 'string'
    ) {
      throw new Error('Google returned a class with invalid details.')
    }

    return {
      id: course.id,
      name: course.name,
      section: typeof course.section === 'string' ? course.section : '',
      courseState: typeof course.courseState === 'string' ? course.courseState : 'UNKNOWN',
      enrollmentCode: typeof course.enrollmentCode === 'string' ? course.enrollmentCode : '',
    }
  })
}

function parsePeople(value: unknown): ClassroomPerson[] {
  const root = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
  const people = root?.students ?? root?.teachers
  if (people === undefined) return []
  if (!Array.isArray(people)) throw new Error('Google returned an invalid class roster.')

  return people.map((value) => {
    const item = typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : null
    const profile = typeof item?.profile === 'object' && item.profile !== null
      ? item.profile as Record<string, unknown>
      : null
    const name = typeof profile?.name === 'object' && profile.name !== null
      ? profile.name as Record<string, unknown>
      : null
    const userId = typeof item?.userId === 'string' ? item.userId : ''
    const fullName = typeof name?.fullName === 'string' ? name.fullName : ''

    if (!item || !userId || !fullName) {
      throw new Error('Google returned a roster member with invalid profile data.')
    }

    return {
      userId,
      fullName,
      emailAddress: typeof profile?.emailAddress === 'string' ? profile.emailAddress : '',
    }
  })
}

async function fetchClassroomPages<T>(
  url: string,
  accessToken: string,
  parse: (value: unknown) => T[],
): Promise<T[]> {
  const entries: T[] = []
  let nextPageToken: string | undefined

  do {
    const pageUrl = new URL(url)
    pageUrl.searchParams.set('pageSize', '100')
    if (nextPageToken) pageUrl.searchParams.set('pageToken', nextPageToken)

    const response = await fetch(pageUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const body: unknown = await response.json()

    if (!response.ok) {
      const errorBody = typeof body === 'object' && body !== null
        ? body as Record<string, unknown>
        : null
      const error = typeof errorBody?.error === 'object' && errorBody.error !== null
        ? errorBody.error as Record<string, unknown>
        : null
      const message = typeof error?.message === 'string'
        ? error.message
        : `Google Classroom request failed (${response.status}).`
      throw new Error(message)
    }

    entries.push(...parse(body))
    const root = typeof body === 'object' && body !== null
      ? body as Record<string, unknown>
      : null
    nextPageToken = typeof root?.nextPageToken === 'string'
      ? root.nextPageToken
      : undefined
  } while (nextPageToken)

  return entries
}

function getFriendlyGoogleError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Google Classroom could not complete the request.'
  if (/access_denied|not authorized|permission|forbidden|403/i.test(message)) {
    return `${message} Confirm that Classroom API is enabled and the signed-in Google account is a teacher in the selected class.`
  }
  return message
}

export function GoogleClassroomWorkspace() {
  const [accessToken, setAccessToken] = useState('')
  const [courses, setCourses] = useState<ClassroomCourse[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [students, setStudents] = useState<ClassroomPerson[]>([])
  const [teachers, setTeachers] = useState<ClassroomPerson[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [isLoadingRoster, setIsLoadingRoster] = useState(false)
  const [hasLoadedRoster, setHasLoadedRoster] = useState(false)
  const tokenClientRef = useRef<GoogleTokenClient | null>(null)

  const listCourses = useCallback(async (token: string) => {
    setIsLoadingCourses(true)
    setErrorMessage('')
    try {
      const result = await fetchClassroomPages(
        'https://classroom.googleapis.com/v1/courses?teacherId=me',
        token,
        parseCourses,
      )
      setCourses(result)
      setSelectedCourseId((current) =>
        result.some((course) => course.id === current) ? current : '',
      )
      setStudents([])
      setTeachers([])
      setHasLoadedRoster(false)
      setStatusMessage(
        result.length
          ? `Loaded ${result.length} class${result.length === 1 ? '' : 'es'} from Google Classroom.`
          : 'No classes taught by this Google account were returned.',
      )
    } catch (error) {
      setErrorMessage(getFriendlyGoogleError(error))
    } finally {
      setIsLoadingCourses(false)
    }
  }, [])

  async function connectClassroom() {
    if (!GOOGLE_CLIENT_ID) {
      setErrorMessage('Google Classroom is not configured. Add VITE_GOOGLE_CLASSROOM_CLIENT_ID to .env.local and restart Vite.')
      return
    }

    setIsConnecting(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      await loadGoogleIdentity()
      const google = window.google
      if (!google) throw new Error('Google sign-in loaded without its authorization client.')

      const token = await new Promise<string>((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: CLASSROOM_SCOPES,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(new Error(response.error_description ?? response.error ?? 'Google authorization did not return an access token.'))
            } else {
              resolve(response.access_token)
            }
          },
          error_callback: (error) => {
            reject(new Error(error.message ?? `Google authorization failed (${error.type}).`))
          },
        })
        tokenClientRef.current = client
        client.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
      })

      setAccessToken(token)
      setStatusMessage('Google Classroom connected for this browser session only.')
      await listCourses(token)
    } catch (error) {
      setErrorMessage(getFriendlyGoogleError(error))
    } finally {
      setIsConnecting(false)
    }
  }

  async function loadRoster(courseId: string) {
    if (!accessToken) {
      setErrorMessage('Reconnect to Google Classroom to load class rosters.')
      return
    }

    const course = courses.find((item) => item.id === courseId)
    if (!course) {
      setErrorMessage('Choose a valid class first.')
      return
    }

    setSelectedCourseId(courseId)
    setIsLoadingRoster(true)
    setErrorMessage('')
    setStatusMessage('')
    setStudents([])
    setTeachers([])
    setHasLoadedRoster(false)

    try {
      const encodedCourseId = encodeURIComponent(courseId)
      const [studentRoster, teacherRoster] = await Promise.all([
        fetchClassroomPages(
          `https://classroom.googleapis.com/v1/courses/${encodedCourseId}/students`,
          accessToken,
          parsePeople,
        ),
        fetchClassroomPages(
          `https://classroom.googleapis.com/v1/courses/${encodedCourseId}/teachers`,
          accessToken,
          parsePeople,
        ),
      ])
      setStudents(studentRoster)
      setTeachers(teacherRoster)
      setHasLoadedRoster(true)
      setStatusMessage(`Loaded ${studentRoster.length} students and ${teacherRoster.length} teachers for ${course.name}.`)
    } catch (error) {
      setErrorMessage(getFriendlyGoogleError(error))
    } finally {
      setIsLoadingRoster(false)
    }
  }

  function disconnectClassroom() {
    if (accessToken && window.google?.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken)
    }
    setAccessToken('')
    setCourses([])
    setSelectedCourseId('')
    setStudents([])
    setTeachers([])
    setHasLoadedRoster(false)
    setStatusMessage('Google Classroom disconnected from this browser session.')
    setErrorMessage('')
  }

  return (
    <section className="classroom-workspace" aria-labelledby="classroom-workspace-title">
      <div className="classroom-heading">
        <div className="classroom-heading-icon"><BookOpen size={19} aria-hidden="true" /></div>
        <div className="classroom-heading-copy">
          <p className="workspace-eyebrow">Optional school connection</p>
          <h2 id="classroom-workspace-title">Google Classroom</h2>
          <p>View classes and their rosters with a teacher-authorized Google account.</p>
        </div>
        {accessToken ? (
          <div className="classroom-actions">
            <button className="classroom-connect-button" disabled={isConnecting} onClick={() => void connectClassroom()} type="button">
              {isConnecting ? 'Connecting...' : 'Reconnect'}
            </button>
            <button className="classroom-disconnect-button" onClick={disconnectClassroom} type="button">Disconnect</button>
          </div>
        ) : (
          <button className="classroom-connect-button" disabled={isConnecting} onClick={() => void connectClassroom()} type="button">
            {isConnecting ? 'Connecting...' : 'Connect Classroom'}
          </button>
        )}
      </div>

      <div className="classroom-privacy">
        <Users size={16} aria-hidden="true" />
        <p>Roster data is read-only and kept in browser memory for this session. This app does not save Google names, emails, or class rosters to Supabase.</p>
      </div>

      {!GOOGLE_CLIENT_ID && (
        <p className="classroom-setup">
          Setup needed: configure <code>VITE_GOOGLE_CLASSROOM_CLIENT_ID</code> and enable the Google Classroom API in Google Cloud.
        </p>
      )}
      {errorMessage && <p className="classroom-feedback is-error" role="alert">{errorMessage}</p>}
      {statusMessage && <p className="classroom-feedback is-success" role="status">{statusMessage}</p>}

      {accessToken && (
        <div className="classroom-roster-area">
          <div className="classroom-select-row">
            <label className="workspace-field" htmlFor="classroom-course">
              <span>Select one of your classes</span>
              <select
                disabled={isLoadingCourses || courses.length === 0}
                id="classroom-course"
                onChange={(event) => {
                  setSelectedCourseId(event.target.value)
                  setStudents([])
                  setTeachers([])
                  setHasLoadedRoster(false)
                }}
                value={selectedCourseId}
              >
                <option value="">{isLoadingCourses ? 'Loading classes...' : 'Choose a class'}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}{course.section ? ` — ${course.section}` : ''} ({course.courseState.toLowerCase()})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="workspace-secondary-button classroom-load-button"
              disabled={!selectedCourseId || isLoadingRoster}
              onClick={() => void loadRoster(selectedCourseId)}
              type="button"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {isLoadingRoster ? 'Loading roster...' : 'Load roster'}
            </button>
          </div>

          {selectedCourseId && hasLoadedRoster && (
            <div className="classroom-roster-grid">
              <section className="classroom-roster-list" aria-labelledby="classroom-teachers-title">
                <div className="classroom-roster-heading">
                  <h3 id="classroom-teachers-title">Teachers</h3>
                  <span>{teachers.length}</span>
                </div>
                {teachers.length === 0 ? <p>No teacher records were returned.</p> : teachers.map((teacher) => (
                  <article className="classroom-person" key={teacher.userId}>
                    <strong>{teacher.fullName}</strong>
                    {teacher.emailAddress && <span>{teacher.emailAddress}</span>}
                  </article>
                ))}
              </section>
              <section className="classroom-roster-list" aria-labelledby="classroom-students-title">
                <div className="classroom-roster-heading">
                  <h3 id="classroom-students-title">Students</h3>
                  <span>{students.length}</span>
                </div>
                {students.length === 0 ? <p>No student records were returned.</p> : students.map((student) => (
                  <article className="classroom-person" key={student.userId}>
                    <strong>{student.fullName}</strong>
                    {student.emailAddress && <span>{student.emailAddress}</span>}
                  </article>
                ))}
              </section>
            </div>
          )}
        </div>
      )}

      <a className="classroom-google-link" href="https://classroom.google.com/" rel="noreferrer" target="_blank">
        Open Google Classroom <ExternalLink size={13} aria-hidden="true" />
      </a>
    </section>
  )
}
