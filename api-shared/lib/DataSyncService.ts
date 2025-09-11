import { supabase } from './supabase.js'
import { gameDataService } from './gameDataService.js'
import { gameCacheService } from './gameCacheService.js'

export interface SyncResult {
  success: boolean
  gamePk: number
  syncType: string
  dataSize: number
  duration: number
  error?: string
  predictionsResolved?: number
  pointsAwarded?: number
}

export class DataSyncService {
  private isRunning = false
  private syncInterval: NodeJS.Timeout | null = null

  // Start the data synchronization service
  async start(): Promise<void> {
    if (this.isRunning) {
      // console.log('Backend data sync service is already running')
      return
    }

    this.isRunning = true
    // console.log('Starting backend data sync service...')

    // Initial sync
    await this.performFullSync()

    // Set up periodic sync (every 10 seconds to match frontend)
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) return
      
      try {
        await this.performIncrementalSync()
      } catch (error) {
        // console.error('Error in backend periodic sync:', error)
        await this.logSyncError(0, 'incremental', error as Error)
      }
    }, 10000)

    // console.log('Backend data sync service started successfully')
  }

  // Stop the data synchronization service
  stop(): void {
    this.isRunning = false
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    
    // console.log('Backend data sync service stopped')
  }

  // Perform a full synchronization
  async performFullSync(): Promise<SyncResult[]> {
    const results: SyncResult[] = []
    const startTime = Date.now()

    try {
      // console.log('Starting backend full sync...')

      // 1. Sync game state
      const gameStateResult = await this.syncGameState()
      results.push(gameStateResult)

      // 2. If we have a live game, sync at-bats and resolve predictions
      if (gameStateResult.success && gameStateResult.gamePk) {
        const atBatResult = await this.syncAtBats(gameStateResult.gamePk)
        results.push(atBatResult)

        const predictionResult = await this.resolvePredictions(gameStateResult.gamePk)
        results.push(predictionResult)
      }

      // const totalDuration = Date.now() - startTime
      // console.log(`Backend full sync completed in ${totalDuration}ms`)

      return results
    } catch (error) {
      // console.error('Error in backend full sync:', error)
      await this.logSyncError(0, 'full_sync', error as Error)
      throw error
    }
  }

  // Perform incremental synchronization
  async performIncrementalSync(): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    try {
      // Check if we have a live game
      const cachedGame = await gameCacheService.getCachedGameState()
      
      if (!cachedGame || !cachedGame.is_live) {
        // No live game, just sync game state
        const gameStateResult = await this.syncGameState()
        results.push(gameStateResult)
        
        // Note: Removed hardcoded resolve-predictions API call
        // The proper prediction resolution is handled by predictionServiceNew.autoResolveAllCompletedAtBats()
        
        return results
      }

      // We have a live game, perform full sync
      const fullSyncResults = await this.performFullSync()
      
      // Note: Removed hardcoded resolve-predictions API call
      // The proper prediction resolution is handled by predictionServiceNew.autoResolveAllCompletedAtBats()
      
      return fullSyncResults
    } catch (error) {
      // console.error('Error in backend incremental sync:', error)
      await this.logSyncError(0, 'incremental', error as Error)
      return results
    }
  }

  // Sync game state from MLB API to cache
  async syncGameState(): Promise<SyncResult> {
    const startTime = Date.now()
    
    try {
      // console.log('Syncing game state...')

      // Get fresh game data from MLB API
      const game = await gameDataService.getTodaysMarinersGame()
      
      if (!game) {
        const result: SyncResult = {
          success: true,
          gamePk: 0,
          syncType: 'game_state',
          dataSize: 0,
          duration: Date.now() - startTime
        }
        
        await this.logSyncSuccess(0, 'game_state', result)
        return result
      }

      // Create game state
      const gameState = {
        game,
        currentAtBat: gameDataService.getCurrentAtBat(game),
        isLoading: false,
        error: undefined,
        lastUpdated: new Date().toISOString()
      }

      // Cache the game state
      await gameCacheService.cacheGameState(gameState)

      const result: SyncResult = {
        success: true,
        gamePk: game.gamePk,
        syncType: 'game_state',
        dataSize: JSON.stringify(gameState).length,
        duration: Date.now() - startTime
      }

      await this.logSyncSuccess(game.gamePk, 'game_state', result)
      // console.log(`Game state synced for game ${game.gamePk}`)
      
      return result
    } catch (error) {
      const result: SyncResult = {
        success: false,
        gamePk: 0,
        syncType: 'game_state',
        dataSize: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message
      }
      
      await this.logSyncError(0, 'game_state', error as Error)
      return result
    }
  }

  // Sync at-bat data for a specific game
  async syncAtBats(gamePk: number): Promise<SyncResult> {
    const startTime = Date.now()
    
    try {
      // console.log(`Syncing at-bats for game ${gamePk}...`)

      // Get fresh game data
      const game = await gameDataService.getTodaysMarinersGame()
      
      if (!game || !game.liveData?.plays?.allPlays) {
        const result: SyncResult = {
          success: true,
          gamePk,
          syncType: 'at_bats',
          dataSize: 0,
          duration: Date.now() - startTime
        }
        
        await this.logSyncSuccess(gamePk, 'at_bats', result)
        return result
      }

      const { allPlays } = game.liveData.plays
      // let syncedCount = 0

      // Count plays for logging
      // syncedCount = allPlays.length

      const result: SyncResult = {
        success: true,
        gamePk,
        syncType: 'at_bats',
        dataSize: JSON.stringify(allPlays).length,
        duration: Date.now() - startTime
      }

      await this.logSyncSuccess(gamePk, 'at_bats', result)
      // console.log(`Synced ${syncedCount} at-bats for game ${gamePk}`)
      
      return result
    } catch (error) {
      const result: SyncResult = {
        success: false,
        gamePk,
        syncType: 'at_bats',
        dataSize: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message
      }
      
      await this.logSyncError(gamePk, 'at_bats', error as Error)
      return result
    }
  }

  // Resolve predictions for a specific game
  async resolvePredictions(gamePk: number): Promise<SyncResult> {
    const startTime = Date.now()
    
    try {
      console.log(`Resolving predictions for game ${gamePk}...`)

      // Get fresh game data
      const game = await gameDataService.getTodaysMarinersGame()
      
      if (!game) {
        const result: SyncResult = {
          success: true,
          gamePk,
          syncType: 'prediction_resolution',
          dataSize: 0,
          duration: Date.now() - startTime,
          predictionsResolved: 0,
          pointsAwarded: 0
        }
        
        await this.logPredictionResolution(gamePk, 0, 'unknown', 0, 0, Date.now() - startTime)
        return result
      }

      // Import and use the prediction service for resolution
      const { predictionServiceNew } = await import('./predictionService.js')
      
      // Auto-resolve all completed at-bats
      await predictionServiceNew.autoResolveAllCompletedAtBats(gamePk, game)

      // Auto-resolve pitcher predictions if starting pitcher has finished
      await this.resolvePitcherPredictions(gamePk, game)

      // Get statistics about resolved predictions
      const { data: resolvedPredictions } = await supabase
        .from('at_bat_predictions')
        .select('points_earned')
        .eq('game_pk', gamePk)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', new Date(Date.now() - 60000).toISOString()) // Last minute

      const predictionsResolved = resolvedPredictions?.length || 0
      const pointsAwarded = resolvedPredictions?.reduce((sum, p) => sum + (p.points_earned || 0), 0) || 0

      const result: SyncResult = {
        success: true,
        gamePk,
        syncType: 'prediction_resolution',
        dataSize: 0,
        duration: Date.now() - startTime,
        predictionsResolved,
        pointsAwarded
      }

      await this.logPredictionResolution(gamePk, 0, 'batch', predictionsResolved, pointsAwarded, Date.now() - startTime)
      console.log(`Resolved ${predictionsResolved} predictions for game ${gamePk}`)
      
      return result
    } catch (error) {
      const result: SyncResult = {
        success: false,
        gamePk,
        syncType: 'prediction_resolution',
        dataSize: 0,
        duration: Date.now() - startTime,
        error: (error as Error).message,
        predictionsResolved: 0,
        pointsAwarded: 0
      }
      
      await this.logSyncError(gamePk, 'prediction_resolution', error as Error)
      return result
    }
  }

  // Log successful sync
  private async logSyncSuccess(gamePk: number, syncType: string, result: SyncResult): Promise<void> {
    try {
      await supabase
        .from('game_sync_log')
        .insert([{
          game_pk: gamePk,
          sync_type: syncType,
          status: 'success',
          data_size: result.dataSize,
          sync_duration_ms: result.duration
        }])
    } catch (error) {
      // console.error('Error logging sync success:', error)
    }
  }

  // Log sync error
  private async logSyncError(gamePk: number, syncType: string, error: Error): Promise<void> {
    try {
      await supabase
        .from('game_sync_log')
        .insert([{
          game_pk: gamePk,
          sync_type: syncType,
          status: 'error',
          error_message: error.message,
          sync_duration_ms: 0
        }])
    } catch (logError) {
      // console.error('Error logging sync error:', logError)
    }
  }

  // Log prediction resolution
  private async logPredictionResolution(
    gamePk: number,
    atBatIndex: number,
    outcome: string,
    predictionsResolved: number,
    pointsAwarded: number,
    duration: number
  ): Promise<void> {
    try {
      await supabase
        .from('prediction_resolution_log')
        .insert([{
          game_pk: gamePk,
          at_bat_index: atBatIndex,
          outcome,
          predictions_resolved: predictionsResolved,
          points_awarded: pointsAwarded,
          resolution_duration_ms: duration
        }])
    } catch (error) {
      // console.error('Error logging prediction resolution:', error)
    }
  }

  // Resolve pitcher predictions for a specific game
  private async resolvePitcherPredictions(gamePk: number, gameData: any): Promise<void> {
    try {
      // console.log(`Checking pitcher predictions for game ${gamePk}...`)
      
      // Import pitcher services
      const { pitcherStatsService } = await import('./pitcherStatsService.js')
      const { pitcherSubstitutionService } = await import('./pitcherSubstitutionService.js')
      const { pitcherPredictionService } = await import('./pitcherPredictionService.js')

      // Check if we should resolve pitcher predictions
      const shouldResolve = pitcherSubstitutionService.shouldResolveStartingPitcherPredictions(gameData)
      // console.log('Should resolve pitcher predictions:', shouldResolve)
      
      if (!shouldResolve) {
        // console.log('Starting pitcher still pitching or game not final - skipping pitcher prediction resolution')
        return
      }

      // Get Mariners starting pitcher stats
      const startingPitcherStats = pitcherStatsService.getMarinersStartingPitcherStats(gameData)
      
      if (!startingPitcherStats) {
        // console.log('No Mariners starting pitcher stats found')
        return
      }

      // console.log(`Found starting pitcher stats:`, startingPitcherStats)

      // Get all unresolved pitcher predictions for this game and pitcher
      const { data: predictions, error: fetchError } = await supabase
        .from('pitcher_predictions')
        .select('*')
        .eq('game_pk', gamePk)
        .eq('pitcher_id', startingPitcherStats.pitcherId)
        .is('resolved_at', null)

      if (fetchError) {
        // console.error('Error fetching pitcher predictions:', fetchError)
        return
      }

      if (!predictions || predictions.length === 0) {
        // console.log('No unresolved pitcher predictions found')
        return
      }

      // console.log(`Found ${predictions.length} unresolved pitcher predictions`)

      // Resolve each prediction
      for (const prediction of predictions) {
        try {
          // Calculate points using the existing service
          const pointsEarned = pitcherPredictionService.calculatePoints(
            parseFloat(prediction.predicted_ip),
            prediction.predicted_hits,
            prediction.predicted_earned_runs,
            prediction.predicted_walks,
            prediction.predicted_strikeouts,
            startingPitcherStats.ip,
            startingPitcherStats.hits,
            startingPitcherStats.earnedRuns,
            startingPitcherStats.walks,
            startingPitcherStats.strikeouts
          )

          // Update the prediction with actual results
          const { error: updateError } = await supabase
            .from('pitcher_predictions')
            .update({
              actual_ip: startingPitcherStats.ip,
              actual_hits: startingPitcherStats.hits,
              actual_earned_runs: startingPitcherStats.earnedRuns,
              actual_walks: startingPitcherStats.walks,
              actual_strikeouts: startingPitcherStats.strikeouts,
              points_earned: pointsEarned,
              resolved_at: new Date().toISOString()
            })
            .eq('id', prediction.id)

          if (updateError) {
            // console.error(`Error updating pitcher prediction ${prediction.id}:`, updateError)
          } else {
            // console.log(`Resolved pitcher prediction ${prediction.id} with ${pointsEarned} points`)
          }
        } catch (error) {
          // console.error(`Error resolving pitcher prediction ${prediction.id}:`, error)
        }
      }

      // Log pitcher prediction resolution
      await this.logPitcherPredictionResolution(
        gamePk, 
        startingPitcherStats.pitcherId, 
        predictions.length, 
        predictions.reduce((sum, p) => sum + pitcherPredictionService.calculatePoints(
          parseFloat(p.predicted_ip),
          p.predicted_hits,
          p.predicted_earned_runs,
          p.predicted_walks,
          p.predicted_strikeouts,
          startingPitcherStats.ip,
          startingPitcherStats.hits,
          startingPitcherStats.earnedRuns,
          startingPitcherStats.walks,
          startingPitcherStats.strikeouts
        ), 0)
      )

    } catch (error) {
      // console.error('Error in pitcher prediction resolution:', error)
    }
  }

  // Log pitcher prediction resolution
  private async logPitcherPredictionResolution(
    gamePk: number, 
    pitcherId: number, 
    predictionsResolved: number, 
    totalPointsAwarded: number
  ): Promise<void> {
    try {
      await supabase
        .from('prediction_resolution_logs')
        .insert({
          game_pk: gamePk,
          resolution_type: 'pitcher_predictions',
          pitcher_id: pitcherId,
          predictions_resolved: predictionsResolved,
          points_awarded: totalPointsAwarded,
          resolved_at: new Date().toISOString()
        })
    } catch (error) {
      // console.error('Error logging pitcher prediction resolution:', error)
    }
  }

  // Check if service is running
  isServiceRunning(): boolean {
    return this.isRunning
  }

  // Force a sync (useful for testing or manual triggers)
  async forceSync(): Promise<SyncResult[]> {
    // console.log('Force sync triggered')
    return await this.performFullSync()
  }

  // Note: Removed callResolvePredictionsAPI method
  // The hardcoded resolve-predictions API endpoint was overriding proper resolution
  // Now only the proper predictionServiceNew.autoResolveAllCompletedAtBats() is used
}

// Export singleton instance
export const dataSyncService = new DataSyncService()
