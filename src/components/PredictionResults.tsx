import { useState, useEffect } from 'react'
import { AtBatPrediction, PredictionStats } from '../lib/types'
import { predictionService } from '../lib/predictionService'
import { useRealtimePredictions } from '../lib/useRealtimePredictions'

interface PredictionResultsProps {
  gamePk: number
  currentAtBatIndex?: number // Keep for backward compatibility but not used
}

export const PredictionResults = ({ gamePk }: PredictionResultsProps) => {
  const [stats, setStats] = useState<PredictionStats | null>(null)
  
  // Use the new real-time predictions hook to get ALL predictions for the game
  const { predictions, isLoading, isUpdating, error } = useRealtimePredictions({
    gamePk,
    atBatIndex: undefined // Get all predictions for the game
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
                      {atBatPredictions[0].actualOutcome ? 'Resolved' : 'Pending'}
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
  const [isResolving, setIsResolving] = useState(false)
  const [hasShownResolving, setHasShownResolving] = useState(false)

  const getOutcomeEmoji = (outcome: string) => {
    const emojiMap: Record<string, string> = {
      'single': '🏃',
      'double': '🏃🏃',
      'triple': '🏃🏃🏃',
      'home_run': '💥',
      'walk': '🚶',
      'strikeout': '❌',
      'groundout': '⚾',
      'flyout': '✈️',
      'popout': '⬆️',
      'lineout': '📏',
      'fielders_choice': '🤔',
      'error': '😅',
      'hit_by_pitch': '💢',
      'sacrifice': '🙏',
      'other': '❓'
    }
    return emojiMap[outcome] || '❓'
  }

  const getOutcomeLabel = (outcome: string) => {
    if (!outcome || typeof outcome !== 'string') {
      return 'Unknown'
    }
    return outcome.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

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

  // Show resolving state briefly when prediction gets resolved for the first time
  useEffect(() => {
    if (isResolved && !hasShownResolving) {
      setIsResolving(true)
      setHasShownResolving(true)
      const timer = setTimeout(() => setIsResolving(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isResolved, hasShownResolving])

  // Reset resolving state when prediction becomes unresolved (shouldn't happen but safety check)
  useEffect(() => {
    if (!isResolved && isResolving) {
      setIsResolving(false)
    }
  }, [isResolved, isResolving])

  return (
    <div className={`p-4 rounded-lg border transition-all duration-500 ${
      isResolving
        ? 'bg-yellow-900/20 border-yellow-700 animate-pulse'
        : isResolved 
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
          {isResolving ? (
            <div className="flex items-center space-x-2">
              <span className="text-yellow-400 text-lg animate-spin">⚡</span>
              <span className="text-yellow-400 text-sm font-medium">Resolving...</span>
            </div>
          ) : isResolved ? (
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
