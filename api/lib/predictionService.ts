import { supabase } from './supabase.js'

export interface AtBatOutcome {
  type: 'single' | 'double' | 'triple' | 'home_run' | 'walk' | 'strikeout' | 'field_out' | 'ground_out' | 'fly_out' | 'pop_out' | 'line_out' | 'force_out' | 'fielders_choice' | 'sac_fly' | 'sac_bunt' | 'hit_by_pitch' | 'error' | 'field_error' | 'catcher_interference' | 'unknown'
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
  private apiBaseUrl: string

  constructor() {
    this.apiBaseUrl = process.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1'
  }

  // Auto-resolve all completed at-bats for a game
  async autoResolveAllCompletedAtBats(gamePk: number, game: any): Promise<void> {
    try {
      if (!game?.liveData?.plays?.allPlays) {
        console.log('No plays data available for resolution')
        return
      }

      const { allPlays } = game.liveData.plays
      console.log(`Processing ${allPlays.length} plays for resolution`)

      // Process each completed at-bat
      for (const play of allPlays) {
        if (play.about?.atBatIndex !== undefined) {
          await this.autoResolveCompletedAtBats(gamePk, play)
        }
      }
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
      const pointsEarned = isCorrect ? this.calculatePoints(actualOutcome) : 0

      return {
        id: prediction.id,
        actual_outcome: actualOutcome,
        is_correct: isCorrect,
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
    const pointsEarned = isCorrect ? this.calculatePoints(actualOutcome) : 0

    const { error } = await supabase
      .from('at_bat_predictions')
      .update({
        actual_outcome: actualOutcome,
        is_correct: isCorrect,
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

      const { type, description } = play.result
      
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

      // Try to match by type first
      if (type && outcomeMap[type]) {
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

      console.warn('Could not determine outcome from play:', { type, description })
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
      'unknown': 0
    }

    return pointValues[outcome] || 0
  }
}

// Export singleton instance
export const predictionServiceNew = new PredictionServiceNew()
