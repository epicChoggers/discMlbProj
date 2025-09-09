import { supabase } from './supabase'

export class GameCacheService {
  private readonly GAME_STATE_TTL = 10000 // 10 seconds for live games
  private readonly STATIC_GAME_STATE_TTL = 300000 // 5 minutes for non-live games

  // Cache game state in database
  async cacheGameState(gameState: any): Promise<void> {
    try {
      if (!gameState.game) {
        console.log('No game data to cache')
        return
      }

      const cacheData = {
        game_pk: gameState.game.gamePk,
        game_data: gameState.game,
        current_at_bat: gameState.currentAtBat,
        is_live: gameState.game.status?.detailedState === 'In Progress',
        last_updated: new Date().toISOString()
      }

      // Upsert the cached game state
      const { error } = await supabase
        .from('cached_game_states')
        .upsert(cacheData, { 
          onConflict: 'game_pk',
          ignoreDuplicates: false 
        })

      if (error) {
        throw error
      }

      console.log(`Cached game state for game ${gameState.game.gamePk}`)
    } catch (error) {
      console.error('Error caching game state:', error)
      throw error
    }
  }

  // Get cached game state
  async getCachedGameState(gamePk?: number): Promise<any | null> {
    try {
      let query = supabase
        .from('cached_game_states')
        .select('*')
        .order('last_updated', { ascending: false })

      if (gamePk) {
        query = query.eq('game_pk', gamePk)
      }

      const { data, error } = await query.limit(1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        return null
      }

      const cachedState = data[0]
      const now = new Date()
      const lastUpdated = new Date(cachedState.last_updated)
      const ttl = cachedState.is_live ? this.GAME_STATE_TTL : this.STATIC_GAME_STATE_TTL
      const isStale = (now.getTime() - lastUpdated.getTime()) > ttl

      if (isStale) {
        console.log(`Cached game state for game ${cachedState.game_pk} is stale`)
        return null
      }

      return {
        game: cachedState.game_data,
        currentAtBat: cachedState.current_at_bat,
        isLoading: false,
        lastUpdated: cachedState.last_updated
      }
    } catch (error) {
      console.error('Error getting cached game state:', error)
      return null
    }
  }

  // Cache at-bat data
  async cacheAtBat(gamePk: number, atBatIndex: number, atBatData: any): Promise<void> {
    try {
      const cachedData = {
        game_pk: gamePk,
        at_bat_index: atBatIndex,
        at_bat_data: atBatData,
        outcome: atBatData.result?.type || null,
        is_resolved: !!(atBatData.result?.type && atBatData.result.type !== 'at_bat')
      }

      // Check if we already have this at-bat cached
      const { data: existing } = await supabase
        .from('cached_at_bats')
        .select('id')
        .eq('game_pk', gamePk)
        .eq('at_bat_index', atBatIndex)
        .single()

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('cached_at_bats')
          .update(cachedData)
          .eq('id', existing.id)

        if (error) {
          throw error
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('cached_at_bats')
          .insert([cachedData])

        if (error) {
          throw error
        }
      }

      console.log(`Cached at-bat ${atBatIndex} for game ${gamePk}`)
    } catch (error) {
      console.error('Error caching at-bat:', error)
      throw error
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('cached_game_states')
        .select('*')

      if (error) {
        throw error
      }

      const now = new Date()
      const stats = {
        total_entries: data.length,
        live_games: data.filter(d => d.is_live).length,
        stale_entries: data.filter(d => {
          const lastUpdated = new Date(d.last_updated)
          const ttl = d.is_live ? this.GAME_STATE_TTL : this.STATIC_GAME_STATE_TTL
          return (now.getTime() - lastUpdated.getTime()) > ttl
        }).length,
        last_cleanup: new Date().toISOString()
      }

      return stats
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return {
        total_entries: 0,
        live_games: 0,
        stale_entries: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const gameCacheService = new GameCacheService()
