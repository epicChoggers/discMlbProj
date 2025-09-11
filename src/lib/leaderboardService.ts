import { Leaderboard as LeaderboardType } from './types'
import { supabase } from '../supabaseClient'
import { networkOptimizationService } from './services/NetworkOptimizationService'

export class LeaderboardServiceNew {
  private apiBaseUrl: string
  private isDevelopment: boolean
  private subscriptionCache = new Map<string, any>() // Cache subscriptions to prevent duplicates

  constructor() {
    // Check if we're in development mode
    this.isDevelopment = import.meta.env.DEV
    // Allow forcing production mode locally for testing
    const forceProduction = import.meta.env.VITE_FORCE_PRODUCTION_MODE === 'true'
    
    if (forceProduction) {
      this.isDevelopment = false
    }
    
    // Use full URL in production, relative URL in development
    this.apiBaseUrl = this.isDevelopment ? '/api' : `${window.location.origin}/api`
  }

  // Get leaderboard data using the unified API with optimized caching
  async getLeaderboard(gamePk?: number, limit: number = 10): Promise<LeaderboardType> {
    const cacheKey = `leaderboard_${gamePk || 'all'}_${limit}`
    
    let url = `${this.apiBaseUrl}/game?action=leaderboard&limit=${limit}`
    if (gamePk) {
      url += `&gamePk=${gamePk}`
    }

    try {
      const data = await networkOptimizationService.fetchWithOptimization(
        url,
        {},
        cacheKey,
        60000 // 1 minute cache duration
      )
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch leaderboard')
      }

      return data.leaderboard
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      return {
        entries: [],
        total_users: 0,
        last_updated: new Date().toISOString()
      }
    }
  }
  

  // Subscribe to leaderboard updates using optimized Supabase real-time
  subscribeToLeaderboard(
    gamePk: number | undefined,
    callback: (leaderboard: LeaderboardType) => void
  ) {
    const subscriptionKey = `leaderboard_${gamePk || 'all'}`
    
    // Return existing subscription if available
    if (this.subscriptionCache.has(subscriptionKey)) {
      return this.subscriptionCache.get(subscriptionKey)
    }

    // Use debounced callback to prevent excessive updates
    const debouncedCallback = (() => {
      let timeout: NodeJS.Timeout | null = null
      return () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
          this.getLeaderboard(gamePk).then(callback)
        }, 500) // 500ms debounce
      }
    })()

    const subscription = supabase
      .channel(`leaderboard_updates_${subscriptionKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'at_bat_predictions'
        },
        debouncedCallback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles'
        },
        debouncedCallback
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Leaderboard subscription active for game ${gamePk || 'all'}`)
        }
      })

    // Cache the subscription
    this.subscriptionCache.set(subscriptionKey, subscription)
    
    return subscription
  }

  // Get leaderboard for a specific game
  async getGameLeaderboard(gamePk: number, limit: number = 10): Promise<LeaderboardType> {
    return await this.getLeaderboard(gamePk, limit)
  }

  // Get overall leaderboard (all games)
  async getOverallLeaderboard(limit: number = 10): Promise<LeaderboardType> {
    return await this.getLeaderboard(undefined, limit)
  }

  // Get leaderboard with custom filters
  async getLeaderboardWithFilters(filters: {
    gamePk?: number
    limit?: number
    minPredictions?: number
    minAccuracy?: number
  }): Promise<LeaderboardType> {
    try {
      const params = new URLSearchParams()
      
      if (filters.gamePk) {
        params.append('gamePk', filters.gamePk.toString())
      }
      
      if (filters.limit) {
        params.append('limit', filters.limit.toString())
      }
      
      if (filters.minPredictions) {
        params.append('minPredictions', filters.minPredictions.toString())
      }
      
      if (filters.minAccuracy) {
        params.append('minAccuracy', filters.minAccuracy.toString())
      }

      const url = `${this.apiBaseUrl}/game?action=leaderboard&${params.toString()}`
      console.log('Fetching filtered leaderboard:', url)

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch filtered leaderboard')
      }

      return data.leaderboard
    } catch (error) {
      console.error('Error fetching filtered leaderboard:', error)
      return {
        entries: [],
        total_users: 0,
        last_updated: new Date().toISOString()
      }
    }
  }

  // Get user's rank in leaderboard
  async getUserRank(userId: string, gamePk?: number): Promise<number> {
    try {
      const leaderboard = await this.getLeaderboard(gamePk, 1000) // Get more entries to find user
      
      const userEntry = leaderboard.entries.find(entry => entry.user_id === userId)
      
      return userEntry ? userEntry.rank : -1
    } catch (error) {
      console.error('Error getting user rank:', error)
      return -1
    }
  }

  // Get leaderboard statistics
  async getLeaderboardStats(gamePk?: number): Promise<{
    totalUsers: number
    totalPredictions: number
    averageAccuracy: number
    topAccuracy: number
    totalPoints: number
  }> {
    try {
      const leaderboard = await this.getLeaderboard(gamePk, 1000)
      
      if (leaderboard.entries.length === 0) {
        return {
          totalUsers: 0,
          totalPredictions: 0,
          averageAccuracy: 0,
          topAccuracy: 0,
          totalPoints: 0
        }
      }

      const totalUsers = leaderboard.entries.length
      const totalPredictions = leaderboard.entries.reduce((sum, entry) => sum + entry.total_predictions, 0)
      const totalPoints = leaderboard.entries.reduce((sum, entry) => sum + entry.total_points, 0)
      const averageAccuracy = leaderboard.entries.reduce((sum, entry) => sum + entry.accuracy, 0) / totalUsers
      const topAccuracy = Math.max(...leaderboard.entries.map(entry => entry.accuracy))

      return {
        totalUsers,
        totalPredictions,
        averageAccuracy,
        topAccuracy,
        totalPoints
      }
    } catch (error) {
      console.error('Error getting leaderboard stats:', error)
      return {
        totalUsers: 0,
        totalPredictions: 0,
        averageAccuracy: 0,
        topAccuracy: 0,
        totalPoints: 0
      }
    }
  }

  // Get leaderboard trends (compare with previous period)
  async getLeaderboardTrends(_gamePk?: number, _daysBack: number = 7): Promise<{
    newUsers: number
    activeUsers: number
    accuracyTrend: number
    pointsTrend: number
  }> {
    try {
      // This would require additional API endpoints or database queries
      // For now, return placeholder data
      return {
        newUsers: 0,
        activeUsers: 0,
        accuracyTrend: 0,
        pointsTrend: 0
      }
    } catch (error) {
      console.error('Error getting leaderboard trends:', error)
      return {
        newUsers: 0,
        activeUsers: 0,
        accuracyTrend: 0,
        pointsTrend: 0
      }
    }
  }

  // Refresh leaderboard (force update)
  async refreshLeaderboard(gamePk?: number, limit: number = 10): Promise<LeaderboardType> {
    try {
      let url = `${this.apiBaseUrl}/game?action=leaderboard&limit=${limit}&refresh=true`
      if (gamePk) {
        url += `&gamePk=${gamePk}`
      }

      console.log('Refreshing leaderboard:', url)

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to refresh leaderboard')
      }

      console.log('Successfully refreshed leaderboard')
      return data.leaderboard
    } catch (error) {
      console.error('Error refreshing leaderboard:', error)
      return {
        entries: [],
        total_users: 0,
        last_updated: new Date().toISOString()
      }
    }
  }
}

export const leaderboardServiceNew = new LeaderboardServiceNew()
