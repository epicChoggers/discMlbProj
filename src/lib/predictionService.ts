import { supabase } from '../supabaseClient'
import { AtBatPrediction, AtBatOutcome, PredictionStats, getOutcomeCategory } from './types'

export class PredictionService {
  // Cache to track resolved at-bats per game to avoid redundant checks
  private resolvedAtBatsCache = new Map<number, Set<number>>()

  // Helper method to check if an at-bat is already resolved
  private isAtBatResolved(gamePk: number, atBatIndex: number): boolean {
    const gameResolvedAtBats = this.resolvedAtBatsCache.get(gamePk)
    return gameResolvedAtBats?.has(atBatIndex) || false
  }

  // Helper method to mark an at-bat as resolved
  private markAtBatResolved(gamePk: number, atBatIndex: number): void {
    if (!this.resolvedAtBatsCache.has(gamePk)) {
      this.resolvedAtBatsCache.set(gamePk, new Set())
    }
    this.resolvedAtBatsCache.get(gamePk)!.add(atBatIndex)
  }


  // Initialize cache with already resolved at-bats for a game
  private async initializeResolvedAtBatsCache(gamePk: number): Promise<void> {
    try {
      // Get all predictions for this game that are already resolved
      const { data: resolvedPredictions, error } = await supabase
        .from('at_bat_predictions')
        .select('at_bat_index')
        .eq('game_pk', gamePk)
        .not('actual_outcome', 'is', null)
        .not('resolved_at', 'is', null)

      if (error) {
        console.error('Error initializing resolved at-bats cache:', error)
        return
      }

      // Extract unique at-bat indices that are already resolved
      const resolvedAtBatIndices = new Set(
        resolvedPredictions?.map(p => p.at_bat_index) || []
      )

      // Initialize cache for this game
      this.resolvedAtBatsCache.set(gamePk, resolvedAtBatIndices)
      
      console.log(`Initialized cache for game ${gamePk} with ${resolvedAtBatIndices.size} resolved at-bats`)
    } catch (error) {
      console.error('Error initializing resolved at-bats cache:', error)
    }
  }

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

      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('game_pk', gamePk)
        .eq('at_bat_index', atBatIndex)
        .maybeSingle() // Use maybeSingle() instead of single() to handle no results gracefully

      if (error) {
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
      console.log(`Starting resolution for at-bat ${atBatIndex} with outcome: ${actualOutcome}`)
      
      // Get all predictions for this at-bat
      const predictions = await this.getAtBatPredictions(gamePk, atBatIndex)
      console.log(`Found ${predictions.length} predictions to resolve for at-bat ${atBatIndex}`)
      
      // Update each prediction with the actual outcome and points
      for (const prediction of predictions) {
        console.log(`Resolving prediction ${prediction.id} for user ${prediction.userId}`)
        console.log(`Prediction: ${prediction.prediction}, Category: ${prediction.predictionCategory}`)
        
        // Get current streak before this prediction
        const currentStreak = await this.getUserCurrentStreak(prediction.userId)
        console.log(`Current streak for user ${prediction.userId}: ${currentStreak}`)
        
        const { points, isExact, isCategoryCorrect, streakBonus } = this.calculatePoints(
          prediction.prediction,
          prediction.predictionCategory,
          actualOutcome,
          currentStreak
        )
        
        console.log(`Points calculation: ${points} base, ${streakBonus} streak bonus, exact: ${isExact}, category: ${isCategoryCorrect}`)
        
        // Calculate new streak count
        const newStreakCount = (isExact || isCategoryCorrect) ? currentStreak + 1 : 0
        
        const updateData = {
          actual_outcome: actualOutcome,
          actual_category: getOutcomeCategory(actualOutcome),
          is_correct: isExact || isCategoryCorrect,
          points_earned: points + streakBonus,
          streak_count: newStreakCount,
          streak_bonus: streakBonus,
          resolved_at: new Date().toISOString()
        }
        
        console.log(`Updating prediction ${prediction.id} with:`, updateData)
        
        console.log(`Attempting to update prediction ${prediction.id} with data:`, updateData)
        
        const { error, data } = await supabase
          .from('at_bat_predictions')
          .update(updateData)
          .eq('id', prediction.id)
          .select()
        
        if (error) {
          console.error('❌ ERROR resolving prediction:', error)
          console.error('Update data:', updateData)
          console.error('Prediction ID:', prediction.id)
          console.error('Full error details:', JSON.stringify(error, null, 2))
        } else {
          console.log(`✅ Successfully resolved prediction ${prediction.id}`)
          console.log('Updated prediction data:', data)
        }
      }
      
      console.log(`Completed resolution for at-bat ${atBatIndex}`)
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

  // Get all predictions for a game (all users)
  async getAllGamePredictions(gamePk: number): Promise<AtBatPrediction[]> {
    try {
      const { data, error } = await supabase
        .from('predictions_with_users')
        .select('*')
        .eq('game_pk', gamePk)
        .order('at_bat_index', { ascending: false })
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
      console.error('Error fetching all game predictions:', error)
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

  // Extract outcome from completed play data
  private extractOutcomeFromPlay(play: any): AtBatOutcome | null {
    try {
      console.log('Extracting outcome from play:', {
        result: play.result,
        description: play.result?.description,
        event: play.result?.event
      })

      if (!play.result) {
        console.warn('No result data in play')
        return null
      }

      const { type, event, description } = play.result
      
      // Use the event field first, as it's more reliable
      if (event) {
        console.log(`Using event field: "${event}"`)
        return this.mapEventToOutcome(event)
      }
      
      // Fall back to type field
      if (type) {
        console.log(`Using type field: "${type}"`)
        return this.mapTypeToOutcome(type)
      }
      
      // Try to parse from description
      if (description) {
        console.log(`Parsing from description: "${description}"`)
        return this.parseDescriptionToOutcome(description)
      }
      
      console.warn('Could not extract outcome from play data')
      return null
    } catch (error) {
      console.error('Error extracting outcome from play:', error)
      return null
    }
  }

  // Map event field to our outcome types
  private mapEventToOutcome(event: string): AtBatOutcome {
    const eventMap: Record<string, AtBatOutcome> = {
      'Single': 'single',
      'Double': 'double',
      'Triple': 'triple',
      'Home Run': 'home_run',
      'Walk': 'walk',
      'Strikeout': 'strikeout',
      'Groundout': 'groundout',
      'Flyout': 'flyout',
      'Pop Out': 'popout',
      'Lineout': 'lineout',
      "Fielder's Choice": 'fielders_choice',
      'Hit By Pitch': 'hit_by_pitch',
      'Error': 'error',
      'Sacrifice': 'sacrifice',
      'Sacrifice Fly': 'sacrifice',
      'Sacrifice Bunt': 'sacrifice',
      'Intentional Walk': 'walk',
      'Catcher Interference': 'hit_by_pitch'
    }
    
    const outcome = eventMap[event] || 'other'
    console.log(`Mapped event "${event}" to "${outcome}"`)
    return outcome
  }

  // Map type field to our outcome types
  private mapTypeToOutcome(type: string): AtBatOutcome {
    const typeMap: Record<string, AtBatOutcome> = {
      'single': 'single',
      'double': 'double',
      'triple': 'triple',
      'home_run': 'home_run',
      'walk': 'walk',
      'strikeout': 'strikeout',
      'groundout': 'groundout',
      'flyout': 'flyout',
      'popout': 'popout',
      'lineout': 'lineout',
      'fielders_choice': 'fielders_choice',
      'hit_by_pitch': 'hit_by_pitch',
      'error': 'error',
      'sacrifice': 'sacrifice'
    }
    
    const outcome = typeMap[type] || 'other'
    console.log(`Mapped type "${type}" to "${outcome}"`)
    return outcome
  }

  // Parse description to extract outcome
  private parseDescriptionToOutcome(description: string): AtBatOutcome {
    const desc = description.toLowerCase()
    
    if (desc.includes('home run') || desc.includes('homer')) return 'home_run'
    if (desc.includes('triple')) return 'triple'
    if (desc.includes('double')) return 'double'
    if (desc.includes('single')) return 'single'
    if (desc.includes('walk') || desc.includes('ball')) return 'walk'
    if (desc.includes('strikeout') || desc.includes('strikes out')) return 'strikeout'
    if (desc.includes('groundout') || desc.includes('ground out')) return 'groundout'
    if (desc.includes('flyout') || desc.includes('fly out')) return 'flyout'
    if (desc.includes('pop out') || desc.includes('popout')) return 'popout'
    if (desc.includes('lineout') || desc.includes('line out')) return 'lineout'
    if (desc.includes('fielder\'s choice')) return 'fielders_choice'
    if (desc.includes('hit by pitch') || desc.includes('hbp')) return 'hit_by_pitch'
    if (desc.includes('error')) return 'error'
    if (desc.includes('sacrifice')) return 'sacrifice'
    
    console.log(`Could not parse description "${description}", defaulting to 'other'`)
    return 'other'
  }

  // Auto-resolve predictions when an at-bat is completed
  async autoResolveCompletedAtBats(gamePk: number, completedAtBat: any): Promise<void> {
    try {
      if (!completedAtBat || !completedAtBat.about) {
        console.log('No completed at-bat data to resolve:', completedAtBat)
        return
      }

      const atBatIndex = completedAtBat.about?.atBatIndex
      if (atBatIndex === undefined) {
        console.log('No at-bat index found:', completedAtBat.about)
        return
      }

      // Check cache first to avoid redundant database queries
      if (this.isAtBatResolved(gamePk, atBatIndex)) {
        return // Already resolved, skip
      }

      console.log(`Attempting to resolve predictions for at-bat ${atBatIndex}`)
      console.log(`Completed at-bat data:`, {
        atBatIndex: completedAtBat.about.atBatIndex,
        result: completedAtBat.result,
        description: completedAtBat.result?.description
      })

      // Check if this at-bat's predictions are already resolved
      const existingPredictions = await this.getAtBatPredictions(gamePk, atBatIndex)
      const unresolvedPredictions = existingPredictions.filter(p => !p.actualOutcome)
      
      if (unresolvedPredictions.length === 0) {
        // Mark as resolved in cache to avoid future checks
        this.markAtBatResolved(gamePk, atBatIndex)
        return // Already resolved
      }

      console.log(`Found ${unresolvedPredictions.length} unresolved predictions for at-bat ${atBatIndex}`)

      // Extract outcome from the completed play
      const actualOutcome = this.extractOutcomeFromPlay(completedAtBat)
      console.log(`Extracted outcome "${actualOutcome}" from at-bat ${atBatIndex}`)

      if (!actualOutcome) {
        console.warn(`Could not extract outcome from at-bat ${atBatIndex}, skipping resolution`)
        return
      }

      // Resolve the predictions
      await this.resolveAtBatPredictions(gamePk, atBatIndex, actualOutcome)
      
      // Mark as resolved in cache
      this.markAtBatResolved(gamePk, atBatIndex)
      console.log(`Successfully resolved predictions for at-bat ${atBatIndex}`)
    } catch (error) {
      console.error('Error auto-resolving at-bat predictions:', error)
    }
  }

  // Auto-resolve ALL completed at-bats for a game
  async autoResolveAllCompletedAtBats(gamePk: number, game: any): Promise<void> {
    try {
      if (!game?.liveData?.plays?.allPlays) {
        console.log('No game plays data available')
        return
      }

      // Initialize cache if not already done for this game
      if (!this.resolvedAtBatsCache.has(gamePk)) {
        await this.initializeResolvedAtBatsCache(gamePk)
      }

      const { allPlays } = game.liveData.plays
      
      // Find all completed plays (those with a result type other than 'at_bat')
      const completedPlays = allPlays.filter((play: any) => 
        play.result.type && play.result.type !== 'at_bat'
      )
      
      // Filter out already resolved at-bats using cache
      const unresolvedPlays = completedPlays.filter((play: any) => {
        const atBatIndex = play.about?.atBatIndex
        return atBatIndex !== undefined && !this.isAtBatResolved(gamePk, atBatIndex)
      })
      
      console.log(`Found ${completedPlays.length} completed plays, ${unresolvedPlays.length} need resolution`)

      // Process only unresolved plays
      for (const play of unresolvedPlays) {
        const atBatIndex = play.about?.atBatIndex
        if (atBatIndex === undefined) {
          continue
        }

        // Double-check with database (cache might be stale)
        const existingPredictions = await this.getAtBatPredictions(gamePk, atBatIndex)
        const unresolvedPredictions = existingPredictions.filter(p => !p.actualOutcome)
        
        if (unresolvedPredictions.length === 0) {
          // Mark as resolved in cache to avoid future checks
          this.markAtBatResolved(gamePk, atBatIndex)
          continue // Already resolved
        }

        console.log(`Resolving ${unresolvedPredictions.length} unresolved predictions for at-bat ${atBatIndex}`)

        // Extract outcome from the completed play
        const actualOutcome = this.extractOutcomeFromPlay(play)
        console.log(`Extracted outcome "${actualOutcome}" from at-bat ${atBatIndex}`)

        if (!actualOutcome) {
          console.warn(`Could not extract outcome from at-bat ${atBatIndex}, skipping`)
          continue
        }

        // Resolve the predictions
        await this.resolveAtBatPredictions(gamePk, atBatIndex, actualOutcome)
        
        // Mark as resolved in cache
        this.markAtBatResolved(gamePk, atBatIndex)
        console.log(`Successfully resolved predictions for at-bat ${atBatIndex}`)
      }
    } catch (error) {
      console.error('Error auto-resolving all completed at-bat predictions:', error)
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
}

export const predictionService = new PredictionService()

