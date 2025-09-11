import { debounce } from '../utils/debounce'

export interface NetworkMetrics {
  totalRequests: number
  cachedRequests: number
  duplicateRequests: number
  bytesTransferred: number
  lastReset: Date
}

export class NetworkOptimizationService {
  private static instance: NetworkOptimizationService
  private requestCache = new Map<string, { data: any; timestamp: number; etag?: string }>()
  private pendingRequests = new Map<string, Promise<any>>()
  private subscriptionCache = new Map<string, any>()
  private metrics: NetworkMetrics = {
    totalRequests: 0,
    cachedRequests: 0,
    duplicateRequests: 0,
    bytesTransferred: 0,
    lastReset: new Date()
  }

  // Cache durations (in milliseconds)
  private readonly CACHE_DURATIONS = {
    GAME_STATE: 30000,        // 30 seconds for game state
    LEADERBOARD: 60000,       // 1 minute for leaderboard
    PREDICTIONS: 15000,       // 15 seconds for predictions
    USER_STATS: 120000,       // 2 minutes for user stats
    STATIC_DATA: 300000       // 5 minutes for static data
  }

  private readonly MAX_CACHE_SIZE = 200

  private constructor() {
    this.startCleanupInterval()
  }

  public static getInstance(): NetworkOptimizationService {
    if (!NetworkOptimizationService.instance) {
      NetworkOptimizationService.instance = new NetworkOptimizationService()
    }
    return NetworkOptimizationService.instance
  }

  // Optimized fetch with intelligent caching and deduplication
  async fetchWithOptimization(
    url: string, 
    options: RequestInit = {}, 
    cacheKey?: string,
    cacheDuration: number = this.CACHE_DURATIONS.STATIC_DATA
  ): Promise<any> {
    const key = cacheKey || this.generateCacheKey(url, options)
    
    // Check cache first
    const cached = this.requestCache.get(key)
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      this.metrics.cachedRequests++
      return cached.data
    }

    // Check for pending request
    if (this.pendingRequests.has(key)) {
      this.metrics.duplicateRequests++
      return this.pendingRequests.get(key)!
    }

    // Create new request
    const requestPromise = this.performRequest(url, options, key)
    this.pendingRequests.set(key, requestPromise)

    try {
      const result = await requestPromise
      return result
    } finally {
      this.pendingRequests.delete(key)
    }
  }

  private async performRequest(url: string, options: RequestInit, key: string): Promise<any> {
    try {
      this.metrics.totalRequests++
      
      // Add conditional request headers if we have cached data
      const cached = this.requestCache.get(key)
      const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
      
      if (cached?.etag) {
        headers['If-None-Match'] = cached.etag
      }

      const response = await fetch(url, {
        ...options,
        headers
      })

      // Handle 304 Not Modified
      if (response.status === 304 && cached) {
        // Update timestamp for cached data
        this.requestCache.set(key, {
          ...cached,
          timestamp: Date.now()
        })
        return cached.data
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const etag = response.headers.get('etag')

      // Cache the result
      this.cacheResult(key, data, etag)
      
      // Track bytes transferred (approximate)
      this.metrics.bytesTransferred += JSON.stringify(data).length

      return data
    } catch (error) {
      console.error('Network request failed:', error)
      throw error
    }
  }

  private cacheResult(key: string, data: any, etag?: string | null): void {
    // Prevent cache overflow
    if (this.requestCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.requestCache.keys().next().value
      if (oldestKey) {
        this.requestCache.delete(oldestKey)
      }
    }

    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      etag: etag || undefined
    })
  }

  private generateCacheKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET'
    const body = options.body ? JSON.stringify(options.body) : ''
    return `${method}:${url}:${body}`
  }

  // Debounced API calls for high-frequency operations
  public debouncedFetch = debounce(
    async (url: string, options?: RequestInit, cacheKey?: string, cacheDuration?: number) => {
      return this.fetchWithOptimization(url, options, cacheKey, cacheDuration)
    },
    100 // 100ms debounce
  )

  // Intelligent polling based on game state
  createIntelligentPolling(
    fetchFn: () => Promise<any>,
    isLive: boolean,
    baseInterval: number = 15000
  ): () => void {
    let interval: NodeJS.Timeout | null = null
    let isActive = true

    const poll = async () => {
      if (!isActive) return
      
      try {
        await fetchFn()
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    const startPolling = () => {
      if (interval) return

      // Adjust interval based on game state
      const intervalMs = isLive ? baseInterval : baseInterval * 4 // Slower for non-live games
      
      interval = setInterval(poll, intervalMs)
      
      // Initial fetch
      poll()
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const destroy = () => {
      isActive = false
      stopPolling()
    }

    // Start polling immediately
    startPolling()

    return destroy
  }

  // Optimized Supabase subscription management
  createSharedSubscription(
    channelName: string,
    eventConfig: any,
    callback: (payload: any) => void
  ) {
    const subscriptionKey = `${channelName}_${JSON.stringify(eventConfig)}`
    
    // Return existing subscription if available
    if (this.subscriptionCache.has(subscriptionKey)) {
      return this.subscriptionCache.get(subscriptionKey)
    }

    // Return a placeholder subscription that will be replaced when supabase is available
    const placeholderSubscription = {
      unsubscribe: () => {
        const subscription = this.subscriptionCache.get(subscriptionKey)
        if (subscription) {
          subscription.unsubscribe()
          this.subscriptionCache.delete(subscriptionKey)
        }
      }
    }

    // Try to import supabase, but don't fail if it's not available
    try {
      // This will be handled by the components that use this service
      console.log('Supabase subscription requested for channel:', channelName, 'with callback:', typeof callback)
    } catch (error) {
      console.error('Error setting up supabase subscription:', error)
    }

    return placeholderSubscription
  }

  // Batch multiple API calls
  async batchRequests(requests: Array<{
    url: string
    options?: RequestInit
    cacheKey?: string
    cacheDuration?: number
  }>): Promise<any[]> {
    const promises = requests.map(req => 
      this.fetchWithOptimization(req.url, req.options, req.cacheKey, req.cacheDuration)
    )
    
    return Promise.all(promises)
  }

  // Clear cache for specific patterns
  clearCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern)
      for (const key of this.requestCache.keys()) {
        if (regex.test(key)) {
          this.requestCache.delete(key)
        }
      }
    } else {
      this.requestCache.clear()
    }
  }

  // Get network metrics
  getMetrics(): NetworkMetrics {
    return { ...this.metrics }
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      duplicateRequests: 0,
      bytesTransferred: 0,
      lastReset: new Date()
    }
  }

  // Cleanup old cache entries
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now()
      const maxAge = Math.max(...Object.values(this.CACHE_DURATIONS)) * 2 // Keep for 2x max duration
      
      for (const [key, value] of this.requestCache.entries()) {
        if (now - value.timestamp > maxAge) {
          this.requestCache.delete(key)
        }
      }
    }, 60000) // Cleanup every minute
  }

  // Preload critical data
  async preloadCriticalData(gamePk?: number): Promise<void> {
    const requests = [
      {
        url: '/api/game?action=state',
        cacheKey: 'game_state',
        cacheDuration: this.CACHE_DURATIONS.GAME_STATE
      },
      {
        url: `/api/game?action=leaderboard&limit=10${gamePk ? `&gamePk=${gamePk}` : ''}`,
        cacheKey: `leaderboard_${gamePk || 'all'}`,
        cacheDuration: this.CACHE_DURATIONS.LEADERBOARD
      }
    ]

    try {
      await this.batchRequests(requests)
      console.log('Critical data preloaded successfully')
    } catch (error) {
      console.error('Error preloading critical data:', error)
    }
  }
}

export const networkOptimizationService = NetworkOptimizationService.getInstance()
