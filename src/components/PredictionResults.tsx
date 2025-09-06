import { useState, useEffect } from 'react'
import { AtBatPrediction, PredictionStats } from '../lib/types'
import { predictionService } from '../lib/predictionService'

interface PredictionResultsProps {
  gamePk: number
  currentAtBatIndex?: number // Make optional to show all predictions for a game
}

export const PredictionResults = ({ gamePk, currentAtBatIndex }: PredictionResultsProps) => {
  const [predictions, setPredictions] = useState<AtBatPrediction[]>([])
  const [previousPredictions, setPreviousPredictions] = useState<AtBatPrediction[]>([])
  const [stats, setStats] = useState<PredictionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (isInitialLoad) {
        setIsLoading(true)
      }
      try {
        let predictionsData: AtBatPrediction[] = []
        
        // For real games, filter by currentAtBatIndex if specified
        if (currentAtBatIndex !== undefined) {
          // Get predictions for specific at-bat in real games
          predictionsData = await predictionService.getAtBatPredictions(gamePk, currentAtBatIndex)
          
          // Get previous at-bat predictions
          const previousData = await predictionService.getPreviousAtBatPredictions(gamePk, currentAtBatIndex)
          setPreviousPredictions(previousData)
        } else {
          // Get all predictions for the game when no specific at-bat
          predictionsData = await predictionService.getUserGamePredictions(gamePk)
          setPreviousPredictions([])
        }
        
        const statsData = await predictionService.getUserPredictionStats()
        setPredictions(predictionsData)
        setStats(statsData)
      } catch (error) {
        console.error('Error loading prediction data:', error)
      } finally {
        if (isInitialLoad) {
          setIsLoading(false)
          setIsInitialLoad(false)
        }
      }
    }

    loadData()

    // Subscribe to real-time updates
    const subscription = predictionService.subscribeToPredictions(gamePk, async (newPredictions) => {
      // Show subtle updating indicator
      setIsUpdating(true)
      
      try {
        setPredictions(newPredictions)
        
        // Also update previous at-bat predictions if we have a current at-bat index
        if (currentAtBatIndex !== undefined) {
          const previousData = await predictionService.getPreviousAtBatPredictions(gamePk, currentAtBatIndex)
          setPreviousPredictions(previousData)
        }
        
        // Update stats in real-time
        const updatedStats = await predictionService.getUserPredictionStats()
        setStats(updatedStats)
      } catch (error) {
        console.error('Error updating predictions:', error)
      } finally {
        // Hide updating indicator after a brief delay
        setTimeout(() => setIsUpdating(false), 500)
      }
    }, currentAtBatIndex)

    return () => {
      subscription.unsubscribe()
    }
  }, [gamePk, currentAtBatIndex, isInitialLoad])

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

      {/* Current At-Bat Predictions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">
            {currentAtBatIndex !== undefined 
              ? `Predictions for This At-Bat (${predictions.length})`
              : `All Predictions for This Game (${predictions.length})`
            }
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
            <p>No predictions yet {currentAtBatIndex !== undefined ? 'for this at-bat' : 'for this game'}</p>
            <p className="text-sm">Be the first to make a prediction!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {predictions.map((prediction, index) => (
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
        )}
      </div>

      {/* Previous At-Bat Predictions */}
      {previousPredictions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold">
              Predictions for Last At-Bat ({previousPredictions.length})
            </h3>
            {isUpdating && (
              <div className="flex items-center space-x-2 text-blue-400 text-sm">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Updating...</span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {previousPredictions.map((prediction, index) => (
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
      )}
    </div>
  )
}

interface PredictionCardProps {
  prediction: AtBatPrediction
}

const PredictionCard = ({ prediction }: PredictionCardProps) => {
  const [isResolving, setIsResolving] = useState(false)

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

  const isResolved = prediction.actualOutcome !== undefined
  const isCorrect = prediction.isCorrect

  // Show resolving state briefly when prediction gets resolved
  useEffect(() => {
    if (isResolved && !isResolving) {
      setIsResolving(true)
      const timer = setTimeout(() => setIsResolving(false), 2000)
      return () => clearTimeout(timer)
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
