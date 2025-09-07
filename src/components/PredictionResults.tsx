import { useState, useEffect } from 'react'
import { AtBatPrediction, PredictionStats } from '../lib/types'
import { predictionService } from '../lib/predictionService'
import { useRealtimePredictions } from '../lib/useRealtimePredictions'

interface PredictionResultsProps {
  gamePk: number
  currentAtBatIndex?: number // Keep for backward compatibility but not used
  onGameStateUpdate?: (callback: () => void) => () => void // Function to register for game state updates
}

// Helper functions for outcome display
const getOutcomeEmoji = (outcome: string) => {
  const emojiMap: Record<string, string> = {
    // Hits
    'single': '🏃',
    'double': '🏃🏃',
    'triple': '🏃🏃🏃',
    'home_run': '💥',
    
    // Walks and Hit by Pitch
    'walk': '🚶',
    'intent_walk': '🚶',
    'hit_by_pitch': '💢',
    
    // Strikeouts
    'strikeout': '❌',
    'strike_out': '❌',
    'strikeout_double_play': '❌',
    'strikeout_triple_play': '❌',
    
    // Field Outs
    'field_out': '⚾',
    'fielders_choice': '🤔',
    'fielders_choice_out': '🤔',
    'force_out': '⚾',
    'grounded_into_double_play': '⚾',
    'grounded_into_triple_play': '⚾',
    'triple_play': '⚾',
    'double_play': '⚾',
    
    // Sacrifice Plays
    'sac_fly': '🙏',
    'sac_bunt': '🙏',
    'sac_fly_double_play': '🙏',
    'sac_bunt_double_play': '🙏',
    
    // Errors and Interference
    'field_error': '😅',
    'catcher_interf': '😅',
    'batter_interference': '😅',
    'fan_interference': '😅',
    
    // Non-plate appearance events (should not be at-bat outcomes)
    'pickoff_1b': '🏃',
    'pickoff_2b': '🏃',
    'pickoff_3b': '🏃',
    'pickoff_error_1b': '🏃',
    'pickoff_error_2b': '🏃',
    'pickoff_error_3b': '🏃',
    'stolen_base': '🏃',
    'stolen_base_2b': '🏃',
    'stolen_base_3b': '🏃',
    'stolen_base_home': '🏃',
    'caught_stealing': '🏃',
    'caught_stealing_2b': '🏃',
    'caught_stealing_3b': '🏃',
    'caught_stealing_home': '🏃',
    'wild_pitch': '⚾',
    'passed_ball': '⚾',
    'balk': '⚾',
    'forced_balk': '⚾',
    'other_advance': '🏃',
    'runner_double_play': '🏃',
    'cs_double_play': '🏃',
    'defensive_indiff': '🏃',
    'other_out': '⚾',
    
    // Administrative events
    'batter_timeout': '⏰',
    'mound_visit': '🏃',
    'no_pitch': '⚾',
    'pitcher_step_off': '⚾',
    'injury': '🏥',
    'ejection': '👋',
    'game_advisory': '📢',
    'os_ruling_pending_prior': '⏳',
    'os_ruling_pending_primary': '⏳',
    'at_bat_start': '🏃',
    'batter_turn': '🏃',
    'fielder_interference': '😅',
    'runner_interference': '😅',
    'runner_placed': '🏃',
    'pitching_substitution': '🔄',
    'offensive_substitution': '🔄',
    'defensive_substitution': '🔄',
    'defensive_switch': '🔄',
    'umpire_substitution': '🔄',
    'pitcher_switch': '🔄',
    'pickoff_caught_stealing_2b': '🏃',
    'pickoff_caught_stealing_3b': '🏃',
    'pickoff_caught_stealing_home': '🏃'
  }
  return emojiMap[outcome] || '❓'
}

const getOutcomeLabel = (outcome: string) => {
  if (!outcome || typeof outcome !== 'string') {
    return 'Unknown'
  }
  
  // Special handling for specific outcomes
  const labelMap: Record<string, string> = {
    'home_run': 'Home Run',
    'intent_walk': 'Intentional Walk',
    'hit_by_pitch': 'Hit By Pitch',
    'strike_out': 'Strike Out',
    'strikeout_double_play': 'Strikeout Double Play',
    'strikeout_triple_play': 'Strikeout Triple Play',
    'field_out': 'Field Out',
    'fielders_choice': "Fielder's Choice",
    'fielders_choice_out': "Fielder's Choice Out",
    'force_out': 'Force Out',
    'grounded_into_double_play': 'Grounded Into Double Play',
    'grounded_into_triple_play': 'Grounded Into Triple Play',
    'triple_play': 'Triple Play',
    'double_play': 'Double Play',
    'sac_fly': 'Sacrifice Fly',
    'sac_bunt': 'Sacrifice Bunt',
    'sac_fly_double_play': 'Sacrifice Fly Double Play',
    'sac_bunt_double_play': 'Sacrifice Bunt Double Play',
    'field_error': 'Field Error',
    'catcher_interf': 'Catcher Interference',
    'batter_interference': 'Batter Interference',
    'fan_interference': 'Fan Interference',
    'pickoff_1b': 'Pickoff 1B',
    'pickoff_2b': 'Pickoff 2B',
    'pickoff_3b': 'Pickoff 3B',
    'pickoff_error_1b': 'Pickoff Error 1B',
    'pickoff_error_2b': 'Pickoff Error 2B',
    'pickoff_error_3b': 'Pickoff Error 3B',
    'stolen_base': 'Stolen Base',
    'stolen_base_2b': 'Stolen Base 2B',
    'stolen_base_3b': 'Stolen Base 3B',
    'stolen_base_home': 'Stolen Base Home',
    'caught_stealing': 'Caught Stealing',
    'caught_stealing_2b': 'Caught Stealing 2B',
    'caught_stealing_3b': 'Caught Stealing 3B',
    'caught_stealing_home': 'Caught Stealing Home',
    'wild_pitch': 'Wild Pitch',
    'passed_ball': 'Passed Ball',
    'forced_balk': 'Disengagement Violation',
    'other_advance': 'Other Advance',
    'runner_double_play': 'Runner Double Play',
    'cs_double_play': 'Caught Stealing Double Play',
    'defensive_indiff': 'Defensive Indifference',
    'other_out': 'Runner Out',
    'batter_timeout': 'Batter Timeout',
    'mound_visit': 'Mound Visit',
    'no_pitch': 'No Pitch',
    'pitcher_step_off': 'Pitcher Step Off',
    'game_advisory': 'Game Advisory',
    'os_ruling_pending_prior': 'Official Scorer Ruling Pending',
    'os_ruling_pending_primary': 'Official Scorer Ruling Pending',
    'at_bat_start': 'At Bat Start',
    'batter_turn': 'Batter Turn',
    'fielder_interference': 'Fielder Interference',
    'runner_interference': 'Runner Interference',
    'runner_placed': 'Runner Placed',
    'pitching_substitution': 'Pitching Substitution',
    'offensive_substitution': 'Offensive Substitution',
    'defensive_substitution': 'Defensive Substitution',
    'defensive_switch': 'Defensive Switch',
    'umpire_substitution': 'Umpire Substitution',
    'pitcher_switch': 'Pitcher Switch',
    'pickoff_caught_stealing_2b': 'Pickoff Caught Stealing 2B',
    'pickoff_caught_stealing_3b': 'Pickoff Caught Stealing 3B',
    'pickoff_caught_stealing_home': 'Pickoff Caught Stealing Home'
  }
  
  return labelMap[outcome] || outcome.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

export const PredictionResults = ({ gamePk, onGameStateUpdate }: PredictionResultsProps) => {
  const [stats, setStats] = useState<PredictionStats | null>(null)
  
  // Use the new real-time predictions hook to get ALL predictions for the game
  const { predictions, isLoading, isUpdating, error } = useRealtimePredictions({
    gamePk,
    atBatIndex: undefined, // Get all predictions for the game
    onGameStateUpdate // Register for game state updates
  })

  useEffect(() => {
    const loadAdditionalData = async () => {
      try {
        // Load user stats
        const statsData = await predictionService.getUserPredictionStats()
        setStats(statsData)
      } catch (error) {
        console.error('Error loading additional prediction data:', error)
      }
    }

    loadAdditionalData()
  }, [gamePk])

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-red-300 text-lg mb-2">⚠️</div>
          <h3 className="text-red-300 font-semibold mb-1">Error Loading Predictions</h3>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* User Stats */}
      {stats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.totalPoints}</div>
              <div className="text-gray-400 text-sm">Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{stats.exactPredictions}</div>
              <div className="text-gray-400 text-sm">Exact (3pts)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.categoryPredictions}</div>
              <div className="text-gray-400 text-sm">Category (1pt)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.streak}</div>
              <div className="text-gray-400 text-sm">Streak</div>
            </div>
          </div>
        </div>
      )}

      {/* All Game Predictions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            All Predictions for This Game ({predictions.length})
          </h3>
          <div className="flex items-center space-x-3">
            {isUpdating && (
              <div className="flex items-center space-x-2 text-blue-400 text-sm">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Updating...</span>
              </div>
            )}
            <button
              onClick={async () => {
                try {
                  const { mlbService } = await import('../lib/mlbService')
                  const { predictionService } = await import('../lib/predictionService')
                  
                  // Get current game state
                  const currentGameState = await mlbService.getGameState()
                  if (currentGameState.game && currentGameState.game.gamePk) {
                    console.log('Manually triggering resolution of all completed at-bats...')
                    await predictionService.autoResolveAllCompletedAtBats(currentGameState.game.gamePk, currentGameState.game)
                    console.log('Manual resolution complete')
                  }
                } catch (error) {
                  console.error('Error manually resolving predictions:', error)
                }
              }}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
            >
              Resolve All
            </button>
            <button
              onClick={() => {
                console.log('Current predictions data:', predictions)
                predictions.forEach((pred, index) => {
                  console.log(`Prediction ${index}:`, {
                    id: pred.id,
                    atBatIndex: pred.atBatIndex,
                    prediction: pred.prediction,
                    actualOutcome: pred.actualOutcome,
                    isCorrect: pred.isCorrect,
                    pointsEarned: pred.pointsEarned,
                    resolvedAt: pred.resolvedAt
                  })
                })
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              Debug Data
            </button>
          </div>
        </div>
        
        {predictions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🤔</div>
            <p>No predictions yet for this game</p>
            <p className="text-sm">Be the first to make a prediction!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group predictions by at-bat index */}
            {Object.entries(
              predictions.reduce((groups, prediction) => {
                const atBatIndex = prediction.atBatIndex
                if (!groups[atBatIndex]) {
                  groups[atBatIndex] = []
                }
                groups[atBatIndex].push(prediction)
                return groups
              }, {} as Record<number, AtBatPrediction[]>)
            )
              .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by at-bat index descending (most recent first)
              .map(([atBatIndex, atBatPredictions]) => (
                <div key={atBatIndex} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-gray-300 font-medium text-sm">
                      At-Bat #{atBatIndex} ({atBatPredictions.length} predictions)
                    </h4>
                    <div className="text-gray-500 text-xs">
                      {atBatPredictions[0].actualOutcome ? 
                        (atBatPredictions[0].isCorrect ? 'Correct' : 'Incorrect') : 
                        'Pending'
                      }
                    </div>
                  </div>
                  <div className="space-y-2">
                    {atBatPredictions.map((prediction, index) => (
                      <div 
                        key={prediction.id} 
                        className={`transition-all duration-300 ${
                          isUpdating ? 'opacity-90' : 'opacity-100'
                        }`}
                        style={{
                          animationDelay: `${index * 50}ms`
                        }}
                      >
                        <PredictionCard prediction={prediction} />
                      </div>
                    ))}
                  </div>
                  
                  {/* Show the correct outcome after predictions if resolved */}
                  {atBatPredictions[0].actualOutcome && (
                    <div className="mt-4 p-4 bg-blue-900/30 border border-blue-600 rounded-lg">
                      <div className="flex items-center justify-center space-x-3">
                        <div className="text-blue-300 text-sm font-medium">Correct Outcome:</div>
                        <div className="text-2xl">{getOutcomeEmoji(atBatPredictions[0].actualOutcome)}</div>
                        <div className="text-blue-100 font-semibold text-lg">
                          {getOutcomeLabel(atBatPredictions[0].actualOutcome)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface PredictionCardProps {
  prediction: AtBatPrediction
}

const PredictionCard = ({ prediction }: PredictionCardProps) => {

  const getUserDisplayName = (prediction: AtBatPrediction) => {
    if (prediction.user?.raw_user_meta_data?.preferred_username) {
      return prediction.user.raw_user_meta_data.preferred_username
    }
    if (prediction.user?.raw_user_meta_data?.full_name) {
      return prediction.user.raw_user_meta_data.full_name
    }
    if (prediction.user?.email && typeof prediction.user.email === 'string') {
      return prediction.user.email.split('@')[0]
    }
    return 'Anonymous'
  }

  const isResolved = prediction.actualOutcome !== undefined && prediction.actualOutcome !== null
  const isCorrect = prediction.isCorrect

  return (
    <div className={`p-4 rounded-lg border transition-all duration-500 ${
      isResolved 
        ? isCorrect 
          ? 'bg-green-900/20 border-green-700' 
          : 'bg-red-900/20 border-red-700'
        : 'bg-gray-700 border-gray-600'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getOutcomeEmoji(prediction.prediction)}</div>
          <div>
            <div className="text-white font-medium">
              {getOutcomeLabel(prediction.prediction)}
            </div>
            <div className="text-gray-400 text-sm">
              by {getUserDisplayName(prediction)}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          {isResolved ? (
            <div className="flex items-center space-x-2">
              {isCorrect ? (
                <>
                  <span className="text-green-400 text-lg">✅</span>
                  <div className="text-green-400 text-sm font-medium">
                    <div>Correct! +{prediction.pointsEarned || 0}pts</div>
                    {prediction.streakBonus && prediction.streakBonus > 0 && (
                      <div className="text-yellow-400 text-xs">
                        🔥 {prediction.streakCount} streak (+{prediction.streakBonus} bonus)
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-red-400 text-lg">❌</span>
                  <span className="text-red-400 text-sm font-medium">
                    {getOutcomeLabel(prediction.actualOutcome!)}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">
              Pending...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
