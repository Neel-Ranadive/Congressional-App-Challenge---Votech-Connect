import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isUserRole, type UserRole } from '../types/models'
import './Auth.css'

type AuthMode = 'sign-in' | 'sign-up' | 'reset-password'

const STUDENT_EMAIL_DOMAIN = '@mcvts.org'

function Auth() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [tradeArea, setTradeArea] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    if (mode === 'reset-password') {
      setIsSubmitting(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setStatusMessage('If an account uses that email, Supabase will send a password reset link. Check your inbox and spam folder.')
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not request a password reset. Please try again.',
        )
      } finally {
        setIsSubmitting(false)
      }
      return
    }

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
          <p className="eyebrow auth-eyebrow">
            {isSignUp ? 'Get started' : mode === 'reset-password' ? 'Account recovery' : 'Welcome back'}
          </p>
          <h2 id="auth-title">
            {isSignUp
              ? 'Create your account'
              : mode === 'reset-password'
                ? 'Reset your password'
                : 'Sign in to your account'}
          </h2>
          <p className="auth-subtitle">
            {isSignUp
              ? 'Students and residents can register here. Teacher and admin accounts are issued by an authorized administrator.'
              : mode === 'reset-password'
                ? 'Enter your account email and we’ll request a reset link from Supabase.'
                : 'Pick up where you left off in your community.'}
          </p>

          {mode !== 'reset-password' && <div className="auth-tabs" role="group" aria-label="Account access">
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
          </div>}

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
                      }
                    }}
                    value={role}
                  >
                    <option value="student">Student</option>
                    <option value="resident">Resident</option>
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

            {mode !== 'reset-password' && (
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
            )}

            {errorMessage && (
              <p className="form-message form-error" role="alert">{errorMessage}</p>
            )}
            {statusMessage && (
              <p className="form-message form-success" role="status">{statusMessage}</p>
            )}

            <button className="submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Please wait...'
                : mode === 'reset-password'
                  ? 'Send reset link'
                  : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'reset-password'
              ? 'Remembered your password?'
              : isSignUp
                ? 'Already have an account?'
                : 'New to VoTech Connect?'}{' '}
            <button
              className="text-button"
              onClick={() => changeMode(mode === 'reset-password' ? 'sign-in' : isSignUp ? 'sign-in' : 'sign-up')}
              type="button"
            >
              {mode === 'reset-password' ? 'Sign in' : isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          {mode === 'sign-in' && (
            <p className="auth-switch auth-recovery-switch">
              <button className="text-button" onClick={() => changeMode('reset-password')} type="button">
                Forgot password?
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

export default Auth
