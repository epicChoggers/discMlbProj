import { supabase } from './supabase.js'

// Helper function to determine the category of an outcome
const getOutcomeCategory = (outcome: AtBatOutcome['type']): string => {
  switch (outcome) {
    // Hits
    case 'single':
    case 'double':
    case 'triple':
    case 'home_run':
      return 'hit'
    
    // Walks
    case 'walk':
    case 'intent_walk':
      return 'walk'
    
    // Strikeouts (all outs)
    case 'strikeout':
    case 'strike_out':
    case 'strikeout_double_play':
    case 'strikeout_triple_play':
      return 'out'
    
    // Field Outs (all outs)
    case 'field_out':
    case 'fielders_choice':
    case 'fielders_choice_out':
    case 'force_out':
    case 'grounded_into_double_play':
    case 'grounded_into_triple_play':
    case 'triple_play':
    case 'double_play':
      return 'out'
    
    // Sacrifice Plays
    case 'sac_fly':
    case 'sac_bunt':
    case 'sac_fly_double_play':
    case 'sac_bunt_double_play':
      return 'sacrifice'
    
    // Errors and Interference
    case 'field_error':
    case 'catcher_interf':
    case 'batter_interference':
    case 'fan_interference':
      return 'error'
    
    // Hit by Pitch
    case 'hit_by_pitch':
      return 'hit_by_pitch'
    
    // Unknown
    case 'unknown':
    default:
      return 'unknown'
  }
}

export interface AtBatOutcome {
  type: 'single' | 'double' | 'triple' | 'home_run' | 'walk' | 'strikeout' | 'field_out' | 'ground_out' | 'fly_out' | 'pop_out' | 'line_out' | 'force_out' | 'fielders_choice' | 'sac_fly' | 'sac_bunt' | 'hit_by_pitch' | 'error' | 'field_error' | 'catcher_interference' | 'unknown' | 'intent_walk' | 'strike_out' | 'strikeout_double_play' | 'strikeout_triple_play' | 'fielders_choice_out' | 'grounded_into_double_play' | 'grounded_into_triple_play' | 'triple_play' | 'double_play' | 'sac_fly_double_play' | 'sac_bunt_double_play' | 'catcher_interf' | 'batter_interference' | 'fan_interference'
}

export interface Prediction {
  id: string
  userId: string
  gamePk: number
  atBatIndex: number
  prediction: AtBatOutcome['type']
  actualOutcome?: AtBatOutcome['type']
  isCorrect?: boolean
  pointsEarned?: number
  resolvedAt?: string
  createdAt: string
}

export class PredictionServiceNew {
  constructor() {
    // Constructor for future API base URL usage
  }

  // Auto-resolve all completed at-bats for a game
  async autoResolveAllCompletedAtBats(gamePk: number, game: any): Promise<void> {
    try {
      console.log(`Starting auto-resolve for game ${gamePk}`)
      console.log(`Game data structure:`, {
        hasGame: !!game,
        hasLiveData: !!game?.liveData,
        hasPlays: !!game?.liveData?.plays,
        hasAllPlays: !!game?.liveData?.plays?.allPlays,
        allPlaysCount: game?.liveData?.plays?.allPlays?.length || 0
      })

      if (!game?.liveData?.plays?.allPlays) {
        console.log('No plays data available for resolution')
        return
      }

      const { allPlays } = game.liveData.plays
      console.log(`Processing ${allPlays.length} plays for resolution`)

      // Process each at-bat with actual outcomes (not ongoing at-bats)
      let completedAtBats = 0
      for (const play of allPlays) {
        if (play.about?.atBatIndex !== undefined && 
            play.result && 
            play.result.event && 
            play.result.event !== 'at_bat') {
          completedAtBats++
          console.log(`Processing completed at-bat ${play.about.atBatIndex}: ${play.result.event}`)
          await this.autoResolveCompletedAtBats(gamePk, play)
        } else {
          console.log(`Skipping play:`, {
            atBatIndex: play.about?.atBatIndex,
            hasResult: !!play.result,
            event: play.result?.event,
            reason: !play.about?.atBatIndex ? 'no atBatIndex' : 
                   !play.result ? 'no result' : 
                   !play.result.event ? 'no event' : 
                   play.result.event === 'at_bat' ? 'ongoing at-bat' : 'unknown'
          })
        }
      }
      console.log(`Found ${completedAtBats} completed at-bats out of ${allPlays.length} total plays`)
    } catch (error) {
      console.error('Error auto-resolving at-bat predictions:', error)
    }
  }

  // Resolve predictions for a completed at-bat
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
      if (!completedAtBat.result || !completedAtBat.result.event || completedAtBat.result.event === 'at_bat') {
        console.log(`Skipping at-bat ${atBatIndex} - no valid outcome yet (event: ${completedAtBat.result?.event})`)
        return
      }

      console.log(`Attempting to resolve predictions for at-bat ${atBatIndex}`)

      // Check if this at-bat's predictions are already resolved
      const existingPredictions = await this.getAtBatPredictions(gamePk, atBatIndex)
      const unresolvedPredictions = existingPredictions.filter(p => !p.actualOutcome)
      
      if (unresolvedPredictions.length === 0) {
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
      
      console.log(`Successfully resolved predictions for at-bat ${atBatIndex}`)
    } catch (error) {
      console.error('Error auto-resolving at-bat predictions:', error)
    }
  }

  // Get all predictions for a specific at-bat
  async getAtBatPredictions(gamePk: number, atBatIndex: number): Promise<Prediction[]> {
    try {
      const { data, error } = await supabase
        .from('at_bat_predictions')
        .select('*')
        .eq('game_pk', gamePk)
        .eq('at_bat_index', atBatIndex)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching at-bat predictions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching at-bat predictions:', error)
      return []
    }
  }

  // Resolve predictions for a completed at-bat
  async resolveAtBatPredictions(
    gamePk: number,
    atBatIndex: number,
    actualOutcome: AtBatOutcome['type']
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

  // Resolve predictions using a transaction for better reliability
  private async resolvePredictionsWithTransaction(
    predictions: Prediction[],
    actualOutcome: AtBatOutcome['type']
  ): Promise<void> {
    const updates = predictions.map(prediction => {
      const isCorrect = prediction.prediction === actualOutcome
      const predictedCategory = getOutcomeCategory(prediction.prediction)
      const actualCategory = getOutcomeCategory(actualOutcome)
      const isPartialCredit = !isCorrect && predictedCategory === actualCategory
      
      // Calculate points: full points for exact match, partial points for category match
      let pointsEarned = 0
      if (isCorrect) {
        pointsEarned = this.calculatePoints(actualOutcome)
        console.log(`✅ Exact match: ${prediction.prediction} = ${actualOutcome} (+${pointsEarned} points)`)
      } else if (isPartialCredit) {
        // Give partial credit - typically 1 point for getting the category right
        pointsEarned = 1
        console.log(`⚠️ Partial credit: ${prediction.prediction} (${predictedCategory}) vs ${actualOutcome} (${actualCategory}) (+${pointsEarned} points)`)
      } else {
        console.log(`❌ Incorrect: ${prediction.prediction} (${predictedCategory}) vs ${actualOutcome} (${actualCategory}) (0 points)`)
      }

      return {
        id: prediction.id,
        actual_outcome: actualOutcome,
        is_correct: isCorrect,
        is_partial_credit: isPartialCredit,
        points_earned: pointsEarned,
        resolved_at: new Date().toISOString()
      }
    })

    // Use a transaction to update all predictions at once
    const { error } = await supabase
      .from('at_bat_predictions')
      .upsert(updates, { onConflict: 'id' })

    if (error) {
      throw error
    }
  }

  // Resolve a single prediction
  private async resolveSinglePrediction(
    prediction: Prediction,
    actualOutcome: AtBatOutcome['type']
  ): Promise<void> {
    const isCorrect = prediction.prediction === actualOutcome
    const predictedCategory = getOutcomeCategory(prediction.prediction)
    const actualCategory = getOutcomeCategory(actualOutcome)
    const isPartialCredit = !isCorrect && predictedCategory === actualCategory
    
    // Calculate points: full points for exact match, partial points for category match
    let pointsEarned = 0
    if (isCorrect) {
      pointsEarned = this.calculatePoints(actualOutcome)
    } else if (isPartialCredit) {
      // Give partial credit - typically 1 point for getting the category right
      pointsEarned = 1
    }

    const { error } = await supabase
      .from('at_bat_predictions')
      .update({
        actual_outcome: actualOutcome,
        is_correct: isCorrect,
        is_partial_credit: isPartialCredit,
        points_earned: pointsEarned,
        resolved_at: new Date().toISOString()
      })
      .eq('id', prediction.id)

    if (error) {
      throw error
    }
  }

  // Extract outcome from a completed play
  private extractOutcomeFromPlay(play: any): AtBatOutcome['type'] | null {
    try {
      if (!play.result) {
        return null
      }

      const { type, event, eventType, description } = play.result
      
      // Map MLB API result types to our outcome types
      const outcomeMap: Record<string, AtBatOutcome['type']> = {
        'single': 'single',
        'double': 'double', 
        'triple': 'triple',
        'home_run': 'home_run',
        'walk': 'walk',
        'strikeout': 'strikeout',
        'field_out': 'field_out',
        'ground_out': 'ground_out',
        'fly_out': 'fly_out',
        'pop_out': 'pop_out',
        'line_out': 'line_out',
        'force_out': 'force_out',
        'fielders_choice': 'fielders_choice',
        'sac_fly': 'sac_fly',
        'sac_bunt': 'sac_bunt',
        'hit_by_pitch': 'hit_by_pitch',
        'error': 'error',
        'field_error': 'field_error',
        'catcher_interference': 'catcher_interference'
      }

      // Map MLB API event types to our outcome types
      const eventTypeMap: Record<string, AtBatOutcome['type']> = {
        'single': 'single',
        'double': 'double',
        'triple': 'triple',
        'home_run': 'home_run',
        'walk': 'walk',
        'strikeout': 'strikeout',
        'field_out': 'field_out',
        'ground_out': 'ground_out',
        'fly_out': 'fly_out',
        'pop_out': 'pop_out',
        'line_out': 'line_out',
        'force_out': 'force_out',
        'fielders_choice': 'fielders_choice',
        'sac_fly': 'sac_fly',
        'sac_bunt': 'sac_bunt',
        'hit_by_pitch': 'hit_by_pitch',
        'error': 'error',
        'field_error': 'field_error',
        'catcher_interference': 'catcher_interference'
      }

      // Map MLB API event names to our outcome types
      const eventMap: Record<string, AtBatOutcome['type']> = {
        'Single': 'single',
        'Double': 'double',
        'Triple': 'triple',
        'Home Run': 'home_run',
        'Walk': 'walk',
        'Strikeout': 'strikeout',
        'Lineout': 'line_out',
        'Groundout': 'ground_out',
        'Flyout': 'fly_out',
        'Pop Out': 'pop_out',
        'Forceout': 'force_out',
        'Fielders Choice': 'fielders_choice',
        'Sacrifice Fly': 'sac_fly',
        'Sacrifice Bunt': 'sac_bunt',
        'Hit By Pitch': 'hit_by_pitch',
        'Error': 'error',
        'Field Error': 'field_error',
        'Catcher Interference': 'catcher_interference'
      }

      // Try to match by eventType first (most reliable)
      if (eventType && eventTypeMap[eventType]) {
        console.log(`Matched by eventType: ${eventType} -> ${eventTypeMap[eventType]}`)
        return eventTypeMap[eventType]
      }

      // Try to match by event name (capitalized)
      if (event && eventMap[event]) {
        console.log(`Matched by event: ${event} -> ${eventMap[event]}`)
        return eventMap[event]
      }

      // Try to match by type (legacy)
      if (type && outcomeMap[type]) {
        console.log(`Matched by type: ${type} -> ${outcomeMap[type]}`)
        return outcomeMap[type]
      }

      // Fallback to description matching
      if (description) {
        const desc = description.toLowerCase()
        if (desc.includes('single')) return 'single'
        if (desc.includes('double')) return 'double'
        if (desc.includes('triple')) return 'triple'
        if (desc.includes('home run') || desc.includes('homer')) return 'home_run'
        if (desc.includes('walk') || desc.includes('base on balls')) return 'walk'
        if (desc.includes('strikeout') || desc.includes('strikes out')) return 'strikeout'
        if (desc.includes('ground out') || desc.includes('grounds out')) return 'ground_out'
        if (desc.includes('fly out') || desc.includes('flies out')) return 'fly_out'
        if (desc.includes('pop out') || desc.includes('pops out')) return 'pop_out'
        if (desc.includes('line out') || desc.includes('lines out')) return 'line_out'
        if (desc.includes('force out')) return 'force_out'
        if (desc.includes('fielders choice')) return 'fielders_choice'
        if (desc.includes('sacrifice fly') || desc.includes('sac fly')) return 'sac_fly'
        if (desc.includes('sacrifice bunt') || desc.includes('sac bunt')) return 'sac_bunt'
        if (desc.includes('hit by pitch')) return 'hit_by_pitch'
        if (desc.includes('error') || desc.includes('fielding error')) return 'error'
        if (desc.includes('catcher interference')) return 'catcher_interference'
      }

      console.warn('Could not determine outcome from play:', { type, event, eventType, description })
      return 'unknown'
    } catch (error) {
      console.error('Error extracting outcome from play:', error)
      return null
    }
  }

  // Calculate points for a correct prediction
  private calculatePoints(outcome: AtBatOutcome['type']): number {
    const pointValues: Record<AtBatOutcome['type'], number> = {
      'single': 1,
      'double': 2,
      'triple': 3,
      'home_run': 4,
      'walk': 1,
      'strikeout': 1,
      'field_out': 1,
      'ground_out': 1,
      'fly_out': 1,
      'pop_out': 1,
      'line_out': 1,
      'force_out': 1,
      'fielders_choice': 1,
      'sac_fly': 1,
      'sac_bunt': 1,
      'hit_by_pitch': 1,
      'error': 1,
      'field_error': 1,
      'catcher_interference': 1,
      'unknown': 0,
      'intent_walk': 1,
      'strike_out': 1,
      'strikeout_double_play': 1,
      'strikeout_triple_play': 1,
      'fielders_choice_out': 1,
      'grounded_into_double_play': 1,
      'grounded_into_triple_play': 1,
      'triple_play': 1,
      'double_play': 1,
      'sac_fly_double_play': 1,
      'sac_bunt_double_play': 1,
      'catcher_interf': 1,
      'batter_interference': 1,
      'fan_interference': 1
    }

    return pointValues[outcome] || 0
  }
}

// Export singleton instance
export const predictionServiceNew = new PredictionServiceNew()
