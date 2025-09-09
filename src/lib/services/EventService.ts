import { supabase } from '../../supabaseClient'
import { gameCacheService } from './GameCacheService'
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

  // Initialize default event-driven jobs
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

  // Start the event service
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Event service is already running')
      return
    }

    this.isRunning = true
    console.log('Starting event-driven service...')

    // Start the data sync service
    await dataSyncService.start()

    console.log('Event-driven service started successfully')
  }

  // Stop the event service
  stop(): void {
    this.isRunning = false
    console.log('Event service stopped')
  }

  // Get job status
  getJobStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [jobId, config] of this.jobs) {
      status[jobId] = {
        name: config.name,
        enabled: config.enabled,
        isRunning: this.isRunning
      }
    }

    return status
  }

  // Set job enabled state
  setJobEnabled(jobId: string, enabled: boolean): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.enabled = enabled
      console.log(`Job ${jobId} ${enabled ? 'enabled' : 'disabled'}`)
    }
  }

  // Trigger game state sync
  async triggerGameStateSync(): Promise<EventJobResult> {
    const startTime = Date.now()
    
    try {
      console.log('Triggering game state sync...')
      
      if (!this.jobs.get('game_state_sync')?.enabled) {
        throw new Error('Game state sync job is disabled')
      }

      const result = await dataSyncService.syncGameState()
      
      return {
        success: result.success,
        duration: Date.now() - startTime,
        data: result
      }
    } catch (error) {
      console.error('Error in game state sync:', error)
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Trigger prediction resolution
  async triggerPredictionResolution(): Promise<EventJobResult> {
    const startTime = Date.now()
    
    try {
      console.log('Triggering prediction resolution...')
      
      if (!this.jobs.get('prediction_resolution')?.enabled) {
        throw new Error('Prediction resolution job is disabled')
      }

      // Get current game state to find active games
      const gameState = await gameCacheService.getCachedGameState()
      
      if (!gameState?.game?.gamePk) {
        return {
          success: true,
          duration: Date.now() - startTime,
          data: { message: 'No active game found for prediction resolution' }
        }
      }

      const result = await dataSyncService.resolvePredictions(gameState.game.gamePk)
      
      return {
        success: result.success,
        duration: Date.now() - startTime,
        data: result
      }
    } catch (error) {
      console.error('Error in prediction resolution:', error)
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Trigger all event-driven jobs
  async triggerAllEventDrivenJobs(): Promise<Record<string, EventJobResult>> {
    console.log('Triggering all event-driven jobs...')
    
    const results: Record<string, EventJobResult> = {}
    
    // Trigger game state sync first
    results.game_state_sync = await this.triggerGameStateSync()
    
    // If game state sync was successful and we have a game, trigger prediction resolution
    if (results.game_state_sync.success) {
      results.prediction_resolution = await this.triggerPredictionResolution()
    } else {
      results.prediction_resolution = {
        success: false,
        duration: 0,
        error: 'Skipped due to failed game state sync'
      }
    }
    
    return results
  }

  // Get system health summary
  async getSystemHealthSummary(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('system_health')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        throw error
      }

      const services = data || []
      const healthyServices = services.filter(s => s.status === 'healthy').length
      const errorServices = services.filter(s => s.status === 'error').length

      return {
        total_services: services.length,
        healthy_services: healthyServices,
        error_services: errorServices,
        last_updated: services[0]?.created_at || null
      }
    } catch (error) {
      console.error('Error getting system health:', error)
      return {
        total_services: 0,
        healthy_services: 0,
        error_services: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const eventService = new EventService()
