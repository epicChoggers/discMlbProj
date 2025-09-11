import { useState, useEffect, useMemo, useCallback } from 'react'
import { Leaderboard as LeaderboardType, LeaderboardEntry as LeaderboardEntryType, PredictionStats } from '../lib/types'
import { leaderboardServiceNew } from '../lib/leaderboardService'
import { predictionServiceNew } from '../lib/predictionService'
import { useSharedData } from '../lib/contexts/SharedDataContext'

interface LeaderboardProps {
  gamePk?: number
}

export const Leaderboard = ({ gamePk }: LeaderboardProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { userStats, setUserStats } = useSharedData()

  // Memoize leaderboard data to prevent unnecessary re-renders
  const memoizedLeaderboard = useMemo(() => leaderboard, [leaderboard?.entries?.length, leaderboard?.last_updated])
  const memoizedStats = useMemo(() => userStats, [userStats?.totalPoints, userStats?.accuracy, userStats?.streak])

  // Optimized leaderboard update callback
  const handleLeaderboardUpdate = useCallback((newLeaderboard: LeaderboardType) => {
    setLeaderboard(newLeaderboard)
  }, [])

  // Optimized stats update callback
  const handleStatsUpdate = useCallback((newStats: PredictionStats) => {
    setUserStats(newStats)
  }, [setUserStats])

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

    const loadStats = async () => {
      try {
        // Only load stats if not already loaded
        if (!userStats) {
          const statsData = await predictionServiceNew.getUserPredictionStats()
          setUserStats(statsData)
        }
      } catch (err) {
        console.error('Error loading stats:', err)
      }
    }

    loadLeaderboard()
    loadStats()

    // Subscribe to real-time updates with optimized callbacks
    const leaderboardSubscription = leaderboardServiceNew.subscribeToLeaderboard(gamePk, handleLeaderboardUpdate)

    // Subscribe to user stats updates with optimized callbacks
    const statsSubscription = predictionServiceNew.subscribeToUserStats(handleStatsUpdate)

    return () => {
      leaderboardSubscription.unsubscribe()
      statsSubscription.unsubscribe()
    }
  }, [gamePk, handleLeaderboardUpdate, handleStatsUpdate])

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

  if (!memoizedLeaderboard || memoizedLeaderboard.entries.length === 0) {
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
    <div className="space-y-4">
      {/* User Stats */}
      {memoizedStats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{memoizedStats.totalPoints}</div>
              <div className="text-gray-400 text-sm">Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{memoizedStats.exactPredictions}</div>
              <div className="text-gray-400 text-sm">Exact (3pts)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{memoizedStats.categoryPredictions}</div>
              <div className="text-gray-400 text-sm">Category (1pt)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{memoizedStats.streak}</div>
              <div className="text-gray-400 text-sm">Streak</div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">🏆 Leaderboard</h3>
          <div className="text-gray-400 text-sm">
            {gamePk ? 'This Game' : 'All Time'}
          </div>
        </div>

        <div className="space-y-3">
          {memoizedLeaderboard.entries.map((entry, index) => (
            <LeaderboardEntryComponent key={entry.user_id} entry={entry} rank={index + 1} />
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm">
            {memoizedLeaderboard.total_users} total players
          </p>
        </div>
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
