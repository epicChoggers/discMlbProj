import { useState, useEffect } from 'react'
import { Leaderboard as LeaderboardType, LeaderboardEntry as LeaderboardEntryType } from '../lib/types'
import { leaderboardServiceNew } from '../lib/leaderboardService'

interface LeaderboardProps {
  gamePk?: number
}

export const Leaderboard = ({ gamePk }: LeaderboardProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const leaderboardData = await leaderboardServiceNew.getLeaderboard(gamePk, 10)
        setLeaderboard(leaderboardData)
      } catch (err) {
        console.error('Error loading leaderboard:', err)
        setError('Failed to load leaderboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadLeaderboard()

    // Subscribe to real-time updates
    const subscription = leaderboardServiceNew.subscribeToLeaderboard(gamePk, (newLeaderboard) => {
      setLeaderboard(newLeaderboard)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [gamePk])

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-1/2 mb-1"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <p>Failed to load leaderboard</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!leaderboard || leaderboard.entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">🏆 Leaderboard</h3>
        <div className="text-center text-gray-400 py-8">
          <div className="text-4xl mb-2">📊</div>
          <p>No predictions yet</p>
          <p className="text-sm">Be the first to make a prediction!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">🏆 Leaderboard</h3>
        <div className="text-gray-400 text-sm">
          {gamePk ? 'This Game' : 'All Time'}
        </div>
      </div>

      <div className="space-y-3">
        {leaderboard.entries.map((entry, index) => (
          <LeaderboardEntryComponent key={entry.user_id} entry={entry} rank={index + 1} />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700 text-center">
        <p className="text-gray-400 text-sm">
          {leaderboard.total_users} total players
        </p>
      </div>
    </div>
  )
}

interface LeaderboardEntryProps {
  entry: LeaderboardEntryType
  rank: number
}

const LeaderboardEntryComponent = ({ entry, rank }: LeaderboardEntryProps) => {
  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return `#${rank}`
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400'
      case 2: return 'text-gray-300'
      case 3: return 'text-amber-600'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50">
      {/* Rank */}
      <div className={`text-lg font-bold ${getRankColor(rank)} min-w-[2rem] text-center`}>
        {getRankEmoji(rank)}
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0">
        {entry.avatar_url ? (
          <img
            src={entry.avatar_url}
            alt={entry.username}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-gray-300 text-sm font-medium">
              {entry.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">
          {entry.username}
        </div>
        <div className="text-gray-400 text-sm">
          {entry.correct_predictions}/{entry.total_predictions} Correct | {entry.correct_outcomes}/{entry.total_outcomes} Outcomes | {entry.correct_exact_outcomes}/{entry.total_exact_outcomes} Exact Outcomes | {entry.total_points} Points
        </div>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="text-white font-semibold">
          {entry.accuracy.toFixed(1)}%
        </div>
        <div className="text-gray-400 text-sm">
          {entry.streak} streak
        </div>
      </div>
    </div>
  )
}
