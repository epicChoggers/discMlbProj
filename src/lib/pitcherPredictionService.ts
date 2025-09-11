import { supabase } from '../supabaseClient'
import { PitcherPrediction, PitcherPredictionLeaderboard } from './types'

class PitcherPredictionService {
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
    console.log(`Pitcher Prediction Service initialized in ${this.isDevelopment ? 'development' : 'production'} mode with API base: ${this.apiBaseUrl}`)
  }

  // Get pitcher predictions for a game (gamePk is optional - will get today's Mariners game if not provided)
  async getPitcherPredictions(gamePk?: number, pitcherId?: number): Promise<PitcherPrediction[]> {
    try {
      const params = new URLSearchParams()
      if (gamePk) {
        params.append('gamePk', gamePk.toString())
      }
      if (pitcherId) {
        params.append('pitcherId', pitcherId.toString())
      }

      const response = await fetch(`${this.apiBaseUrl}/game?action=pitcher-predictions&${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pitcher predictions')
      }

      return data.predictions || []
    } catch (error) {
      console.error('Error fetching pitcher predictions:', error)
      throw error
    }
  }

  // Get pitcher predictions for a specific user (gamePk is optional - will get today's Mariners game if not provided)
  async getUserPitcherPredictions(gamePk: number | undefined, userId: string): Promise<PitcherPrediction[]> {
    try {
      const params = new URLSearchParams({ userId: userId })
      if (gamePk) {
        params.append('gamePk', gamePk.toString())
      }

      const response = await fetch(`${this.apiBaseUrl}/game?action=pitcher-predictions&${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch user pitcher predictions')
      }

      return data.predictions || []
    } catch (error) {
      console.error('Error fetching user pitcher predictions:', error)
      throw error
    }
  }

  // Submit a pitcher prediction (gamePk is optional - will use today's Mariners game if not provided)
  async submitPitcherPrediction(
    gamePk: number | undefined,
    pitcherId: number,
    pitcherName: string,
    predictedIp: number,
    predictedHits: number,
    predictedEarnedRuns: number,
    predictedWalks: number,
    predictedStrikeouts: number
  ): Promise<PitcherPrediction> {
    try {
      const session = await supabase.auth.getSession()
      
      if (!session.data.session) {
        throw new Error('User not authenticated')
      }

      // If no gamePk provided, get today's Mariners game
      let actualGamePk = gamePk
      if (!actualGamePk) {
        const { game } = await this.getPitcherInfoWithGame()
        actualGamePk = game.gamePk
      }

      const response = await fetch(`${this.apiBaseUrl}/game?action=pitcher-predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          gamePk: actualGamePk,
          pitcherId,
          pitcherName,
          predictedIp,
          predictedHits,
          predictedEarnedRuns,
          predictedWalks,
          predictedStrikeouts
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to submit pitcher prediction')
      }

      return data.prediction
    } catch (error) {
      console.error('Error submitting pitcher prediction:', error)
      throw error
    }
  }

  // Update a pitcher prediction with actual results
  async updatePitcherPrediction(
    predictionId: string,
    actualIp?: number,
    actualHits?: number,
    actualEarnedRuns?: number,
    actualWalks?: number,
    actualStrikeouts?: number,
    pointsEarned?: number
  ): Promise<PitcherPrediction> {
    try {
      const session = await supabase.auth.getSession()
      
      if (!session.data.session) {
        throw new Error('User not authenticated')
      }

      const response = await fetch(`${this.apiBaseUrl}/game?action=pitcher-predictions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          id: predictionId,
          actualIp,
          actualHits,
          actualEarnedRuns,
          actualWalks,
          actualStrikeouts,
          pointsEarned
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update pitcher prediction')
      }

      return data.prediction
    } catch (error) {
      console.error('Error updating pitcher prediction:', error)
      throw error
    }
  }

  // Check if user has already predicted for a pitcher in a game (gamePk is optional - will check today's Mariners game if not provided)
  async hasUserPredictedForPitcher(gamePk: number | undefined, pitcherId: number): Promise<boolean> {
    try {
      const session = await supabase.auth.getSession()
      
      if (!session.data.session) {
        return false
      }

      const predictions = await this.getUserPitcherPredictions(gamePk, session.data.session.user.id)
      return predictions.some(prediction => prediction.pitcherId === pitcherId)
    } catch (error) {
      console.error('Error checking if user has predicted for pitcher:', error)
      return false
    }
  }

  // Get pitcher information for today's Mariners game
  async getPitcherInfo(): Promise<any> {
    try {
      // Use the updated endpoint that doesn't require gamePk parameter
      const url = `${this.apiBaseUrl}/game?action=pitcher-info`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pitcher information')
      }

      return data.pitcher
    } catch (error) {
      console.error('Error fetching pitcher info:', error)
      throw error
    }
  }

  // Get pitcher info with game data for today's Mariners game
  async getPitcherInfoWithGame(): Promise<{ pitcher: any; game: any }> {
    try {
      // Use the updated endpoint that doesn't require gamePk parameter
      const url = `${this.apiBaseUrl}/game?action=pitcher-info`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pitcher information')
      }

      return {
        pitcher: data.pitcher,
        game: data.game
      }
    } catch (error) {
      console.error('Error fetching pitcher info with game:', error)
      throw error
    }
  }

  // Get pitcher prediction leaderboard
  async getPitcherPredictionLeaderboard(): Promise<PitcherPredictionLeaderboard> {
    try {
      const { data, error } = await supabase
        .from('pitcher_prediction_leaderboard')
        .select('*')
        .order('rank', { ascending: true })

      if (error) {
        throw error
      }

      return {
        entries: data || [],
        total_users: data?.length || 0,
        last_updated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error fetching pitcher prediction leaderboard:', error)
      throw error
    }
  }

  // Calculate points for a pitcher prediction using new unified system
  calculatePoints(
    predictedIp: number,
    predictedHits: number,
    predictedEarnedRuns: number,
    predictedWalks: number,
    predictedStrikeouts: number,
    actualIp: number,
    actualHits: number,
    actualEarnedRuns: number,
    actualWalks: number,
    actualStrikeouts: number
  ): number {
    let points = 0

    // Innings pitched scoring (most important - up to 6 points)
    const ipDiff = Math.abs(predictedIp - actualIp)
    if (ipDiff === 0) {
      points += 6  // Exact match
    } else if (ipDiff <= 0.1) {
      points += 4  // Very close
    } else if (ipDiff <= 0.2) {
      points += 2  // Close
    } else if (ipDiff <= 0.5) {
      points += 1  // Partial credit
    }

    // Hits scoring (up to 4 points)
    const hitsDiff = Math.abs(predictedHits - actualHits)
    if (hitsDiff === 0) {
      points += 4  // Exact match
    } else if (hitsDiff === 1) {
      points += 2  // Close
    } else if (hitsDiff === 2) {
      points += 1  // Partial credit
    }

    // Earned runs scoring (up to 4 points)
    const earnedRunsDiff = Math.abs(predictedEarnedRuns - actualEarnedRuns)
    if (earnedRunsDiff === 0) {
      points += 4  // Exact match
    } else if (earnedRunsDiff === 1) {
      points += 2  // Close
    } else if (earnedRunsDiff === 2) {
      points += 1  // Partial credit
    }

    // Walks scoring (up to 3 points)
    const walksDiff = Math.abs(predictedWalks - actualWalks)
    if (walksDiff === 0) {
      points += 3  // Exact match
    } else if (walksDiff === 1) {
      points += 1  // Close
    }

    // Strikeouts scoring (up to 3 points)
    const strikeoutsDiff = Math.abs(predictedStrikeouts - actualStrikeouts)
    if (strikeoutsDiff === 0) {
      points += 3  // Exact match
    } else if (strikeoutsDiff === 1) {
      points += 1  // Close
    }

    return Math.max(0, points) // Ensure non-negative points
  }

  // Subscribe to real-time updates for pitcher predictions (gamePk is optional - will subscribe to today's Mariners game if not provided)
  subscribeToPitcherPredictions(
    gamePk: number | undefined,
    callback: (predictions: PitcherPrediction[]) => void,
    pitcherId?: number
  ) {
    const channelName = gamePk 
      ? `pitcher-predictions-${gamePk}${pitcherId ? `-${pitcherId}` : ''}`
      : `pitcher-predictions-today${pitcherId ? `-${pitcherId}` : ''}`
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pitcher_predictions',
          filter: gamePk 
            ? `game_pk=eq.${gamePk}${pitcherId ? `,pitcher_id=eq.${pitcherId}` : ''}`
            : pitcherId ? `pitcher_id=eq.${pitcherId}` : ''
        },
        async () => {
          try {
            const predictions = await this.getPitcherPredictions(gamePk, pitcherId)
            callback(predictions)
          } catch (error) {
            console.error('Error in pitcher predictions subscription:', error)
          }
        }
      )
      .subscribe()

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel)
      }
    }
  }
}

export const pitcherPredictionService = new PitcherPredictionService()
