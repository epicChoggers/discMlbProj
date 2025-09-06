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

      // For simulation mode (gamePk 999999), use timestamp-based at-bat index to avoid conflicts
      const finalAtBatIndex = gamePk === 999999 
        ? Math.floor(Date.now() / 1000) // Use timestamp as unique at-bat index for simulation
        : atBatIndex

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
  ): { points: number; isExact: boolean; isCategoryCorrect: boolean } {
    const actualCategory = getOutcomeCategory(actualOutcome)
    
    // Check if exact prediction is correct
    const isExact = predictedOutcome === actualOutcome
    
    // Check if category prediction is correct
    const isCategoryCorrect = predictedCategory === actualCategory
    
    let points = 0
    if (isExact) {
      points = 3 // Exact prediction gets 3 points
    } else if (isCategoryCorrect) {
      points = 1 // Correct category gets 1 point
    }
    
    return { points, isExact, isCategoryCorrect }
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
          bestStreak: 0
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
      const { data, error } = await supabase
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

