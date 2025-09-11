import { debounce } from '../utils/debounce'

export interface PerformanceMetrics {
  apiCalls: number
  renderCount: number
  memoryUsage: number
  lastUpdate: Date
}

export class PerformanceOptimizationService {
  private metrics: PerformanceMetrics = {
    apiCalls: 0,
    renderCount: 0,
    memoryUsage: 0,
    lastUpdate: new Date()
  }
  
  private apiCallCache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_DURATION = 2000 // 2 seconds
  private readonly MAX_CACHE_SIZE = 100
  
  // Debounced functions for common operations
  public debouncedApiCall = debounce(async (url: string, options?: RequestInit) => {
    return this.makeApiCall(url, options)
  }, 300)
  
  public debouncedStateUpdate = debounce((callback: () => void) => {
    callback()
    this.incrementRenderCount()
  }, 100)
  
  // Optimized API call with caching
  async makeApiCall(url: string, options?: RequestInit): Promise<any> {
    const cacheKey = `${url}_${JSON.stringify(options || {})}`
    
    // Check cache first
    const cached = this.apiCallCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    
    try {
      this.incrementApiCalls()
      const response = await fetch(url, options)
      const data = await response.json()
      
      // Cache the result
      this.cacheResult(cacheKey, data)
      
      return data
    } catch (error) {
      console.error('API call failed:', error)
      throw error
    }
  }
  
  // Cache management
  private cacheResult(key: string, data: any): void {
    // Prevent cache overflow
    if (this.apiCallCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.apiCallCache.keys().next().value
      if (oldestKey) {
        this.apiCallCache.delete(oldestKey)
      }
    }
    
    this.apiCallCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }
  
  // Clear cache
  clearCache(): void {
    this.apiCallCache.clear()
  }
  
  // Metrics tracking
  incrementApiCalls(): void {
    this.metrics.apiCalls++
    this.metrics.lastUpdate = new Date()
  }
  
  incrementRenderCount(): void {
    this.metrics.renderCount++
    this.metrics.lastUpdate = new Date()
  }
  
  updateMemoryUsage(): void {
    if ('memory' in performance) {
      this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize
    }
  }
  
  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage()
    return { ...this.metrics }
  }
  
  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      apiCalls: 0,
      renderCount: 0,
      memoryUsage: 0,
      lastUpdate: new Date()
    }
  }
  
  // Optimize component updates
  optimizeComponentUpdate<T>(
    state: T,
    setState: (newState: T) => void
  ): void {
    this.debouncedStateUpdate(() => {
      setState(state)
    })
  }
  
  // Batch multiple state updates
  batchStateUpdates(updates: (() => void)[]): void {
    this.debouncedStateUpdate(() => {
      updates.forEach(update => update())
    })
  }
  
  // Monitor performance
  startPerformanceMonitoring(): () => void {
    const interval = setInterval(() => {
      this.updateMemoryUsage()
      
      // Log performance warnings
      if (this.metrics.apiCalls > 100) {
        console.warn('High API call count detected:', this.metrics.apiCalls)
      }
      
      if (this.metrics.renderCount > 1000) {
        console.warn('High render count detected:', this.metrics.renderCount)
      }
      
      if (this.metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
        console.warn('High memory usage detected:', this.metrics.memoryUsage)
      }
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }
}

export const performanceOptimizationService = new PerformanceOptimizationService()