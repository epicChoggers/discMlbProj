import { supabase } from './supabase'

export interface CachedGameData {
  id: string
  game_pk: number
  game_date: string
  data: any
  cached_at: string
  expires_at: string
}

export class MLBCacheService {
  private readonly CACHE_DURATION_HOURS = 1 // Cache for 1 hour
  private readonly CACHE_DURATION_MINUTES = 60 // Cache for 60 minutes for live games

  // Get cached game data
  async getCachedGameData(gamePk: number, gameDate: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('mlb_game_cache')
        .select('*')
        .eq('game_pk', gamePk)
        .eq('game_date', gameDate)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        // If table doesn't exist, return null gracefully
        if (error?.code === 'PGRST116') {
          console.log('[MLBCacheService] Cache table not found, skipping cache')
          return null
        }
        return null
      }

      console.log(`[MLBCacheService] Cache hit for game ${gamePk} on ${gameDate}`)
      return data.data
    } catch (error) {
      console.error('Error fetching cached game data:', error)
      return null
    }
  }

  // Cache game data
  async cacheGameData(gamePk: number, gameDate: string, data: any, isLive: boolean = false): Promise<void> {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + (isLive ? this.CACHE_DURATION_MINUTES : this.CACHE_DURATION_HOURS) * 60 * 1000)

      const cacheEntry = {
        game_pk: gamePk,
        game_date: gameDate,
        data: data,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('mlb_game_cache')
        .upsert(cacheEntry, { 
          onConflict: 'game_pk,game_date',
          ignoreDuplicates: false 
        })

      if (error) {
        // If table doesn't exist, skip caching gracefully
        if (error?.code === 'PGRST116') {
          console.log('[MLBCacheService] Cache table not found, skipping cache write')
          return
        }
        console.error('Error caching game data:', error)
      } else {
        console.log(`[MLBCacheService] Cached game ${gamePk} on ${gameDate}, expires at ${expiresAt.toISOString()}`)
      }
    } catch (error) {
      console.error('Error in cacheGameData:', error)
    }
  }

  // Get cached schedule data
  async getCachedScheduleData(teamId: string, date: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('mlb_schedule_cache')
        .select('*')
        .eq('team_id', teamId)
        .eq('date', date)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        // If table doesn't exist, return null gracefully
        if (error?.code === 'PGRST116') {
          console.log('[MLBCacheService] Schedule cache table not found, skipping cache')
          return null
        }
        return null
      }

      console.log(`[MLBCacheService] Schedule cache hit for team ${teamId} on ${date}`)
      return data.data
    } catch (error) {
      console.error('Error fetching cached schedule data:', error)
      return null
    }
  }

  // Cache schedule data
  async cacheScheduleData(teamId: string, date: string, data: any): Promise<void> {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000)

      const cacheEntry = {
        team_id: teamId,
        date: date,
        data: data,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }

      const { error } = await supabase
        .from('mlb_schedule_cache')
        .upsert(cacheEntry, { 
          onConflict: 'team_id,date',
          ignoreDuplicates: false 
        })

      if (error) {
        // If table doesn't exist, skip caching gracefully
        if (error?.code === 'PGRST116') {
          console.log('[MLBCacheService] Schedule cache table not found, skipping cache write')
          return
        }
        console.error('Error caching schedule data:', error)
      } else {
        console.log(`[MLBCacheService] Cached schedule for team ${teamId} on ${date}, expires at ${expiresAt.toISOString()}`)
      }
    } catch (error) {
      console.error('Error in cacheScheduleData:', error)
    }
  }

  // Clean up expired cache entries
  async cleanupExpiredCache(): Promise<void> {
    try {
      const now = new Date().toISOString()
      
      // Clean up game cache
      const { error: gameError } = await supabase
        .from('mlb_game_cache')
        .delete()
        .lt('expires_at', now)

      // Clean up schedule cache
      const { error: scheduleError } = await supabase
        .from('mlb_schedule_cache')
        .delete()
        .lt('expires_at', now)

      if (gameError) {
        // If table doesn't exist, skip cleanup gracefully
        if (gameError?.code === 'PGRST116') {
          console.log('[MLBCacheService] Game cache table not found, skipping cleanup')
        } else {
          console.error('Error cleaning up game cache:', gameError)
        }
      }
      if (scheduleError) {
        // If table doesn't exist, skip cleanup gracefully
        if (scheduleError?.code === 'PGRST116') {
          console.log('[MLBCacheService] Schedule cache table not found, skipping cleanup')
        } else {
          console.error('Error cleaning up schedule cache:', scheduleError)
        }
      }

      console.log('[MLBCacheService] Cleaned up expired cache entries')
    } catch (error) {
      console.error('Error in cleanupExpiredCache:', error)
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    gameCacheEntries: number
    scheduleCacheEntries: number
    totalCacheSize: number
  }> {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('mlb_game_cache')
        .select('*', { count: 'exact' })

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('mlb_schedule_cache')
        .select('*', { count: 'exact' })

      // If tables don't exist, return zero stats
      if (gameError?.code === 'PGRST116' && scheduleError?.code === 'PGRST116') {
        return {
          gameCacheEntries: 0,
          scheduleCacheEntries: 0,
          totalCacheSize: 0
        }
      }

      return {
        gameCacheEntries: gameData?.length || 0,
        scheduleCacheEntries: scheduleData?.length || 0,
        totalCacheSize: (gameData?.length || 0) + (scheduleData?.length || 0)
      }
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return {
        gameCacheEntries: 0,
        scheduleCacheEntries: 0,
        totalCacheSize: 0
      }
    }
  }
}

export const mlbCacheService = new MLBCacheService()
