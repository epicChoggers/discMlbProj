import { supabase } from './supabase.js'
import { gameCacheService } from './gameCacheService.js'
import { gameDataService } from './gameDataService.js'
import { dataSyncService } from './DataSyncService'

export interface EventJobConfig {
  name: string
  enabled: boolean
  timeout: number
  retryAttempts: number
}

export interface EventJobResult {
  success: boolean
  duration: number
  error?: string
  data?: any
}

export class EventService {
  private jobs: Map<string, EventJobConfig> = new Map()
  private isRunning = false

  constructor() {
    this.initializeDefaultJobs()
  }

  private initializeDefaultJobs(): void {
    this.jobs.set('game_state_sync', {
      name: 'Game State Sync',
      enabled: true,
      timeout: 30000,
      retryAttempts: 3
    })

    this.jobs.set('prediction_resolution', {
      name: 'Prediction Resolution',
      enabled: true,
      timeout: 15000,
      retryAttempts: 2
    })
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    
    // Start the data sync service for automatic prediction resolution
    await dataSyncService.start()
  }

  stop(): void {
    this.isRunning = false
    
    // Stop the data sync service
    dataSyncService.stop()
  }

  getJobStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    for (const [jobId, config] of this.jobs) {
      status[jobId] = { name: config.name, enabled: config.enabled, isRunning: this.isRunning }
    }
    return status
  }

  setJobEnabled(jobId: string, enabled: boolean): void {
    const job = this.jobs.get(jobId)
    if (job) job.enabled = enabled
  }

  async triggerGameStateSync(): Promise<EventJobResult> {
    const start = Date.now()
    try {
      const game = await gameDataService.getTodaysMarinersGame()
      if (game) {
        const gameState = {
          game,
          currentAtBat: gameDataService.getCurrentAtBat(game),
          isLoading: false,
          lastUpdated: new Date().toISOString()
        }
        await gameCacheService.cacheGameState(gameState)
      }
      return { success: true, duration: Date.now() - start, data: { gamePk: game?.gamePk || 0 } }
    } catch (error) {
      return { success: false, duration: Date.now() - start, error: (error as Error).message }
    }
  }

  async triggerPredictionResolution(): Promise<EventJobResult> {
    const start = Date.now()
    try {
      // console.log('Server-side prediction resolution triggered...')
      
      // Get current game state
      const gameState = await gameCacheService.getCachedGameState()
      if (!gameState?.game?.gamePk) {
        return { 
          success: true, 
          duration: Date.now() - start, 
          data: { message: 'No active game found for prediction resolution' } 
        }
      }

      // Use the data sync service for resolution
      const result = await dataSyncService.resolvePredictions(gameState.game.gamePk)
      
      // console.log(`Server-side resolution completed: ${result.predictionsResolved} predictions resolved, ${result.pointsAwarded} points awarded`)
      
      return { 
        success: result.success, 
        duration: Date.now() - start, 
        data: result 
      }
    } catch (error) {
      // console.error('Error in server-side prediction resolution:', error)
      return { 
        success: false, 
        duration: Date.now() - start, 
        error: (error as Error).message 
      }
    }
  }


  async triggerAllEventDrivenJobs(): Promise<Record<string, EventJobResult>> {
    const results: Record<string, EventJobResult> = {}
    results.game_state_sync = await this.triggerGameStateSync()
    results.prediction_resolution = await this.triggerPredictionResolution()
    return results
  }

  async getSystemHealthSummary(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('system_health')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      const services = data || []
      const healthy = services.filter(s => s.status === 'healthy').length
      const errored = services.filter(s => s.status === 'error').length

      return {
        total_services: services.length,
        healthy_services: healthy,
        error_services: errored,
        last_updated: services[0]?.created_at || null
      }
    } catch (error) {
      return {
        total_services: 0,
        healthy_services: 0,
        error_services: 0,
        error: (error as Error).message
      }
    }
  }
}

export const eventService = new EventService()


