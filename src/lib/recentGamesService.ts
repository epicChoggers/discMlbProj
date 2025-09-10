import { RecentGamesResponse } from './types'

export class RecentGamesService {
  private apiBaseUrl: string
  private isDevelopment: boolean

  constructor() {
    // Check if we're in development mode
    this.isDevelopment = import.meta.env.DEV
    // Allow forcing production mode locally for testing
    const forceProduction = import.meta.env.VITE_FORCE_PRODUCTION_MODE === 'true'
    
    if (forceProduction) {
      this.isDevelopment = false
      console.log('🚀 Production mode forced locally for testing')
    }
    
    // Use full URL in production, relative URL in development
    this.apiBaseUrl = this.isDevelopment ? '/api' : `${window.location.origin}/api`
    console.log(`Recent Games Service initialized in ${this.isDevelopment ? 'development' : 'production'} mode with API base: ${this.apiBaseUrl}`)
  }

  // Get recent games from our API
  async getRecentGames(): Promise<RecentGamesResponse> {
    try {
      const url = `${this.apiBaseUrl}/game?action=recent-games`
      console.log('Fetching recent games:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch recent games')
      }

      return data
    } catch (error) {
      console.error('Error fetching recent games:', error)
      return {
        success: false,
        recentGames: [],
        totalGames: 0,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Failed to fetch recent games'
      }
    }
  }
}

export const recentGamesService = new RecentGamesService()
