import { supabase } from '../../supabaseClient'
import { GameState } from '../types'

export interface CachedGameState {
  id: string
  game_pk: number
  game_data: any
  current_at_bat: any
  is_live: boolean
  last_updated: string
  created_at: string
  updated_at: string
}


export class GameCacheService {
  private readonly GAME_STATE_TTL = 10000 // 10 seconds for live games
  private readonly STATIC_GAME_STATE_TTL = 300000 // 5 minutes for non-live games

  // Cache game state in database
  async cacheGameState(gameState: GameState): Promise<void> {
    try {
      if (!gameState.game?.gamePk) {
        throw new Error('Game state must have a valid gamePk')
      }

      const cachedData: Partial<CachedGameState> = {
        game_pk: gameState.game.gamePk,
        game_data: gameState.game,
        current_at_bat: gameState.currentAtBat,
        is_live: gameState.game.status?.abstractGameState === 'Live',
        last_updated: gameState.lastUpdated
      }

      // Check if we already have a cached state for this game
      const { data: existing } = await supabase
        .from('cached_game_states')
        .select('id')
        .eq('game_pk', gameState.game.gamePk)
        .single()

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('cached_game_states')
          .update(cachedData)
          .eq('id', existing.id)

        if (error) {
          throw error
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('cached_game_states')
          .insert([cachedData])

        if (error) {
          throw error
        }
      }

      console.log(`Cached game state for game ${gameState.game.gamePk}`)
    } catch (error) {
      console.error('Error caching game state:', error)
      throw error
    }
  }

  // Get cached game state
  async getCachedGameState(gamePk?: number): Promise<GameState | null> {
    try {
      let query = supabase
        .from('cached_game_states')
        .select('*')
        .order('last_updated', { ascending: false })

      if (gamePk) {
        query = query.eq('game_pk', gamePk)
      }

      const { data, error } = await query.limit(1).single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null
        }
        throw error
      }

      if (!data) {
        return null
      }

      // Check if cache is still valid
      const now = new Date().getTime()
      const lastUpdated = new Date(data.last_updated).getTime()
      const ttl = data.is_live ? this.GAME_STATE_TTL : this.STATIC_GAME_STATE_TTL

      if ((now - lastUpdated) > ttl) {
        console.log(`Cached game state for game ${data.game_pk} is stale`)
        return null
      }

      return {
        game: data.game_data,
        currentAtBat: data.current_at_bat,
        isLoading: false,
        error: undefined,
        lastUpdated: data.last_updated
      }
    } catch (error) {
      console.error('Error getting cached game state:', error)
      return null
    }
  }




  // Invalidate cache for a specific game
  async invalidateGameCache(gamePk: number): Promise<void> {
    try {
      // Delete cached game state
      await supabase
        .from('cached_game_states')
        .delete()
        .eq('game_pk', gamePk)


      console.log(`Invalidated cache for game ${gamePk}`)
    } catch (error) {
      console.error('Error invalidating game cache:', error)
      throw error
    }
  }

  // Clean up stale cache entries
  async cleanupStaleCache(): Promise<void> {
    try {
      // const now = new Date().toISOString()

      // Clean up stale game states
      await supabase
        .from('cached_game_states')
        .delete()
        .lt('last_updated', new Date(Date.now() - this.STATIC_GAME_STATE_TTL).toISOString())


      console.log('Cleaned up stale cache entries')
    } catch (error) {
      console.error('Error cleaning up stale cache:', error)
      throw error
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    gameStates: number
    oldestGameState: string | null
    newestGameState: string | null
  }> {
    try {
      const gameStatesResult = await supabase
        .from('cached_game_states')
        .select('last_updated')
        .order('last_updated', { ascending: true })

      const gameStates = gameStatesResult.data || []

      return {
        gameStates: gameStates.length,
        oldestGameState: gameStates.length > 0 ? gameStates[0].last_updated : null,
        newestGameState: gameStates.length > 0 ? gameStates[gameStates.length - 1].last_updated : null
      }
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return {
        gameStates: 0,
        oldestGameState: null,
        newestGameState: null
      }
    }
  }

  // Check if we have fresh data for a game
  async hasFreshGameData(gamePk: number): Promise<boolean> {
    try {
      const gameState = await this.getCachedGameState(gamePk)
      return gameState !== null
    } catch (error) {
      console.error('Error checking fresh game data:', error)
      return false
    }
  }

  // Get the most recent game from cache
  async getMostRecentCachedGame(): Promise<CachedGameState | null> {
    try {
      const { data, error } = await supabase
        .from('cached_game_states')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('Error getting most recent cached game:', error)
      return null
    }
  }
}

// Export singleton instance
export const gameCacheService = new GameCacheService()
