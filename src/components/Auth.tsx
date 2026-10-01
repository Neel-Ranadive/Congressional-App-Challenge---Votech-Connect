import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isUserRole, type UserRole } from '../types/models'
import './Auth.css'

type AuthMode = 'sign-in' | 'sign-up'

const STUDENT_EMAIL_DOMAIN = '@mcvts.org'
const TEACHER_INVITE_CODE = (import.meta.env.VITE_TEACHER_INVITE_CODE ?? '').trim()
const ADMIN_INVITE_CODE = (import.meta.env.VITE_ADMIN_INVITE_CODE ?? '').trim()

function Auth() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [tradeArea, setTradeArea] = useState('')
  const [teacherInviteCode, setTeacherInviteCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    if (isSignUp && (!fullName.trim() || (role === 'student' && !tradeArea.trim()))) {
      setErrorMessage('Enter your name and, for student accounts, your trade area.')
      return
    }

    if (
      isSignUp &&
      role === 'student' &&
      !email.trim().toLowerCase().endsWith(STUDENT_EMAIL_DOMAIN)
    ) {
      setErrorMessage(`Student accounts must use an ${STUDENT_EMAIL_DOMAIN} email address.`)
      return
    }

    if (isSignUp && role === 'teacher') {
      if (!TEACHER_INVITE_CODE) {
        setErrorMessage('Teacher registrations are invite-only. Ask your district administrator to configure a teacher invite code.')
        return
      }

      if (teacherInviteCode.trim() !== TEACHER_INVITE_CODE) {
        setErrorMessage('The teacher invite code is invalid or expired.')
        return
      }
    }

    if (isSignUp && role === 'admin') {
      if (!ADMIN_INVITE_CODE) {
        setErrorMessage('Admin registrations are invite-only. Add VITE_ADMIN_INVITE_CODE to your environment before creating an admin account.')
        return
      }

      if (teacherInviteCode.trim() !== ADMIN_INVITE_CODE) {
        setErrorMessage('The admin invite code is invalid or expired.')
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role,
              ...(role === 'student' ? { trade_area: tradeArea.trim() } : {}),
            },
          },
        })

        if (error) throw error

        setStatusMessage(
          data.session
            ? 'Your account has been created.'
            : 'Check your email for a confirmation link to finish creating your account.',
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'We could not complete your request. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setTeacherInviteCode('')
    setErrorMessage('')
    setStatusMessage('')
  }

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-labelledby="intro-title">
        <a className="brand" href="/" aria-label="VoTech Connect home">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>VoTech <strong>Connect</strong></span>
        </a>

        <div className="intro-copy">
          <p className="eyebrow">Skills that strengthen communities</p>
          <h1 id="intro-title">Build something meaningful, right where you live.</h1>
          <p className="intro-description">
            Connect vocational students with neighbors who need a hand—and turn
            real community projects into hands-on experience.
          </p>
        </div>

        <p className="intro-footnote">Learn by doing. Grow together.</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <p className="eyebrow auth-eyebrow">{isSignUp ? 'Get started' : 'Welcome back'}</p>
          <h2 id="auth-title">{isSignUp ? 'Create your account' : 'Sign in to your account'}</h2>
          <p className="auth-subtitle">
            {isSignUp
              ? 'Join students, residents, and teachers making a difference.'
              : 'Pick up where you left off in your community.'}
          </p>

          <div className="auth-tabs" role="group" aria-label="Account access">
            <button
              className={!isSignUp ? 'auth-tab is-active' : 'auth-tab'}
              type="button"
              aria-pressed={!isSignUp}
              onClick={() => changeMode('sign-in')}
            >
              Sign in
            </button>
            <button
              className={isSignUp ? 'auth-tab is-active' : 'auth-tab'}
              type="button"
              aria-pressed={isSignUp}
              onClick={() => changeMode('sign-up')}
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <>
                <label className="form-field">
                  <span>Full name</span>
                  <input
                    autoComplete="name"
                    name="full_name"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    required
                    value={fullName}
                  />
                </label>

                <label className="form-field">
                  <span>I am a...</span>
                  <select
                    name="role"
                    onChange={(event) => {
                      if (isUserRole(event.target.value)) {
                        setRole(event.target.value)
                        setTeacherInviteCode('')
                      }
                    }}
                    value={role}
                  >
                    <option value="student">Student</option>
                    <option value="resident">Resident</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                {role === 'student' && (
                  <label className="form-field">
                    <span>Trade area</span>
                    <input
                      autoComplete="off"
                      name="trade_area"
                      onChange={(event) => setTradeArea(event.target.value)}
                      placeholder="e.g. Carpentry, automotive, health sciences"
                      required
                      value={tradeArea}
                    />
                  </label>
                )}

                {(role === 'teacher' || role === 'admin') && (
                  <label className="form-field">
                    <span>{role === 'admin' ? 'Admin invite code' : 'Teacher invite code'}</span>
                    <input
                      autoComplete="off"
                      name="teacher_invite"
                      onChange={(event) => setTeacherInviteCode(event.target.value)}
                      placeholder={
                        role === 'admin'
                          ? ADMIN_INVITE_CODE
                            ? 'Enter the admin invite code'
                            : 'Admin invite code not configured'
                          : TEACHER_INVITE_CODE
                            ? 'Enter your district invite code'
                            : 'Invite code not configured'
                      }
                      required
                      type="password"
                      value={teacherInviteCode}
                    />
                    <span className="field-hint">
                      {role === 'admin'
                        ? 'Admin access is restricted to designated district operators.'
                        : 'Teacher access is invite-only to keep district oversight and student safety in place.'}
                    </span>
                  </label>
                )}
              </>
            )}

            <label className="form-field">
              <span>Email address</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
                aria-describedby={
                  isSignUp && role === 'student' ? 'student-email-hint' : undefined
                }
              />
              {isSignUp && role === 'student' && (
                <span className="field-hint" id="student-email-hint">
                  Students must register with their @mcvts.org school email.
                </span>
              )}
            </label>

            <label className="form-field">
              <span>Password</span>
              <input
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={isSignUp ? 6 : undefined}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                required
                type="password"
                value={password}
              />
            </label>

            {errorMessage && (
              <p className="form-message form-error" role="alert">{errorMessage}</p>
            )}
            {statusMessage && (
              <p className="form-message form-success" role="status">{statusMessage}</p>
            )}

            <button className="submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Please wait...'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to VoTech Connect?'}{' '}
            <button
              className="text-button"
              onClick={() => changeMode(isSignUp ? 'sign-in' : 'sign-up')}
              type="button"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default Auth
