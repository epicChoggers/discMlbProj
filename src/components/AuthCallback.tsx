import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

interface AuthCallbackProps {
  onAuthenticated: () => void
}

export const AuthCallback = ({ onAuthenticated }: AuthCallbackProps) => {
  useEffect(() => {
    // The auth state listener in App.tsx will handle the authentication
    // Just redirect to home after a short delay
    const timer = setTimeout(() => {
      window.location.href = '/'
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Completing authentication...</p>
      </div>
    </div>
  )
}
