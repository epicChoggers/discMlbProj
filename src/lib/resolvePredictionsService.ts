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
   * Call the resolve-predictions API endpoint
   */
  async resolvePredictions(): Promise<ResolvePredictionsResponse | null> {
    try {
      console.log('Calling resolve-predictions API...')
      
      const response = await fetch(`${this.baseUrl}/api/resolve-predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(`Resolve-predictions API call failed: ${response.status} ${response.statusText}`)
        return null
      }

      const result: ResolvePredictionsResponse = await response.json()
      console.log('Resolve-predictions API response:', result)
      
      if (result.success && result.resolved > 0) {
        console.log(`Resolved ${result.resolved} predictions via API, ${result.pointsAwarded || 0} points awarded`)
      }
      
      return result
    } catch (error) {
      console.error('Error calling resolve-predictions API:', error)
      return null
    }
  }
}

// Export singleton instance
export const resolvePredictionsService = ResolvePredictionsService.getInstance()
