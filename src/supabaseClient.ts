import { createClient } from '@supabase/supabase-js'

// Use process.env for server-side, import.meta.env for client-side
const supabaseUrl = typeof process !== 'undefined' && process.env ? 
  process.env.VITE_SUPABASE_URL : 
  import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = typeof process !== 'undefined' && process.env ? 
  process.env.VITE_SUPABASE_ANON_KEY : 
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Helper to get current session
export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Helper to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
    throw error
  }
}
