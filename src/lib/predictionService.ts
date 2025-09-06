import { supabase } from '../supabaseClient'
import { AtBatPrediction, AtBatOutcome, PredictionStats, getOutcomeCategory } from './types'

export class PredictionService {
  // Submit a new prediction
  async submitPrediction(
    gamePk: number,
    atBatIndex: number,
    prediction: AtBatOutcome,
    predictionCategory?: string
  ): Promise<AtBatPrediction | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Validate required parameters
      if (!gamePk || gamePk === null || gamePk === undefined) {
        console.error('PredictionService: gamePk is null/undefined:', { gamePk, atBatIndex, prediction })
        throw new Error('Game PK is required and cannot be null')
      }

      if (atBatIndex === null || atBatIndex === undefined) {
        console.error('PredictionService: atBatIndex is null/undefined:', { gamePk, atBatIndex, prediction })
        throw new Error('At-bat index is required and cannot be null')
      }

      console.log('PredictionService: Submitting prediction with valid data:', { gamePk, atBatIndex, prediction })

      const finalAtBatIndex = atBatIndex

      const predictionData = {
        user_id: user.id,
        game_pk: gamePk,
        at_bat_index: finalAtBatIndex,
        prediction,
        prediction_category: predictionCategory,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('at_bat_predictions')
        .insert([predictionData])
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Error submitting prediction:', error)
      return null
    }
  }

  // Calculate points for a prediction based on accuracy
  calculatePoints(
    predictedOutcome: AtBatOutcome,
    predictedCategory: string | undefined,
    actualOutcome: AtBatOutcome
  ): { points: number; isExact: boolean; isCategoryCorrect: boolean; bonusInfo?: string } {
    const actualCategory = getOutcomeCategory(actualOutcome)
    
    // Check if exact prediction is correct
    const isExact = predictedOutcome === actualOutcome
    
    // Check if category prediction is correct
    const isCategoryCorrect = predictedCategory === actualCategory
    
    let points = 0
    let bonusInfo = ''
    
    if (isExact) {
      // Base points for exact predictions
      const basePoints = this.getBasePointsForOutcome(actualOutcome)
      
      // Apply risk/reward multipliers
      const multiplier = this.getRiskMultiplier(actualOutcome)
      points = Math.round(basePoints * multiplier)
      
      if (multiplier > 1) {
        bonusInfo = `+${Math.round((multiplier - 1) * 100)}% risk bonus`
      }
    } else if (isCategoryCorrect) {
      // Points for correct category predictions
      points = this.getCategoryPoints(predictedCategory, actualCategory)
    }
    
    return { points, isExact, isCategoryCorrect, bonusInfo }
  }

  // Get base points for each outcome type
  private getBasePointsForOutcome(outcome: AtBatOutcome): number {
    const pointMap: Record<AtBatOutcome, number> = {
      'home_run': 15,    // Rare, high impact
      'triple': 12,       // Very rare
      'double': 8,        // Uncommon
      'single': 4,        // Common
      'walk': 3,          // Common
      'strikeout': 2,     // Very common
      'groundout': 1,     // Most common
      'flyout': 1,        // Most common
      'popout': 1,        // Most common
      'lineout': 1,       // Most common
      'fielders_choice': 1, // Most common
      'hit_by_pitch': 2,  // Uncommon
      'error': 1,         // Most common
      'sacrifice': 1,     // Most common
      'other': 1          // Most common
    }
    
    return pointMap[outcome] || 1
  }

  // Get risk multiplier for outcomes (higher risk = higher reward)
  private getRiskMultiplier(outcome: AtBatOutcome): number {
    const riskMap: Record<AtBatOutcome, number> = {
      'home_run': 1.5,    // +50% bonus for rare outcomes
      'triple': 1.5,      // +50% bonus for rare outcomes
      'double': 1.25,     // +25% bonus for uncommon outcomes
      'single': 1.0,      // No bonus for common outcomes
      'walk': 1.0,        // No bonus for common outcomes
      'strikeout': 1.0,   // No bonus for common outcomes
      'groundout': 1.0,   // No bonus for common outcomes
      'flyout': 1.0,      // No bonus for common outcomes
      'popout': 1.0,      // No bonus for common outcomes
      'lineout': 1.0,     // No bonus for common outcomes
      'fielders_choice': 1.0, // No bonus for common outcomes
      'hit_by_pitch': 1.0, // No bonus for common outcomes
      'error': 1.0,       // No bonus for common outcomes
      'sacrifice': 1.0,   // No bonus for common outcomes
      'other': 1.0        // No bonus for common outcomes
    }
    
    return riskMap[outcome] || 1.0
  }

  // Get points for category predictions
  private getCategoryPoints(predictedCategory: string, actualCategory: string): number {
    if (predictedCategory === actualCategory) {
      switch (actualCategory) {
        case 'hit': return 2      // Hit category (single, double, triple, home run)
        case 'out': return 1      // Out category (groundout, flyout, etc.)
        case 'walk': return 3     // Walk category
        case 'strikeout': return 2 // Strikeout category
        case 'home_run': return 2  // Home run category
        default: return 1
      }
    }
    return 0
  }

  // Resolve predictions for a completed at-bat
  async resolveAtBatPredictions(
    gamePk: number,
    atBatIndex: number,
    actualOutcome: AtBatOutcome
  ): Promise<void> {
    try {
      // Get all predictions for this at-bat
      const predictions = await this.getAtBatPredictions(gamePk, atBatIndex)
      
      // Update each prediction with the actual outcome and points
      for (const prediction of predictions) {
        const { points, isExact, isCategoryCorrect } = this.calculatePoints(
          prediction.prediction,
          prediction.predictionCategory,
          actualOutcome
        )
        
        const { error } = await supabase
          .from('at_bat_predictions')
          .update({
            actual_outcome: actualOutcome,
            actual_category: getOutcomeCategory(actualOutcome),
            is_correct: isExact || isCategoryCorrect,
            points_earned: points,
            resolved_at: new Date().toISOString()
          })
          .eq('id', prediction.id)
        
        if (error) {
          console.error('Error resolving prediction:', error)
        }
      }
    } catch (error) {
      console.error('Error resolving at-bat predictions:', error)
    }
  }

  // Get predictions for a specific at-bat
  async getAtBatPredictions(gamePk: number, atBatIndex: number): Promise<AtBatPrediction[]> {
    try {
      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('*')
        .eq('game_pk', gamePk)
        .eq('at_bat_index', atBatIndex)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error fetching at-bat predictions:', error)
      return []
    }
  }

  // Get user's predictions for a game
  async getUserGamePredictions(gamePk: number): Promise<AtBatPrediction[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return []
      }

      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('*')
        .eq('user_id', user.id)
        .eq('game_pk', gamePk)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error fetching user predictions:', error)
      return []
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

  // Update prediction with actual outcome
  async resolvePrediction(
    predictionId: string,
    actualOutcome: AtBatOutcome
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('at_bat_predictions')
        .update({
          actual_outcome: actualOutcome,
          resolved_at: new Date().toISOString()
        })
        .eq('id', predictionId)

      if (error) {
        throw error
      }

      return true
    } catch (error) {
      console.error('Error resolving prediction:', error)
      return false
    }
  }

  // Subscribe to prediction updates
  subscribeToPredictions(
    gamePk: number,
    callback: (predictions: AtBatPrediction[]) => void
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
        async () => {
          // Get all predictions for the game, not just a specific at-bat
          const predictions = await this.getUserGamePredictions(gamePk)
          callback(predictions)
        }
      )
      .subscribe()

    return subscription
  }
}

export const predictionService = new PredictionService()

