import { supabase } from '../../supabaseClient'
import { gameDataService } from './GameDataService'
import { gameCacheService } from './GameCacheService'
// import { predictionServiceNew } from '../predictionService'
import { dataSyncService } from './DataSyncService'

export interface CronJobConfig {
  name: string
  schedule: string
  enabled: boolean
  timeout: number
  retryAttempts: number
}

export interface CronJobResult {
  success: boolean
  duration: number
  error?: string
  data?: any
}

export class CronService {
  private jobs: Map<string, CronJobConfig> = new Map()
  private isRunning = false
  private syncInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.initializeDefaultJobs()
  }

  // Initialize default jobs (now event-driven instead of cron-based)
  private initializeDefaultJobs(): void {
    this.jobs.set('game_state_sync', {
      name: 'Game State Sync',
      schedule: 'event-driven', // Triggered by user actions and real-time events
      enabled: true,
      timeout: 30000,
      retryAttempts: 3
    })

    this.jobs.set('prediction_resolution', {
      name: 'Prediction Resolution',
      schedule: 'event-driven', // Triggered by game state changes
      enabled: true,
      timeout: 15000,
      retryAttempts: 2
    })

    this.jobs.set('cache_cleanup', {
      name: 'Cache Cleanup',
      schedule: 'interval-based', // Runs every 10 minutes via setInterval
      enabled: true,
      timeout: 60000,
      retryAttempts: 1
    })

    this.jobs.set('health_check', {
      name: 'Health Check',
      schedule: 'interval-based', // Runs every 5 minutes via setInterval
      enabled: true,
      timeout: 10000,
      retryAttempts: 1
    })
  }

  // Start the cron service (now interval-based instead of cron-based)
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Cron service is already running')
      return
    }

    this.isRunning = true
    console.log('Starting interval-based service...')

    // Start the data sync service
    await dataSyncService.start()

    // Start interval-based jobs
    this.startIntervalBasedJobs()

    console.log('Interval-based service started successfully')
  }

  // Start interval-based jobs
  private startIntervalBasedJobs(): void {
    // Health check every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      if (this.jobs.get('health_check')?.enabled) {
        await this.executeJob('health_check', this.jobs.get('health_check')!)
      }
    }, 5 * 60 * 1000) // 5 minutes

    // Cache cleanup every 10 minutes
    this.syncInterval = setInterval(async () => {
      if (this.jobs.get('cache_cleanup')?.enabled) {
        await this.executeJob('cache_cleanup', this.jobs.get('cache_cleanup')!)
      }
    }, 10 * 60 * 1000) // 10 minutes

    console.log('Interval-based jobs started')
  }

  // Stop the cron service
  stop(): void {
    this.isRunning = false
    
    // Clear intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // Stop the data sync service
    dataSyncService.stop()
    
    console.log('Interval-based service stopped')
  }

  // Start a specific job (removed - using interval-based approach instead)

  // Execute a specific job
  private async executeJob(jobId: string, config: CronJobConfig): Promise<CronJobResult> {
    const startTime = Date.now()
    
    try {
      console.log(`Executing job: ${config.name}`)
      
      let result: any
      switch (jobId) {
        case 'game_state_sync':
          result = await this.executeGameStateSync()
          break
        case 'prediction_resolution':
          result = await this.executePredictionResolution()
          break
        case 'cache_cleanup':
          result = await this.executeCacheCleanup()
          break
        case 'health_check':
          result = await this.executeHealthCheck()
          break
        default:
          throw new Error(`Unknown job: ${jobId}`)
      }

      const duration = Date.now() - startTime
      await this.logJobSuccess(jobId, duration, result)

      return {
        success: true,
        duration,
        data: result
      }
    } catch (error) {
      const duration = Date.now() - startTime
      await this.logJobError(jobId, error as Error)

      return {
        success: false,
        duration,
        error: (error as Error).message
      }
    }
  }

  // Execute game state synchronization
  private async executeGameStateSync(): Promise<any> {
    try {
      // Use the DataSyncService for game state sync
      const result = await dataSyncService.syncGameState()
      
      return {
        success: result.success,
        gamePk: result.gamePk,
        syncType: result.syncType,
        dataSize: result.dataSize,
        duration: result.duration,
        error: result.error
      }
    } catch (error) {
      console.error('Error in game state sync:', error)
      throw error
    }
  }

  // Execute prediction resolution
  private async executePredictionResolution(): Promise<any> {
    try {
      // Get the most recent cached game
      const cachedGame = await gameCacheService.getMostRecentCachedGame()
      
      if (!cachedGame || !cachedGame.is_live) {
        return { message: 'No live game to resolve predictions for' }
      }

      const gamePk = cachedGame.game_pk

      // Use the DataSyncService for prediction resolution
      const result = await dataSyncService.resolvePredictions(gamePk)

      return {
        success: result.success,
        gamePk: result.gamePk,
        predictionsResolved: result.predictionsResolved,
        pointsAwarded: result.pointsAwarded,
        duration: result.duration,
        error: result.error
      }
    } catch (error) {
      console.error('Error in prediction resolution:', error)
      throw error
    }
  }

  // Execute cache cleanup
  private async executeCacheCleanup(): Promise<any> {
    try {
      await gameCacheService.cleanupStaleCache()
      
      // Also run the database cleanup function
      const { data, error } = await supabase.rpc('cleanup_old_cache_entries')
      
      if (error) {
        throw error
      }

      return {
        cleaned: data || 0,
        message: 'Cache cleanup completed'
      }
    } catch (error) {
      console.error('Error in cache cleanup:', error)
      throw error
    }
  }

  // Execute health check
  private async executeHealthCheck(): Promise<any> {
    try {
      const healthData = {
        gameDataService: await this.checkGameDataServiceHealth(),
        gameCacheService: await this.checkGameCacheServiceHealth(),
        database: await this.checkDatabaseHealth()
      }

      // Update system health record
      await this.updateSystemHealth('cron_service', 'healthy', healthData)

      return healthData
    } catch (error) {
      console.error('Error in health check:', error)
      await this.updateSystemHealth('cron_service', 'error', { error: (error as Error).message })
      throw error
    }
  }

  // Check game data service health
  private async checkGameDataServiceHealth(): Promise<any> {
    try {
      const startTime = Date.now()
      await gameDataService.getTodaysMarinersGame()
      const responseTime = Date.now() - startTime

      return {
        status: 'healthy',
        responseTime,
        cacheStats: gameDataService.getCacheStats()
      }
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message
      }
    }
  }

  // Check game cache service health
  private async checkGameCacheServiceHealth(): Promise<any> {
    try {
      const stats = await gameCacheService.getCacheStats()
      return {
        status: 'healthy',
        stats
      }
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message
      }
    }
  }

  // Check database health
  private async checkDatabaseHealth(): Promise<any> {
    try {
      const startTime = Date.now()
      const { error } = await supabase
        .from('system_health')
        .select('id')
        .limit(1)
      
      const responseTime = Date.now() - startTime

      if (error) {
        throw error
      }

      return {
        status: 'healthy',
        responseTime
      }
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message
      }
    }
  }

  // Update system health record
  private async updateSystemHealth(serviceName: string, status: string, metadata: any): Promise<void> {
    try {
      const healthData = {
        service_name: serviceName,
        status,
        metadata,
        last_success: status === 'healthy' ? new Date().toISOString() : null,
        last_error: status === 'error' ? new Date().toISOString() : null
      }

      await supabase
        .from('system_health')
        .insert([healthData])
    } catch (error) {
      console.error('Error updating system health:', error)
    }
  }

  // Log job success
  private async logJobSuccess(jobId: string, duration: number, result: any): Promise<void> {
    try {
      await supabase
        .from('system_health')
        .insert([{
          service_name: `cron_${jobId}`,
          status: 'healthy',
          response_time_ms: duration,
          metadata: { result }
        }])
    } catch (error) {
      console.error('Error logging job success:', error)
    }
  }

  // Log job error
  private async logJobError(jobId: string, error: Error): Promise<void> {
    try {
      await supabase
        .from('system_health')
        .insert([{
          service_name: `cron_${jobId}`,
          status: 'error',
          error_count: 1,
          last_error: new Date().toISOString(),
          metadata: { error: error.message }
        }])
    } catch (logError) {
      console.error('Error logging job error:', logError)
    }
  }

  // Log sync event (removed - not used in current implementation)

  // Parse cron schedule to milliseconds (removed - not used in interval-based approach)

  // Get job status
  getJobStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [jobId, config] of this.jobs) {
      status[jobId] = {
        name: config.name,
        schedule: config.schedule,
        enabled: config.enabled,
        running: this.isRunning
      }
    }
    
    return status
  }

  // Enable/disable a job
  setJobEnabled(jobId: string, enabled: boolean): void {
    const config = this.jobs.get(jobId)
    if (config) {
      config.enabled = enabled
      console.log(`Job ${jobId} ${enabled ? 'enabled' : 'disabled'}`)
    }
  }

  // Manually trigger event-driven jobs
  async triggerGameStateSync(): Promise<CronJobResult> {
    const config = this.jobs.get('game_state_sync')
    if (!config) {
      throw new Error('Game state sync job not found')
    }
    return await this.executeJob('game_state_sync', config)
  }

  async triggerPredictionResolution(): Promise<CronJobResult> {
    const config = this.jobs.get('prediction_resolution')
    if (!config) {
      throw new Error('Prediction resolution job not found')
    }
    return await this.executeJob('prediction_resolution', config)
  }

  // Trigger all event-driven jobs (useful for manual sync)
  async triggerAllEventDrivenJobs(): Promise<{ [key: string]: CronJobResult }> {
    const results: { [key: string]: CronJobResult } = {}
    
    try {
      results.game_state_sync = await this.triggerGameStateSync()
    } catch (error) {
      results.game_state_sync = {
        success: false,
        duration: 0,
        error: (error as Error).message
      }
    }

    try {
      results.prediction_resolution = await this.triggerPredictionResolution()
    } catch (error) {
      results.prediction_resolution = {
        success: false,
        duration: 0,
        error: (error as Error).message
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
        .limit(50)

      if (error) {
        throw error
      }

      const summary = {
        total_services: data.length,
        healthy_services: data.filter(s => s.status === 'healthy').length,
        error_services: data.filter(s => s.status === 'error').length,
        recent_errors: data.filter(s => s.status === 'error').slice(0, 5),
        last_updated: data[0]?.created_at || null
      }

      return summary
    } catch (error) {
      console.error('Error getting system health summary:', error)
      return {
        total_services: 0,
        healthy_services: 0,
        error_services: 0,
        recent_errors: [],
        last_updated: null
      }
    }
  }
}

// Export singleton instance
export const cronService = new CronService()
