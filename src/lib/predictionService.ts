import { supabase } from '../supabaseClient'
import { AtBatPrediction, AtBatOutcome, PredictionStats, getOutcomeCategory } from './types'

export class PredictionService {
  // Check if user has already made a prediction for this at-bat
  async hasUserPredictedForAtBat(gamePk: number, atBatIndex: number): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return false
      }

      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('game_pk', gamePk)
        .eq('at_bat_index', atBatIndex)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking existing prediction:', error)
        return false
      }

      return !!data // Return true if prediction exists
    } catch (error) {
      console.error('Error checking existing prediction:', error)
      return false
    }
  }

  // Submit a new prediction
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
        console.error('Supabase error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error submitting prediction:', error)
      // Re-throw the error so the UI can handle it properly
      throw error
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
        // Get current streak before this prediction
        const currentStreak = await this.getUserCurrentStreak(prediction.userId)
        
        const { points, isExact, isCategoryCorrect, streakBonus } = this.calculatePoints(
          prediction.prediction,
          prediction.predictionCategory,
          actualOutcome,
          currentStreak
        )
        
        // Calculate new streak count
        const newStreakCount = (isExact || isCategoryCorrect) ? currentStreak + 1 : 0
        
        const { error } = await supabase
          .from('at_bat_predictions')
          .update({
            actual_outcome: actualOutcome,
            actual_category: getOutcomeCategory(actualOutcome),
            is_correct: isExact || isCategoryCorrect,
            points_earned: points + streakBonus,
            streak_count: newStreakCount,
            streak_bonus: streakBonus,
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

  // Get predictions for a specific at-bat
  async getAtBatPredictions(gamePk: number, atBatIndex: number): Promise<AtBatPrediction[]> {
    try {
      const { data, error } = await supabase
        .from('predictions_with_users')
        .select('*')
        .eq('game_pk', gamePk)
        .eq('at_bat_index', atBatIndex)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      // Transform the data to include user information
      const transformedData = (data || []).map(prediction => ({
        id: prediction.id,
        userId: prediction.user_id,
        gamePk: prediction.game_pk,
        atBatIndex: prediction.at_bat_index,
        prediction: prediction.prediction as AtBatOutcome,
        predictionCategory: prediction.prediction_category,
        actualOutcome: prediction.actual_outcome as AtBatOutcome,
        actualCategory: prediction.actual_category,
        isCorrect: prediction.is_correct,
        pointsEarned: prediction.points_earned,
        streakCount: prediction.streak_count || 0,
        streakBonus: prediction.streak_bonus || 0,
        createdAt: prediction.created_at,
        resolvedAt: prediction.resolved_at,
        user: {
          id: prediction.user_id,
          email: prediction.email || '',
          raw_user_meta_data: prediction.raw_user_meta_data || {}
        }
      }))

      return transformedData
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

  // Auto-resolve predictions when an at-bat is completed
  async autoResolveCompletedAtBats(gamePk: number, completedAtBat: any): Promise<void> {
    try {
      if (!completedAtBat || !completedAtBat.result || !completedAtBat.result.type) {
        return
      }

      const atBatIndex = completedAtBat.about?.atBatIndex
      if (atBatIndex === undefined) {
        return
      }

      // Check if this at-bat's predictions are already resolved
      const existingPredictions = await this.getAtBatPredictions(gamePk, atBatIndex)
      const unresolvedPredictions = existingPredictions.filter(p => !p.actualOutcome)
      
      if (unresolvedPredictions.length === 0) {
        return // Already resolved
      }

      // Resolve the predictions
      await this.resolveAtBatPredictions(gamePk, atBatIndex, completedAtBat.result.type)
    } catch (error) {
      console.error('Error auto-resolving at-bat predictions:', error)
    }
  }

  // Subscribe to prediction updates
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
        async () => {
          // Get predictions based on whether we want specific at-bat or all predictions
          let predictions: AtBatPrediction[]
          if (atBatIndex !== undefined) {
            predictions = await this.getAtBatPredictions(gamePk, atBatIndex)
          } else {
            predictions = await this.getUserGamePredictions(gamePk)
          }
          callback(predictions)
        }
      )
      .subscribe()

    return subscription
  }
}

export const predictionService = new PredictionService()

