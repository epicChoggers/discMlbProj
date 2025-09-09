import { useState, useEffect } from 'react'
import { AtBatPrediction } from '../lib/types'
import { useRealtimePredictionsNew } from '../lib/useRealtimePredictions'

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
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [atBatContexts, setAtBatContexts] = useState<Record<number, any>>({})
  
  // Use the new real-time predictions hook to get ALL predictions for the game
  const { predictions, isLoading, isUpdating, error } = useRealtimePredictionsNew({
    gamePk,
    atBatIndex: undefined, // Get all predictions for the game
    onGameStateUpdate // Register for game state updates
  })


  // Load at-bat context information from game state data
  useEffect(() => {
    const loadAtBatContexts = async () => {
      if (!predictions.length) return

      console.log('Loading at-bat contexts for predictions:', predictions.map(p => p.atBatIndex))
      const contexts: Record<number, any> = {}
      
      try {
        // Get game state data which contains all plays
        const response = await fetch(`/api/game/state`)
        const data = await response.json()
        
        if (data.success && data.game?.liveData?.plays?.allPlays) {
          const allPlays = data.game.liveData.plays.allPlays
          console.log(`Found ${allPlays.length} plays in game state`)
          
          // Create contexts for each at-bat that has predictions
          const atBatIndices = [...new Set(predictions.map(p => p.atBatIndex))]
          
          for (const atBatIndex of atBatIndices) {
            const play = allPlays.find((p: any) => p.about?.atBatIndex === atBatIndex)
            if (play && play.matchup) {
              contexts[atBatIndex] = {
                matchup: {
                  batter: play.matchup.batter,
                  pitcher: play.matchup.pitcher
                }
              }
              console.log(`Found context for at-bat ${atBatIndex}:`, {
                batter: play.matchup.batter?.fullName,
                pitcher: play.matchup.pitcher?.fullName
              })
            }
          }
          
          console.log('Loaded contexts from game state:', contexts)
        } else {
          console.warn('No plays found in game state data')
        }
      } catch (error) {
        console.error('Error loading at-bat contexts from game state:', error)
      }
      
      console.log('Final contexts:', contexts)
      setAtBatContexts(contexts)
    }

    loadAtBatContexts()
  }, [predictions, gamePk])

  // Auto-resolve predictions when game state updates
  useEffect(() => {
    const autoResolvePredictions = async () => {
      if (!gamePk || !onGameStateUpdate) return

      // Register for game state updates
      const unsubscribe = onGameStateUpdate(async () => {
        try {
          console.log('Game state updated, checking for auto-resolution...')
          
          // Import services dynamically to avoid circular dependencies
          const { mlbServiceNew } = await import('../lib/mlbService')
          const { predictionServiceNew } = await import('../lib/predictionService')
          
          // Get current game state
          const currentGameState = await mlbServiceNew.getGameState()
          if (currentGameState.game && currentGameState.game.gamePk === gamePk) {
            console.log('Auto-resolving completed at-bats...')
            await predictionServiceNew.autoResolveAllCompletedAtBats(gamePk, currentGameState.game)
            console.log('Auto-resolution complete')
          }
        } catch (error) {
          console.error('Error in auto-resolution:', error)
        }
      })

      // Return cleanup function
      return unsubscribe
    }

    autoResolvePredictions()
  }, [gamePk, onGameStateUpdate])

  // Track when we've initially loaded data
  useEffect(() => {
    if (!isLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true)
    }
  }, [isLoading, hasInitiallyLoaded])

  // Only show full loading state on initial load
  if (isLoading && !hasInitiallyLoaded) {
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
    <div className={`space-y-4 ${isUpdating ? 'opacity-75' : ''} transition-opacity duration-200`}>
      {/* Subtle updating indicator */}
      {isUpdating && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center space-x-2 text-blue-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span>Updating predictions...</span>
          </div>
        </div>
      )}

      {/* All Game Predictions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            All Predictions for This Game ({predictions.length})
          </h3>
          {isUpdating && (
            <div className="flex items-center space-x-2 text-blue-400 text-sm">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Updating...</span>
            </div>
          )}
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
              .map(([atBatIndex, atBatPredictions]) => {
                const atBatContext = atBatContexts[parseInt(atBatIndex)]
                const atBatInfo = atBatContext?.matchup
                // Get batter and pitcher data from the first prediction (they should all be the same for the same at-bat)
                const prediction = atBatPredictions[0]
                // Prioritize data from prediction records over cached context
                const pitcher = prediction.pitcher || atBatInfo?.pitcher
                const batter = prediction.batter || atBatInfo?.batter
                const actualOutcome = prediction.actualOutcome
                
                // Debug logging
                console.log(`At-bat ${atBatIndex} data:`, {
                  predictionPitcher: prediction.pitcher,
                  predictionBatter: prediction.batter,
                  contextPitcher: atBatInfo?.pitcher,
                  contextBatter: atBatInfo?.batter,
                  finalPitcher: pitcher,
                  finalBatter: batter
                })
                
                return (
                  <div key={atBatIndex} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-gray-300 font-medium text-sm">
                        At-Bat #{atBatIndex} ({atBatPredictions.length} predictions)
                      </h4>
                      <div className="text-gray-500 text-xs">
                        {actualOutcome ? 
                          (atBatPredictions[0].isCorrect ? 'Correct' : 'Incorrect') : 
                          'Pending'
                        }
                      </div>
                    </div>
                    
                    {/* At-Bat Context Information */}
                    <div className="bg-gray-700/50 rounded-lg p-3 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-xs mb-1">Batter</div>
                          <div className="text-white font-medium">
                            {batter?.name || batter?.fullName || 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs mb-1">Pitcher</div>
                          <div className="text-white font-medium">
                            {pitcher?.name || pitcher?.fullName || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      {actualOutcome && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <div className="text-gray-400 text-xs mb-1">Actual Outcome</div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getOutcomeEmoji(actualOutcome)}</span>
                            <span className="text-white font-medium">
                              {getOutcomeLabel(actualOutcome)}
                            </span>
                          </div>
                        </div>
                      )}
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
                  </div>
                )
              })
            }
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

  const getUserProfilePicture = (prediction: AtBatPrediction) => {
    // Check for Discord avatar first
    if (prediction.user?.raw_user_meta_data?.avatar_url) {
      return prediction.user.raw_user_meta_data.avatar_url
    }
    // Check for Supabase auth avatar
    if (prediction.user?.avatar_url) {
      return prediction.user.avatar_url
    }
    // Return null if no avatar found
    return null
  }

  const isResolved = prediction.actualOutcome !== undefined && prediction.actualOutcome !== null
  const isCorrect = prediction.isCorrect
  const profilePicture = getUserProfilePicture(prediction)
  const displayName = getUserDisplayName(prediction)

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
          <div className="flex items-center space-x-3">
            {/* User Profile Picture */}
            <div className="flex-shrink-0">
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt={displayName}
                  className="w-8 h-8 rounded-full border-2 border-gray-600"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-8 h-8 rounded-full border-2 border-gray-600 bg-gray-600 flex items-center justify-center text-white text-sm font-medium ${profilePicture ? 'hidden' : ''}`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
            
            {/* Prediction Info */}
            <div>
              <div className="text-white font-medium">
                {getOutcomeLabel(prediction.prediction)}
              </div>
              <div className="text-gray-400 text-sm">
                by {displayName}
              </div>
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
                  <div className="text-red-400 text-sm font-medium">
                    <div>Incorrect</div>
                    <div className="text-gray-400 text-xs">
                      Actual: {getOutcomeLabel(prediction.actualOutcome!)}
                    </div>
                  </div>
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
