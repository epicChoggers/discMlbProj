import { supabase } from '../supabaseClient'
import { AtBatPrediction, AtBatOutcome, PredictionStats, getOutcomeCategory, getOutcomePoints, getCategoryPoints } from './types'
import { debounce } from './utils/debounce'
import { networkOptimizationService } from './services/NetworkOptimizationService'

export class PredictionServiceNew {
  private apiBaseUrl: string
  private isDevelopment: boolean
  // Cache for tracking resolved at-bats to avoid redundant processing
  private resolvedAtBatsCache = new Map<number, Set<number>>()

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
    console.log(`Prediction Service initialized in ${this.isDevelopment ? 'development' : 'production'} mode with API base: ${this.apiBaseUrl}`)
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

      const response = await fetch(`${this.apiBaseUrl}/game?action=predictions&gamePk=${gamePk}&atBatIndex=${atBatIndex}&userId=${user.id}`)
      
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
      
      if (atBatIndex === null || atBatIndex === undefined || atBatIndex < 0) {
        throw new Error('Invalid atBatIndex: atBatIndex is required and must be a non-negative number')
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

      const response = await fetch(`${this.apiBaseUrl}/game?action=predictions`, {
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
      const response = await fetch(`${this.apiBaseUrl}/game?action=predictions&gamePk=${gamePk}&atBatIndex=${atBatIndex}`)
      
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

      const response = await fetch(`${this.apiBaseUrl}/game?action=predictions&gamePk=${gamePk}&userId=${user.id}`)
      
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
      const response = await fetch(`${this.apiBaseUrl}/game?action=predictions&gamePk=${gamePk}`)
      
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

  // Calculate points for a prediction based on accuracy using new unified system
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
      // Get exact points for correct prediction
      const { exact } = getOutcomePoints(actualOutcome)
      points = exact
      bonusInfo = 'Exact prediction!'
    } else if (isCategoryCorrect) {
      // Get category points for partial credit
      points = getCategoryPoints(actualCategory)
      bonusInfo = 'Category correct!'
    }
    
    return { points, isExact, isCategoryCorrect, bonusInfo }
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

  // Subscribe to user stats updates using Supabase real-time with improved efficiency
  subscribeToUserStats(callback: (stats: PredictionStats) => void) {
    // Debounce the stats update to prevent excessive API calls
    const debouncedUpdate = debounce(async () => {
      try {
        const stats = await this.getUserPredictionStats()
        console.log('Updated user stats:', stats)
        callback(stats)
      } catch (error) {
        console.error('Error in user stats subscription callback:', error)
      }
    }, 300) // Reduced debounce to 300ms for better responsiveness

    const subscription = supabase
      .channel('user_stats_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'at_bat_predictions'
        },
        async (payload) => {
          console.log('User stats subscription triggered:', payload)
          
          // Only process if this affects the current user
          const { data: { user } } = await supabase.auth.getUser()
          if (user && payload.new && (payload.new as any).user_id !== user.id) {
            return // Skip if not the current user's data
          }
          
          // Add a small delay to ensure database transaction is committed
          await new Promise(resolve => setTimeout(resolve, 50)) // Reduced delay
          
          // Use debounced update to prevent excessive calls
          debouncedUpdate()
        }
      )
      .subscribe((status) => {
        console.log('User stats subscription status:', status)
      })

    return subscription
  }

  // Initialize cache for resolved at-bats
  private async initializeResolvedAtBatsCache(gamePk: number): Promise<void> {
    try {
      const { data } = await supabase
        .from('at_bat_predictions')
        .select('at_bat_index')
        .eq('game_pk', gamePk)
        .not('resolved_at', 'is', null)

      const resolvedAtBats = new Set<number>()
      data?.forEach(prediction => {
        resolvedAtBats.add(prediction.at_bat_index)
      })

      this.resolvedAtBatsCache.set(gamePk, resolvedAtBats)
      console.log(`Initialized cache for game ${gamePk} with ${resolvedAtBats.size} resolved at-bats`)
    } catch (error) {
      console.error('Error initializing resolved at-bats cache:', error)
      this.resolvedAtBatsCache.set(gamePk, new Set())
    }
  }

  // Check if an at-bat is already resolved
  private isAtBatResolved(gamePk: number, atBatIndex: number): boolean {
    const gameCache = this.resolvedAtBatsCache.get(gamePk)
    return gameCache ? gameCache.has(atBatIndex) : false
  }

  // Mark an at-bat as resolved in cache
  private markAtBatResolved(gamePk: number, atBatIndex: number): void {
    if (!this.resolvedAtBatsCache.has(gamePk)) {
      this.resolvedAtBatsCache.set(gamePk, new Set())
    }
    this.resolvedAtBatsCache.get(gamePk)!.add(atBatIndex)
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

      // Only resolve if there's an actual outcome (not just an ongoing at-bat)
      // We determine completion by having a valid result, not by isComplete flag
      if (!completedAtBat.result || !completedAtBat.result.event || completedAtBat.result.event === 'at_bat') {
        console.log(`Skipping at-bat ${atBatIndex} - no valid outcome yet (event: ${completedAtBat.result?.event})`)
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
      
      console.log(`At-bat ${atBatIndex} has ${existingPredictions.length} total predictions, ${unresolvedPredictions.length} unresolved`)
      
      if (unresolvedPredictions.length === 0) {
        // Mark as resolved in cache to avoid future checks
        this.markAtBatResolved(gamePk, atBatIndex)
        console.log(`At-bat ${atBatIndex} already resolved, skipping`)
        return // Already resolved
      }


      console.log(`Found ${unresolvedPredictions.length} unresolved predictions for at-bat ${atBatIndex}`)
      console.log(`Unresolved prediction details:`, unresolvedPredictions.map(p => ({
        id: p.id,
        userId: p.userId,
        prediction: p.prediction,
        category: p.predictionCategory
      })))

      // Extract outcome from the completed play
      const actualOutcome = this.extractOutcomeFromPlay(completedAtBat)
      console.log(`Extracted outcome "${actualOutcome}" from at-bat ${atBatIndex}`)

      if (!actualOutcome) {
        console.warn(`Could not extract outcome from at-bat ${atBatIndex}, skipping resolution`)
        return
      }

      // CRITICAL VALIDATION: Ensure we're applying the outcome to the correct at-bat
      console.log(`🔍 VALIDATION: Processing single at-bat ${atBatIndex}`)
      console.log(`🔍 Play data:`, {
        atBatIndex: completedAtBat.about?.atBatIndex,
        description: completedAtBat.result?.description,
        event: completedAtBat.result?.event,
        eventType: completedAtBat.result?.eventType,
        extractedOutcome: actualOutcome
      })
      console.log(`🔍 Predictions to resolve:`, unresolvedPredictions.map(p => ({
        id: p.id,
        atBatIndex: p.atBatIndex,
        prediction: p.prediction,
        userId: p.userId
      })))

      // Double-check that all predictions belong to the same at-bat index
      const mismatchedPredictions = unresolvedPredictions.filter(p => p.atBatIndex !== atBatIndex)
      if (mismatchedPredictions.length > 0) {
        console.error(`❌ CRITICAL ERROR: Found ${mismatchedPredictions.length} predictions with mismatched at-bat indices!`)
        console.error(`❌ Expected at-bat index: ${atBatIndex}`)
        console.error(`❌ Mismatched predictions:`, mismatchedPredictions)
        console.error(`❌ Skipping resolution to prevent data corruption`)
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
      
      // Find all plays with actual outcomes (not ongoing at-bats)
      // We determine completion by having a valid outcome, not by isComplete flag
      const completedPlays = allPlays.filter((play: any) => 
        play.result && 
        play.result.event &&
        play.result.event !== 'at_bat' && // Exclude ongoing at-bats
        play.about?.atBatIndex !== undefined
      )
      
      // Sort completed plays by atBatIndex to ensure chronological order
      completedPlays.sort((a: any, b: any) => {
        const aIndex = a.about?.atBatIndex ?? 0
        const bIndex = b.about?.atBatIndex ?? 0
        return aIndex - bIndex
      })
      
      // Filter out already resolved at-bats using cache
      const unresolvedPlays = completedPlays.filter((play: any) => {
        const atBatIndex = play.about?.atBatIndex
        return atBatIndex !== undefined && !this.isAtBatResolved(gamePk, atBatIndex)
      })
      
      console.log(`Found ${completedPlays.length} completed plays, ${unresolvedPlays.length} need resolution`)
      
      // Log the order of plays being processed
      console.log('Plays to be processed in order:', unresolvedPlays.map((play: any) => ({
        atBatIndex: play.about?.atBatIndex,
        description: play.result?.description,
        event: play.result?.event
      })))

      // Process only unresolved plays
      for (const play of unresolvedPlays) {
        const atBatIndex = play.about?.atBatIndex
        if (atBatIndex === undefined) {
          continue
        }
        
        console.log(`\n=== Processing at-bat ${atBatIndex} ===`)
        console.log(`Play data:`, {
          atBatIndex: play.about?.atBatIndex,
          result: play.result,
          description: play.result?.description,
          event: play.result?.event
        })

        // Double-check with database (cache might be stale)
        const existingPredictions = await this.getAtBatPredictions(gamePk, atBatIndex)
        const unresolvedPredictions = existingPredictions.filter(p => !p.actualOutcome)
        
        console.log(`At-bat ${atBatIndex} has ${existingPredictions.length} total predictions, ${unresolvedPredictions.length} unresolved`)
        
        if (unresolvedPredictions.length === 0) {
          // Mark as resolved in cache to avoid future checks
          this.markAtBatResolved(gamePk, atBatIndex)
          console.log(`At-bat ${atBatIndex} already resolved, skipping`)
          continue // Already resolved
        }

        console.log(`Resolving ${unresolvedPredictions.length} unresolved predictions for at-bat ${atBatIndex}`)
        console.log(`Predictions to resolve:`, unresolvedPredictions.map(p => ({
          id: p.id,
          userId: p.userId,
          prediction: p.prediction,
          category: p.predictionCategory
        })))

        // Extract outcome from the completed play
        const actualOutcome = this.extractOutcomeFromPlay(play)
        console.log(`Extracted outcome "${actualOutcome}" from at-bat ${atBatIndex}`)

        if (!actualOutcome) {
          console.warn(`Could not extract outcome from at-bat ${atBatIndex}, skipping`)
          continue
        }

        // CRITICAL VALIDATION: Ensure we're applying the outcome to the correct at-bat
        // Log detailed information about the play and predictions to prevent cross-contamination
        console.log(`🔍 VALIDATION: Processing at-bat ${atBatIndex}`)
        console.log(`🔍 Play data:`, {
          atBatIndex: play.about?.atBatIndex,
          description: play.result?.description,
          event: play.result?.event,
          eventType: play.result?.eventType,
          extractedOutcome: actualOutcome
        })
        console.log(`🔍 Predictions to resolve:`, unresolvedPredictions.map(p => ({
          id: p.id,
          atBatIndex: p.atBatIndex,
          prediction: p.prediction,
          userId: p.userId
        })))

        // Double-check that all predictions belong to the same at-bat index
        const mismatchedPredictions = unresolvedPredictions.filter(p => p.atBatIndex !== atBatIndex)
        if (mismatchedPredictions.length > 0) {
          console.error(`❌ CRITICAL ERROR: Found ${mismatchedPredictions.length} predictions with mismatched at-bat indices!`)
          console.error(`❌ Expected at-bat index: ${atBatIndex}`)
          console.error(`❌ Mismatched predictions:`, mismatchedPredictions)
          console.error(`❌ Skipping resolution to prevent data corruption`)
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
      
      if (predictions.length === 0) {
        console.log(`No predictions found for at-bat ${atBatIndex}`)
        return
      }

      // Try transaction-based approach first for better reliability
      try {
        await this.resolvePredictionsWithTransaction(predictions, actualOutcome)
        console.log(`✅ Successfully resolved all ${predictions.length} predictions using transaction`)
        return
      } catch (transactionError) {
        console.warn(`Transaction-based resolution failed, falling back to individual updates:`, transactionError)
      }

      // Fallback to individual updates with retry logic
      const updatePromises = predictions.map(async (prediction) => {
        return await this.resolveSinglePrediction(prediction, actualOutcome)
      })

      // Wait for all updates to complete
      const results = await Promise.allSettled(updatePromises)
      
      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      console.log(`Resolution completed for at-bat ${atBatIndex}: ${successful} successful, ${failed} failed`)
      
      if (failed > 0) {
        console.error(`❌ ${failed} predictions failed to resolve for at-bat ${atBatIndex}`)
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Failed prediction ${predictions[index].id}:`, result.reason)
          }
        })
      }
      
    } catch (error) {
      console.error('Error resolving at-bat predictions:', error)
    }
  }

  // Resolve predictions using database transaction for better reliability
  private async resolvePredictionsWithTransaction(
    predictions: AtBatPrediction[],
    actualOutcome: AtBatOutcome
  ): Promise<void> {
    console.log(`Attempting transaction-based resolution for ${predictions.length} predictions`)
    
    // Prepare all update data
    const updateDataList = []
    for (const prediction of predictions) {
      const { points, isExact, isCategoryCorrect } = this.calculatePoints(
        prediction.prediction,
        prediction.predictionCategory,
        actualOutcome
      )
      updateDataList.push({
        id: prediction.id,
        actual_outcome: actualOutcome,
        actual_category: getOutcomeCategory(actualOutcome),
        is_correct: isExact || isCategoryCorrect,
        points_earned: points,
        resolved_at: new Date().toISOString()
      })
    }

    // Execute all updates in a single batch
    const { error } = await supabase
      .from('at_bat_predictions')
      .upsert(updateDataList, { onConflict: 'id' })

    if (error) {
      throw new Error(`Transaction failed: ${error.message}`)
    }

    console.log(`✅ Transaction-based resolution successful for ${predictions.length} predictions`)
  }

  // Resolve a single prediction with retry logic
  private async resolveSinglePrediction(
    prediction: AtBatPrediction, 
    actualOutcome: AtBatOutcome,
    retryCount: number = 0
  ): Promise<void> {
    const maxRetries = 3
    const retryDelay = 1000 * (retryCount + 1) // Exponential backoff
    
    try {
      console.log(`Resolving prediction ${prediction.id} for user ${prediction.userId} (attempt ${retryCount + 1})`)
      console.log(`Prediction: ${prediction.prediction}, Category: ${prediction.predictionCategory}`)
      
      const { points, isExact, isCategoryCorrect } = this.calculatePoints(
        prediction.prediction,
        prediction.predictionCategory,
        actualOutcome
      )
      
      console.log(`Points calculation: ${points} base, exact: ${isExact}, category: ${isCategoryCorrect}`)
      
      const updateData = {
        actual_outcome: actualOutcome,
        actual_category: getOutcomeCategory(actualOutcome),
        is_correct: isExact,
        is_partial_credit: !isExact && isCategoryCorrect,
        points_earned: points,
        resolved_at: new Date().toISOString()
      }
      
      console.log(`Updating prediction ${prediction.id} with:`, updateData)
      
      const { error, data } = await supabase
        .from('at_bat_predictions')
        .update(updateData)
        .eq('id', prediction.id)
        .select()
      
      if (error) {
        throw new Error(`Database update failed: ${error.message}`)
      }
      
      console.log(`✅ Successfully resolved prediction ${prediction.id}`)
      console.log('Updated prediction data:', data)
      
    } catch (error) {
      console.error(`❌ ERROR resolving prediction ${prediction.id} (attempt ${retryCount + 1}):`, error)
      
      if (retryCount < maxRetries) {
        console.log(`Retrying prediction ${prediction.id} in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return await this.resolveSinglePrediction(prediction, actualOutcome, retryCount + 1)
      } else {
        console.error(`❌ FAILED to resolve prediction ${prediction.id} after ${maxRetries + 1} attempts`)
        throw error
      }
    }
  }

  // Extract outcome from completed play data
  private extractOutcomeFromPlay(play: any): AtBatOutcome | null {
    try {
      console.log('Extracting outcome from play:', {
        result: play.result,
        description: play.result?.description,
        event: play.result?.event,
        eventType: play.result?.eventType
      })

      if (!play.result) {
        console.warn('No result data in play')
        return null
      }

      const { type, event, eventType, description } = play.result
      
      // Use the eventType field first, as it's the most reliable standardized value
      if (eventType) {
        console.log(`Using eventType field: "${eventType}"`)
        return this.mapEventTypeToOutcome(eventType, description)
      }
      
      // Fall back to event field
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

  // Map eventType field to our outcome types (most reliable)
  private mapEventTypeToOutcome(eventType: string, description?: string): AtBatOutcome {
    // Direct mapping from MLB API event types to our AtBatOutcome types
    const eventTypeMap: Record<string, AtBatOutcome> = {
      // Hits (plateAppearance: true, hit: true)
      'single': 'single',
      'double': 'double',
      'triple': 'triple',
      'home_run': 'home_run',
      
      // Walks and Hit by Pitch (plateAppearance: true, hit: false)
      'walk': 'walk',
      'intent_walk': 'intent_walk',
      'hit_by_pitch': 'hit_by_pitch',
      
      // Strikeouts (plateAppearance: true, hit: false)
      'strikeout': 'strikeout',
      'strike_out': 'strike_out',
      'strikeout_double_play': 'strikeout_double_play',
      'strikeout_triple_play': 'strikeout_triple_play',
      
      // Field Outs (plateAppearance: true, hit: false)
      'field_out': 'field_out',
      'fielders_choice': 'fielders_choice',
      'fielders_choice_out': 'fielders_choice_out',
      'force_out': 'force_out',
      'grounded_into_double_play': 'grounded_into_double_play',
      'grounded_into_triple_play': 'grounded_into_triple_play',
      'triple_play': 'triple_play',
      'double_play': 'double_play',
      
      // Sacrifice Plays (plateAppearance: true, hit: false)
      'sac_fly': 'sac_fly',
      'sac_bunt': 'sac_bunt',
      'sac_fly_double_play': 'sac_fly_double_play',
      'sac_bunt_double_play': 'sac_bunt_double_play',
      
      // Errors and Interference (plateAppearance: true, hit: false)
      'field_error': 'field_error',
      'catcher_interf': 'catcher_interf',
      'batter_interference': 'batter_interference',
      'fan_interference': 'fan_interference',
      
      // Non-plate appearance events (plateAppearance: false) - these should not be at-bat outcomes
      'pickoff_1b': 'pickoff_1b',
      'pickoff_2b': 'pickoff_2b',
      'pickoff_3b': 'pickoff_3b',
      'caught_stealing_2b': 'caught_stealing_2b',
      'caught_stealing_3b': 'caught_stealing_3b',
      'caught_stealing_home': 'caught_stealing_home',
      'stolen_base_2b': 'stolen_base_2b',
      'stolen_base_3b': 'stolen_base_3b',
      'stolen_base_home': 'stolen_base_home',
      'wild_pitch': 'wild_pitch',
      'passed_ball': 'passed_ball',
      'balk': 'balk',
      'other_advance': 'other_advance',
      'defensive_indiff': 'defensive_indiff',
      'ejection': 'ejection',
      'game_advisory': 'game_advisory',
      'no_event': 'field_out' // Map no_event to field_out as fallback
    }

    const mappedOutcome = eventTypeMap[eventType]
    if (mappedOutcome) {
      return mappedOutcome
    }

    // If not found in direct mapping, try to infer from description
    if (description) {
      return this.parseDescriptionToOutcome(description)
    }

    console.warn(`Unknown eventType: ${eventType}`)
    return 'field_out' // Default fallback for unknown event types
  }

  // Map event field to our outcome types
  private mapEventToOutcome(event: string): AtBatOutcome {
    const eventMap: Record<string, AtBatOutcome> = {
      'Single': 'single',
      'Double': 'double',
      'Triple': 'triple',
      'Home Run': 'home_run',
      'Walk': 'walk',
      'Intentional Walk': 'intent_walk',
      'Hit By Pitch': 'hit_by_pitch',
      'Strikeout': 'strikeout',
      'Strikeout (Swinging)': 'strikeout',
      'Strikeout (Looking)': 'strikeout',
      'Field Out': 'field_out',
      'Groundout': 'field_out',
      'Flyout': 'field_out',
      'Lineout': 'field_out',
      'Pop Out': 'field_out',
      'Sacrifice Fly': 'sac_fly',
      'Sacrifice Bunt': 'sac_bunt',
      'Error': 'field_error',
      'Fielders Choice': 'fielders_choice',
      'Forceout': 'force_out',
      'Grounded Into DP': 'grounded_into_double_play',
      'Sacrifice Fly DP': 'sac_fly_double_play',
      'Sacrifice Bunt DP': 'sac_bunt_double_play',
      'Strikeout DP': 'strikeout_double_play',
      'Triple Play': 'triple_play',
      'Double Play': 'double_play'
    }

    return eventMap[event] || 'field_out' // Default fallback for unknown events
  }

  // Map type field to our outcome types
  private mapTypeToOutcome(type: string): AtBatOutcome {
    const typeMap: Record<string, AtBatOutcome> = {
      'single': 'single',
      'double': 'double',
      'triple': 'triple',
      'home_run': 'home_run',
      'walk': 'walk',
      'intent_walk': 'intent_walk',
      'hit_by_pitch': 'hit_by_pitch',
      'strikeout': 'strikeout',
      'field_out': 'field_out',
      'fielders_choice': 'fielders_choice',
      'force_out': 'force_out',
      'grounded_into_double_play': 'grounded_into_double_play',
      'sac_fly': 'sac_fly',
      'sac_bunt': 'sac_bunt',
      'field_error': 'field_error'
    }

    return typeMap[type] || 'field_out' // Default fallback for unknown types
  }

  // Parse description to extract outcome
  private parseDescriptionToOutcome(description: string): AtBatOutcome {
    const desc = description.toLowerCase()
    
    // Hits
    if (desc.includes('home run') || desc.includes('homer')) return 'home_run'
    if (desc.includes('triple')) return 'triple'
    if (desc.includes('double')) return 'double'
    if (desc.includes('single')) return 'single'
    
    // Walks and HBP
    if (desc.includes('intentional walk')) return 'intent_walk'
    if (desc.includes('hit by pitch') || desc.includes('hbp')) return 'hit_by_pitch'
    if (desc.includes('walk') || desc.includes('base on balls')) return 'walk'
    
    // Strikeouts
    if (desc.includes('strikeout') || desc.includes('strikes out')) return 'strikeout'
    
    // Sacrifice plays
    if (desc.includes('sacrifice fly') || desc.includes('sac fly')) return 'sac_fly'
    if (desc.includes('sacrifice bunt') || desc.includes('sac bunt')) return 'sac_bunt'
    
    // Field outs
    if (desc.includes('ground out') || desc.includes('groundout')) return 'field_out'
    if (desc.includes('fly out') || desc.includes('flyout')) return 'field_out'
    if (desc.includes('line out') || desc.includes('lineout')) return 'field_out'
    if (desc.includes('pop out') || desc.includes('popout')) return 'field_out'
    if (desc.includes('field out') || desc.includes('fieldout')) return 'field_out'
    
    // Errors
    if (desc.includes('error') || desc.includes('e')) return 'field_error'
    
    // Fielders choice
    if (desc.includes('fielders choice') || desc.includes('fielder\'s choice')) return 'fielders_choice'
    
    // Force outs
    if (desc.includes('force out') || desc.includes('forceout')) return 'force_out'
    
    // Double plays
    if (desc.includes('grounded into double play')) return 'grounded_into_double_play'
    if (desc.includes('strikeout double play')) return 'strikeout_double_play'
    if (desc.includes('sacrifice fly double play')) return 'sac_fly_double_play'
    if (desc.includes('sacrifice bunt double play')) return 'sac_bunt_double_play'
    
    // Triple plays
    if (desc.includes('triple play')) return 'triple_play'
    if (desc.includes('strikeout triple play')) return 'strikeout_triple_play'
    
    console.warn(`Could not parse outcome from description: "${description}"`)
    return 'field_out' // Default fallback for unparseable descriptions
  }
}

export const predictionServiceNew = new PredictionServiceNew()
