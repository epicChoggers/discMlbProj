import { useState, useEffect } from 'react'
import { LockScreen } from './components/LockScreen'
import { TextWall } from './components/TextWall'
import { AuthCallback } from './components/AuthCallback'
import { getCurrentSession, supabase } from './supabaseClient'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      // Start the sync service first
      try {
        console.log('Starting sync service...')
        const response = await fetch('/api/system/startup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (response.ok) {
          console.log('Sync service started successfully')
        } else {
          console.warn('Failed to start sync service:', await response.text())
        }
      } catch (error) {
        console.warn('Error starting sync service:', error)
      }
    }

    const checkAuth = async () => {
      try {
        // Check if we're running locally and should bypass authentication
        const isLocalDev = import.meta.env.DEV && import.meta.env.VITE_LOCAL_BYPASS_AUTH === 'true'
        
        if (isLocalDev) {
          console.log('Local development mode detected - bypassing authentication')
          
          // Try to sign in with admin credentials for local development
          const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
          const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD
          
          if (adminEmail && adminPassword) {
            try {
              const { data, error } = await supabase.auth.signInWithPassword({
                email: adminEmail,
                password: adminPassword,
              })
              
              if (error) {
                console.warn('Admin login failed, falling back to normal auth:', error.message)
              } else if (data.session) {
                console.log('Successfully authenticated as admin:', data.session.user?.email)
                setIsAuthenticated(true)
                setIsLoading(false)
                return
              }
            } catch (err) {
              console.warn('Admin authentication error, falling back to normal auth:', err)
            }
          } else {
            console.warn('Admin credentials not configured, falling back to normal auth')
          }
        }

        // Check if we have auth tokens in the URL hash
        if (window.location.hash.includes('access_token')) {
          console.log('Found auth tokens in URL hash, processing...')
          
          // Parse the URL hash manually to extract tokens
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            console.log('Setting session with tokens...')
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
            
            if (error) {
              console.error('Error setting session:', error)
            } else if (data.session) {
              console.log('Successfully set session:', data.session.user?.email)
              setIsAuthenticated(true)
              setIsLoading(false)
              // Clear the URL hash after successful authentication
              window.history.replaceState({}, document.title, window.location.pathname)
              return
            }
          }
        }

        const session = await getCurrentSession()
        console.log('Initial session check:', session?.user?.email)
        setIsAuthenticated(!!session)
      } catch (error) {
        console.error('Error checking authentication:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    // Initialize the app (start sync service)
    initializeApp()
    
    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setIsAuthenticated(true)
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
        } else if (event === 'INITIAL_SESSION' && session) {
          setIsAuthenticated(true)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthenticated = () => {
    setIsAuthenticated(true)
  }

  const handleSignOut = () => {
    setIsAuthenticated(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if we're on the auth callback route
  const isAuthCallback = window.location.pathname === '/auth/callback'

  return (
    <div className="App">
      {isAuthCallback ? (
        <AuthCallback onAuthenticated={handleAuthenticated} />
      ) : isAuthenticated ? (
        <TextWall onSignOut={handleSignOut} />
      ) : (
        <LockScreen onAuthenticated={handleAuthenticated} />
      )}
    </div>
  )
}

export default App
