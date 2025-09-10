/**
 * Centralized performance optimization service
 * Manages API call throttling, caching, and resource optimization
 */

export interface PerformanceConfig {
  leaderboardCacheDuration: number
  predictionResolutionThrottle: number
  realtimeEventDebounce: number
  maxConcurrentRequests: number
}

export class PerformanceOptimizationService {
  private static instance: PerformanceOptimizationService
  private config: PerformanceConfig
  private requestQueue: Map<string, Promise<any>> = new Map()
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private activeRequests = 0
  private readonly MAX_CONCURRENT_REQUESTS = 5

  constructor() {
    this.config = {
      leaderboardCacheDuration: 5000, // 5 seconds
      predictionResolutionThrottle: 2000, // 2 seconds
      realtimeEventDebounce: 1000, // 1 second
      maxConcurrentRequests: 5
    }
  }

  static getInstance(): PerformanceOptimizationService {
    if (!PerformanceOptimizationService.instance) {
      PerformanceOptimizationService.instance = new PerformanceOptimizationService()
    }
    return PerformanceOptimizationService.instance
  }

  /**
   * Throttle API calls to prevent excessive requests
   */
  async throttleRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    throttleMs: number = 1000
  ): Promise<T> {
    const now = Date.now()
    const lastCall = this.getLastCallTime(key)
    
    if (now - lastCall < throttleMs) {
      // Return cached result if available
      const cached = this.getCached(key)
      if (cached) {
        return cached
      }
      
      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, throttleMs - (now - lastCall)))
    }
    
    this.setLastCallTime(key, now)
    return requestFn()
  }

  /**
   * Deduplicate identical requests
   */
  async deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key)!
    }

    const promise = requestFn().finally(() => {
      this.requestQueue.delete(key)
    })

    this.requestQueue.set(key, promise)
    return promise
  }

  /**
   * Cache data with TTL
   */
  setCache(key: string, data: any, ttl: number = 5000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Get cached data if not expired
   */
  getCached(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.size,
      config: this.config
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  private lastCallTimes = new Map<string, number>()
  
  private getLastCallTime(key: string): number {
    return this.lastCallTimes.get(key) || 0
  }
  
  private setLastCallTime(key: string, time: number): void {
    this.lastCallTimes.set(key, time)
  }
}

export const performanceService = PerformanceOptimizationService.getInstance()

// Auto-cleanup expired cache every 30 seconds
setInterval(() => {
  performanceService.clearExpiredCache()
}, 30000)
