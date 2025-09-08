import { supabase } from '../supabaseClient'
import { AtBatPrediction, AtBatOutcome, PredictionStats, getOutcomeCategory, getOutcomePoints } from './types'

export class PredictionServiceNew {
  // Get current user ID
  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id || null
    } catch (error) {
      console.error('Error getting current user ID:', error)
      return null
    }
  }

  // Check if user has already made a prediction for this at-bat
  async hasUserPredictedForAtBat(gamePk: number, atBatIndex: number): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return false
      }

      const response = await fetch(`/api/game/predictions?gamePk=${gamePk}&atBatIndex=${atBatIndex}&userId=${user.id}`)
      
      if (!response.ok) {
        console.error('Error checking existing prediction:', response.statusText)
        return false
      }

      const data = await response.json()
      return data.predictions && data.predictions.length > 0
    } catch (error) {
      console.error('Error checking existing prediction:', error)
      return false
    }
  }

  // Submit a new prediction using the unified API
  async submitPrediction(
    gamePk: number,
    atBatIndex: number,
    prediction: AtBatOutcome,
    predictionCategory?: string
  ): Promise<AtBatPrediction | null> {
    try {
      // Validate inputs
      if (!gamePk || gamePk === null || gamePk === undefined) {
        throw new Error('Invalid gamePk: gamePk is required and cannot be null')
      }
      
      if (!atBatIndex || atBatIndex === null || atBatIndex === undefined) {
        throw new Error('Invalid atBatIndex: atBatIndex is required and cannot be null')
      }

      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Check if user has already made a prediction for this at-bat
      const hasExistingPrediction = await this.hasUserPredictedForAtBat(gamePk, atBatIndex)
      if (hasExistingPrediction) {
        throw new Error('You have already made a prediction for this at-bat. Please wait for the next at-bat.')
      }

      // Get the session token for API authentication
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No valid session found')
      }

      const response = await fetch('/api/game/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          gamePk,
          atBatIndex,
          prediction,
          predictionCategory
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit prediction')
      }

      const data = await response.json()
      return data.prediction
    } catch (error) {
      console.error('Error submitting prediction:', error)
      // Re-throw the error so the UI can handle it properly
      throw error
    }
  }

  // Get predictions for a specific at-bat using the unified API
  async getAtBatPredictions(gamePk: number, atBatIndex: number): Promise<AtBatPrediction[]> {
    try {
      const response = await fetch(`/api/game/predictions?gamePk=${gamePk}&atBatIndex=${atBatIndex}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.predictions || []
    } catch (error) {
      console.error('Error fetching at-bat predictions:', error)
      return []
    }
  }

  // Get user's predictions for a game using the unified API
  async getUserGamePredictions(gamePk: number): Promise<AtBatPrediction[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return []
      }

      const response = await fetch(`/api/game/predictions?gamePk=${gamePk}&userId=${user.id}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.predictions || []
    } catch (error) {
      console.error('Error fetching user predictions:', error)
      return []
    }
  }

  // Get all predictions for a game using the unified API
  async getAllGamePredictions(gamePk: number): Promise<AtBatPrediction[]> {
    try {
      const response = await fetch(`/api/game/predictions?gamePk=${gamePk}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.predictions || []
    } catch (error) {
      console.error('Error fetching all game predictions:', error)
      return []
    }
  }

  // Get predictions for the previous at-bat
  async getPreviousAtBatPredictions(gamePk: number, currentAtBatIndex: number): Promise<AtBatPrediction[]> {
    try {
      const previousAtBatIndex = currentAtBatIndex - 1
      if (previousAtBatIndex < 0) {
        return [] // No previous at-bat
      }
      
      return await this.getAtBatPredictions(gamePk, previousAtBatIndex)
    } catch (error) {
      console.error('Error fetching previous at-bat predictions:', error)
      return []
    }
  }

  // Calculate points for a prediction based on accuracy and streak
  calculatePoints(
    predictedOutcome: AtBatOutcome,
    predictedCategory: string | undefined,
    actualOutcome: AtBatOutcome,
    currentStreak: number = 0
  ): { points: number; isExact: boolean; isCategoryCorrect: boolean; bonusInfo?: string; streakBonus: number } {
    const actualCategory = getOutcomeCategory(actualOutcome)
    
    // Check if exact prediction is correct
    const isExact = predictedOutcome === actualOutcome
    
    // Check if category prediction is correct
    const isCategoryCorrect = predictedCategory === actualCategory
    
    let points = 0
    let bonusInfo = ''
    let streakBonus = 0
    
    if (isExact) {
      // Base points for exact predictions
      const basePoints = this.getBasePointsForOutcome(actualOutcome)
      
      // Apply risk/reward multipliers
      const multiplier = this.getRiskMultiplier(actualOutcome)
      points = Math.round(basePoints * multiplier)
      
      if (multiplier > 1) {
        bonusInfo = `+${Math.round((multiplier - 1) * 100)}% risk bonus`
      }
      
      // Calculate streak bonus for correct predictions
      streakBonus = this.calculateStreakBonus(currentStreak + 1)
      if (streakBonus > 0) {
        bonusInfo += bonusInfo ? `, +${streakBonus} streak bonus` : `+${streakBonus} streak bonus`
      }
    } else if (isCategoryCorrect) {
      // Points for correct category predictions
      points = this.getCategoryPoints(predictedCategory, actualCategory)
      
      // Calculate streak bonus for correct predictions
      streakBonus = this.calculateStreakBonus(currentStreak + 1)
      if (streakBonus > 0) {
        bonusInfo = `+${streakBonus} streak bonus`
      }
    }
    
    return { points, isExact, isCategoryCorrect, bonusInfo, streakBonus }
  }

  // Get base points for each outcome type
  private getBasePointsForOutcome(outcome: AtBatOutcome): number {
    // Use the centralized point calculation from types.ts
    const { base } = getOutcomePoints(outcome)
    return base
  }

  // Get risk multiplier for outcomes (higher risk = higher reward)
  private getRiskMultiplier(outcome: AtBatOutcome): number {
    // Use the centralized multiplier calculation from types.ts
    const { withBonus, base } = getOutcomePoints(outcome)
    return base > 0 ? withBonus / base : 1.0
  }

  // Get points for category predictions
  private getCategoryPoints(predictedCategory: string, actualCategory: string): number {
    if (predictedCategory === actualCategory) {
      switch (actualCategory) {
        case 'hit': return 3        // Hit category (single, double, triple, home run)
        case 'out': return 1        // Out category (field_out, fielders_choice, etc.)
        case 'walk': return 2       // Walk category
        case 'strikeout': return 2  // Strikeout category
        case 'sacrifice': return 2  // Sacrifice category
        case 'error': return 1      // Error category
        case 'hit_by_pitch': return 2 // Hit by pitch category
        case 'baserunning': return 0 // Baserunning events (should not be at-bat outcomes)
        case 'administrative': return 0 // Administrative events (should not be at-bat outcomes)
        case 'unknown': return 0    // Unknown events
        default: return 1
      }
    }
    return 0
  }

  // Calculate streak bonus points
  private calculateStreakBonus(streakCount: number): number {
    if (streakCount < 2) return 0 // No bonus for first correct prediction
    
    // Progressive streak bonuses
    if (streakCount >= 10) return 10 // 10+ streak = 10 bonus points
    if (streakCount >= 7) return 7   // 7+ streak = 7 bonus points
    if (streakCount >= 5) return 5   // 5+ streak = 5 bonus points
    if (streakCount >= 3) return 3   // 3+ streak = 3 bonus points
    return 1 // 2+ streak = 1 bonus point
  }

  // Get current streak for a user
  async getUserCurrentStreak(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('is_correct, created_at')
        .eq('user_id', userId)
        .not('is_correct', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20) // Check last 20 predictions for streak calculation

      if (error) {
        console.error('Error fetching user streak:', error)
        return 0
      }

      if (!data || data.length === 0) return 0

      let streak = 0
      for (const prediction of data) {
        if (prediction.is_correct) {
          streak++
        } else {
          break // Streak ends on first incorrect prediction
        }
      }

      return streak
    } catch (error) {
      console.error('Error calculating user streak:', error)
      return 0
    }
  }

  // Get user's prediction stats
  async getUserPredictionStats(): Promise<PredictionStats> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return {
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0,
          streak: 0,
          bestStreak: 0,
          totalPoints: 0,
          exactPredictions: 0,
          categoryPredictions: 0
        }
      }

      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('is_correct, prediction, actual_outcome')
        .eq('user_id', user.id)
        .not('is_correct', 'is', null)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const predictions = data || []
      const totalPredictions = predictions.length
      const correctPredictions = predictions.filter(p => p.is_correct).length
      const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0
      
      // Calculate points and exact predictions
      // For now, calculate points based on existing data until database schema is updated
      const exactPredictions = predictions.filter(p => p.prediction === p.actual_outcome).length
      const categoryPredictions = correctPredictions - exactPredictions
      const totalPoints = (exactPredictions * 3) + (categoryPredictions * 1)

      // Calculate current streak
      let streak = 0
      let bestStreak = 0
      let currentStreak = 0

      for (const prediction of predictions) {
        if (prediction.is_correct) {
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          if (streak === 0) {
            streak = currentStreak
          }
          currentStreak = 0
        }
      }

      if (streak === 0) {
        streak = currentStreak
      }

      return {
        totalPredictions,
        correctPredictions,
        accuracy,
        streak,
        bestStreak,
        totalPoints,
        exactPredictions,
        categoryPredictions
      }
    } catch (error) {
      console.error('Error fetching prediction stats:', error)
      return {
        totalPredictions: 0,
        correctPredictions: 0,
        accuracy: 0,
        streak: 0,
        bestStreak: 0,
        totalPoints: 0,
        exactPredictions: 0,
        categoryPredictions: 0
      }
    }
  }

  // Subscribe to prediction updates using Supabase real-time
  subscribeToPredictions(
    gamePk: number,
    callback: (predictions: AtBatPrediction[]) => void,
    atBatIndex?: number
  ) {
    const subscription = supabase
      .channel('at_bat_predictions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'at_bat_predictions',
          filter: `game_pk=eq.${gamePk}`
        },
        async (payload) => {
          console.log('Prediction subscription triggered:', payload)
          
          // Add a small delay to ensure database transaction is committed
          await new Promise(resolve => setTimeout(resolve, 100))
          
          try {
            // Get predictions based on whether we want specific at-bat or all predictions
            let predictions: AtBatPrediction[]
            if (atBatIndex !== undefined) {
              predictions = await this.getAtBatPredictions(gamePk, atBatIndex)
            } else {
              predictions = await this.getUserGamePredictions(gamePk)
            }
            console.log('Updated predictions:', predictions.length)
            callback(predictions)
          } catch (error) {
            console.error('Error in prediction subscription callback:', error)
          }
        }
      )
      .subscribe((status) => {
        console.log('Prediction subscription status:', status)
      })

    return subscription
  }

  // Auto-resolve predictions when an at-bat is completed (backward compatibility)
  async autoResolveCompletedAtBats(_gamePk: number, _completedAtBat: any): Promise<void> {
    // This is now handled server-side by the DataSyncService
    // This method is kept for backward compatibility
    console.log('Auto-resolve is now handled server-side by DataSyncService')
  }

  // Auto-resolve ALL completed at-bats for a game (backward compatibility)
  async autoResolveAllCompletedAtBats(_gamePk: number, _game: any): Promise<void> {
    // This is now handled server-side by the DataSyncService
    // This method is kept for backward compatibility
    console.log('Auto-resolve is now handled server-side by DataSyncService')
  }
}

export const predictionServiceNew = new PredictionServiceNew()
