/**
 * Service for calling the resolve-predictions API endpoint
 */

export interface ResolvePredictionsResponse {
  success: boolean
  message: string
  resolved: number
  pointsAwarded: number
}

export class ResolvePredictionsService {
  private static instance: ResolvePredictionsService
  private baseUrl: string
  private lastCallTime = 0
  private readonly MIN_INTERVAL = 2000 // Minimum 2 seconds between calls
  private pendingCall: Promise<ResolvePredictionsResponse | null> | null = null

  constructor() {
    this.baseUrl = 'https://www.choggers.com'
  }

  static getInstance(): ResolvePredictionsService {
    if (!ResolvePredictionsService.instance) {
      ResolvePredictionsService.instance = new ResolvePredictionsService()
    }
    return ResolvePredictionsService.instance
  }

  /**
   * Call the resolve-predictions API endpoint with throttling and deduplication
   */
  async resolvePredictions(): Promise<ResolvePredictionsResponse | null> {
    const now = Date.now()
    
    // If there's a pending call, return it instead of making a new one
    if (this.pendingCall) {
      return this.pendingCall
    }
    
    // Throttle calls to prevent excessive API usage
    if (now - this.lastCallTime < this.MIN_INTERVAL) {
      return null
    }
    
    this.lastCallTime = now
    
    this.pendingCall = this.performResolveCall()
    
    try {
      const result = await this.pendingCall
      return result
    } finally {
      this.pendingCall = null
    }
  }
  
  private async performResolveCall(): Promise<ResolvePredictionsResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/game?action=resolve-predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      const result: ResolvePredictionsResponse = await response.json()
      
      if (result.success && result.resolved > 0) {
        console.log(`Resolved ${result.resolved} predictions, ${result.pointsAwarded || 0} points awarded`)
      }
      
      return result
    } catch (error) {
      return null
    }
  }
}

// Export singleton instance
export const resolvePredictionsService = ResolvePredictionsService.getInstance()
