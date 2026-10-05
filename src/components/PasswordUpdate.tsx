import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import './PasswordUpdate.css'

interface PasswordUpdateProps {
  onUpdated: () => void
}

function PasswordUpdate({ onUpdated }: PasswordUpdateProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (password.length < 8) {
      setErrorMessage('Choose a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      onUpdated()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update your password. Request a new recovery link and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="password-update-page">
      <section className="password-update-card" aria-labelledby="password-update-title">
        <a className="password-update-brand" href="/">VoTech <strong>Connect</strong></a>
        <p className="eyebrow auth-eyebrow">Account recovery</p>
        <h1 id="password-update-title">Choose a new password</h1>
        <p>Use a unique password that you do not reuse on another site.</p>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="form-field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label className="form-field">
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          {errorMessage && <p className="form-message form-error" role="alert">{errorMessage}</p>}
          <button className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default PasswordUpdate
