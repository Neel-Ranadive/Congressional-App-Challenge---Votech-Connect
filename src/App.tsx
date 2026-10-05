import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import PasswordUpdate from './components/PasswordUpdate'
import { supabase } from './lib/supabaseClient'
import { isUserRole, type Profile } from './types/models'
import './App.css'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session }
  | { status: 'error'; message: string }

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string; profile: Profile }
  | { status: 'error'; userId: string; message: string }

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false
  const profile = value as Record<string, unknown>

  return (
    typeof profile.id === 'string' &&
    typeof profile.full_name === 'string' &&
    isUserRole(profile.role) &&
    (typeof profile.trade_area === 'string' || profile.trade_area === null)
  )
}

function App() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const [profileState, setProfileState] = useState<ProfileState>({ status: 'loading' })
  const [signOutError, setSignOutError] = useState('')
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    let isActive = true
    let receivedAuthEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true
      if (!isActive) return
      if (_event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (_event === 'SIGNED_OUT') setIsPasswordRecovery(false)

      setAuthState(
        session ? { status: 'signed-in', session } : { status: 'signed-out' },
      )
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isActive || receivedAuthEvent) return
      if (error) {
        setAuthState({ status: 'error', message: error.message })
      } else {
        setAuthState(
          data.session
            ? { status: 'signed-in', session: data.session }
            : { status: 'signed-out' },
        )
      }
    }).catch((error: unknown) => {
      if (!isActive || receivedAuthEvent) return
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not restore your session.',
      })
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = authState.status === 'signed-in' ? authState.session.user.id : null

  useEffect(() => {
    if (!userId) return

    const authenticatedUserId = userId
    let isActive = true

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, trade_area')
          .eq('id', authenticatedUserId)
          .maybeSingle()

        if (!isActive) return
        if (error) {
          setProfileState({ status: 'error', userId: authenticatedUserId, message: error.message })
        } else if (!data) {
          setProfileState({
            status: 'error',
            userId: authenticatedUserId,
            message: 'Your account profile was not found. Confirm that the profile-creation trigger is enabled, then sign in again.',
          })
        } else if (!isProfile(data)) {
          setProfileState({
            status: 'error',
            userId: authenticatedUserId,
            message: 'Your account profile has an invalid or unsupported role. Ask an administrator to review it.',
          })
        } else {
          setProfileState({ status: 'ready', userId: authenticatedUserId, profile: data })
        }
      } catch (error) {
        if (!isActive) return
        setProfileState({
          status: 'error',
          userId: authenticatedUserId,
          message: error instanceof Error ? error.message : 'Could not load your account profile.',
        })
      }
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [userId])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function handleRecoverySignOut() {
    setSignOutError('')
    try {
      await signOut()
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Could not sign out. Please try again.',
      )
    }
  }

  if (authState.status === 'loading') {
    return <main className="app-state" role="status">Restoring your session...</main>
  }

  if (authState.status === 'error') {
    return (
      <main className="app-state">
        <section className="app-state-card">
          <h1>We couldn’t restore your session</h1>
          <p role="alert">{authState.message}</p>
          <button className="app-action" onClick={() => window.location.reload()} type="button">
            Try again
          </button>
        </section>
      </main>
    )
  }

  if (authState.status === 'signed-out') return <Auth />

  if (isPasswordRecovery) {
    return <PasswordUpdate onUpdated={() => setIsPasswordRecovery(false)} />
  }

  if (profileState.status === 'loading' || profileState.userId !== userId) {
    return <main className="app-state" role="status">Loading your account...</main>
  }

  if (profileState.status === 'error') {
    return (
      <main className="app-state">
        <section className="app-state-card">
          <h1>We couldn’t load your profile</h1>
          <p role="alert">{profileState.message}</p>
          {signOutError && <p role="alert">{signOutError}</p>}
          <button className="app-action" onClick={() => void handleRecoverySignOut()} type="button">
            Sign out
          </button>
        </section>
      </main>
    )
  }

  return <Dashboard profile={profileState.profile} onSignOut={signOut} />
}

export default App
