import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Auth.css'

interface GoogleProfileSetupProps {
  email: string
  initialName: string
  onComplete: () => void
}

function GoogleProfileSetup({ email, initialName, onComplete }: GoogleProfileSetupProps) {
  const [fullName, setFullName] = useState(initialName)
  const [role, setRole] = useState<'student' | 'resident'>('student')
  const [tradeArea, setTradeArea] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (role === 'student' && !email.toLowerCase().endsWith('@mcvts.org')) {
      setErrorMessage('Student accounts must use an @mcvts.org Google account.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('complete_google_profile_setup', {
        p_full_name: fullName.trim(),
        p_role: role,
        p_trade_area: role === 'student' ? tradeArea.trim() : null,
      })
      if (error) throw error
      onComplete()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not finish setting up your profile. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-labelledby="google-setup-intro">
        <a className="brand" href="/" aria-label="VoTech Connect home">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>VoTech <strong>Connect</strong></span>
        </a>
        <div className="intro-copy">
          <p className="eyebrow">One last step</p>
          <h1 id="google-setup-intro">Set up your VoTech Connect profile.</h1>
          <p className="intro-description">
            Choose a student or resident profile. Teacher, industry partner, and admin access
            must be assigned by an authorized administrator.
          </p>
        </div>
        <p className="intro-footnote">Learn by doing. Grow together.</p>
      </section>

      <section className="auth-panel" aria-labelledby="google-setup-title">
        <div className="auth-card">
          <p className="eyebrow auth-eyebrow">Google account connected</p>
          <h2 id="google-setup-title">Complete your profile</h2>
          <p className="auth-subtitle">{email || 'Your Google account'}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Full name</span>
              <input
                autoComplete="name"
                maxLength={120}
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>
            <label className="form-field">
              <span>I am a...</span>
              <select
                onChange={(event) => setRole(event.target.value === 'resident' ? 'resident' : 'student')}
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
                  maxLength={120}
                  onChange={(event) => setTradeArea(event.target.value)}
                  placeholder="e.g. Carpentry, automotive, health sciences"
                  required
                  value={tradeArea}
                />
              </label>
            )}
            {errorMessage && <p className="form-message form-error" role="alert">{errorMessage}</p>}
            <button className="submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving profile...' : 'Finish setup'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

export default GoogleProfileSetup
