import { useState, useEffect } from 'react'
import { UserProfile as UserProfileType, PredictionStats } from '../lib/types'
import { supabase } from '../supabaseClient'
import { predictionServiceNew } from '../lib/predictionService'

interface UserProfileProps {
  onSignOut: () => void
}

export const UserProfile = ({ onSignOut }: UserProfileProps) => {
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null)
  const [stats, setStats] = useState<PredictionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  useEffect(() => {
    const loadUserProfile = async () => {
      setIsLoading(true)
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          return
        }

        // Get user profile from our custom table
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error loading user profile:', profileError)
        }

        // If no profile exists, create one from Discord data
        if (!profile && user.user_metadata?.provider === 'discord') {
          const discordData = user.user_metadata
          const newProfile = {
            id: user.id,
            discord_id: discordData.sub,
            username: discordData.full_name || discordData.preferred_username || discordData.name || 'Unknown User',
            avatar_url: discordData.avatar_url,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert([newProfile])

          if (insertError) {
            console.error('Error creating user profile:', insertError)
          } else {
            setUserProfile(newProfile)
          }
        } else if (profile) {
          setUserProfile(profile)
        }

        // Load prediction stats
        const userStats = await predictionServiceNew.getUserPredictionStats()
        setStats(userStats)
      } catch (error) {
        console.error('Error loading user profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [])

  // Track when we've initially loaded data
  useEffect(() => {
    if (!isLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true)
    }
  }, [isLoading, hasInitiallyLoaded])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      onSignOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Only show full loading state on initial load
  if (isLoading && !hasInitiallyLoaded) {
    return (
      <div className="flex items-center space-x-3">
        <div className="animate-pulse">
          <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-20 mb-1"></div>
          <div className="h-3 bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <button
        onClick={handleSignOut}
        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
      >
        Sign Out
      </button>
    )
  }

  return (
    <div className={`relative flex items-center space-x-3 ${isLoading ? 'opacity-75' : ''} transition-opacity duration-200`}>
      {/* Subtle updating indicator */}
      {isLoading && hasInitiallyLoaded && (
        <div className="absolute top-0 right-0 -mt-2 -mr-2">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
        </div>
      )}
      {/* Avatar */}
      <div className="flex-shrink-0">
        {userProfile.avatar_url ? (
          <img
            src={userProfile.avatar_url}
            alt={userProfile.username}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-gray-300 text-sm font-medium">
              {userProfile.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">
          {userProfile.username}
        </div>
        {stats && (
          <div className="text-gray-400 text-sm">
            {stats.totalPoints} pts • {stats.accuracy.toFixed(1)}% accuracy • {stats.streak} streak
          </div>
        )}
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-lg transition-colors duration-200 text-sm"
      >
        Sign Out
      </button>
    </div>
  )
}

