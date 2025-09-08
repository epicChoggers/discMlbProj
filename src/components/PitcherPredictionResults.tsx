import { useState, useEffect } from 'react'
import { PitcherPrediction } from '../lib/types'
import { pitcherPredictionService } from '../lib/pitcherPredictionService'
import { getPlayerHeadshot } from '../lib/mlbHeadshots'

interface PitcherPredictionResultsProps {
  gamePk?: number
  pitcherId?: number
}

export const PitcherPredictionResults = ({ gamePk, pitcherId }: PitcherPredictionResultsProps) => {
  const [predictions, setPredictions] = useState<PitcherPrediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await pitcherPredictionService.getPitcherPredictions(gamePk, pitcherId)
        setPredictions(data)
      } catch (err) {
        console.error('Error fetching pitcher predictions:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch predictions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPredictions()

    // Subscribe to real-time updates
    const subscription = pitcherPredictionService.subscribeToPitcherPredictions(
      gamePk,
      (updatedPredictions) => {
        setPredictions(updatedPredictions)
      },
      pitcherId
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [gamePk, pitcherId])

  const formatIp = (ip: number) => {
    const whole = Math.floor(ip)
    const fractional = ip - whole
    if (fractional === 0) {
      return `${whole}.0`
    } else if (Math.abs(fractional - 0.33) < 0.01) {
      return `${whole}.1`
    } else if (Math.abs(fractional - 0.67) < 0.01) {
      return `${whole}.2`
    }
    return ip.toFixed(1)
  }

  const getPredictionAccuracy = (prediction: PitcherPrediction) => {
    if (!prediction.actualIp || !prediction.actualHits || !prediction.actualEarnedRuns || 
        !prediction.actualWalks || !prediction.actualStrikeouts) {
      return null
    }

    const ipDiff = Math.abs(prediction.predictedIp - prediction.actualIp)
    const hitsDiff = Math.abs(prediction.predictedHits - prediction.actualHits)
    const erDiff = Math.abs(prediction.predictedEarnedRuns - prediction.actualEarnedRuns)
    const walksDiff = Math.abs(prediction.predictedWalks - prediction.actualWalks)
    const kDiff = Math.abs(prediction.predictedStrikeouts - prediction.actualStrikeouts)

    const totalDiff = ipDiff + hitsDiff + erDiff + walksDiff + kDiff
    const accuracy = Math.max(0, 100 - (totalDiff * 10)) // Rough accuracy percentage

    return {
      accuracy: Math.round(accuracy),
      ipDiff,
      hitsDiff,
      erDiff,
      walksDiff,
      kDiff
    }
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Loading pitcher predictions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    )
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">⚾</div>
          <h3 className="text-white text-lg font-semibold mb-2">No Pitcher Predictions Yet</h3>
          <p className="text-gray-400 text-sm">
            Be the first to predict the pitcher's line for this game!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">
        Pitcher Predictions ({predictions.length})
      </h3>
      
      <div className="space-y-3">
        {predictions.map((prediction) => {
          const accuracy = getPredictionAccuracy(prediction)
          const isResolved = prediction.resolvedAt !== null

          return (
            <div
              key={prediction.id}
              className={`bg-gray-700 rounded-lg p-4 ${
                isResolved ? 'border-l-4 border-green-500' : 'border-l-4 border-yellow-500'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {/* User Avatar */}
                    {prediction.user?.avatar_url ? (
                      <img
                        src={prediction.user.avatar_url}
                        alt={prediction.user.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-gray-300 text-sm font-medium">
                          {prediction.user?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    
                    {/* Pitcher Headshot */}
                    <div className="relative">
                      <img
                        src={getPlayerHeadshot(prediction.pitcherId, { resolution: 120 })}
                        alt={prediction.pitcherName}
                        className="w-8 h-8 rounded-full object-cover border border-gray-500"
                        onError={(e) => {
                          // Hide image and show fallback
                          const target = e.currentTarget as HTMLImageElement
                          target.style.display = 'none'
                          const nextElement = target.nextElementSibling as HTMLElement
                          if (nextElement) {
                            nextElement.style.display = 'flex'
                          }
                        }}
                      />
                      <div 
                        className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm hidden"
                      >
                        ⚾
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-white font-medium">{prediction.user?.username || 'Unknown User'}</div>
                    <div className="text-gray-400 text-sm">{prediction.pitcherName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">
                    {new Date(prediction.createdAt).toLocaleString()}
                  </div>
                  {isResolved && prediction.pointsEarned !== undefined && (
                    <div className="text-yellow-400 font-bold">
                      {prediction.pointsEarned} pts
                    </div>
                  )}
                </div>
              </div>

              {/* Prediction Stats */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-white font-semibold">{formatIp(prediction.predictedIp)}</div>
                  <div className="text-gray-400 text-xs">IP</div>
                  {isResolved && accuracy && (
                    <div className={`text-xs ${
                      accuracy.ipDiff === 0 ? 'text-green-400' : 
                      accuracy.ipDiff <= 0.2 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {accuracy.ipDiff === 0 ? '✓' : `±${accuracy.ipDiff.toFixed(1)}`}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-white font-semibold">{prediction.predictedHits}</div>
                  <div className="text-gray-400 text-xs">H</div>
                  {isResolved && accuracy && (
                    <div className={`text-xs ${
                      accuracy.hitsDiff === 0 ? 'text-green-400' : 
                      accuracy.hitsDiff <= 1 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {accuracy.hitsDiff === 0 ? '✓' : `±${accuracy.hitsDiff}`}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-white font-semibold">{prediction.predictedEarnedRuns}</div>
                  <div className="text-gray-400 text-xs">ER</div>
                  {isResolved && accuracy && (
                    <div className={`text-xs ${
                      accuracy.erDiff === 0 ? 'text-green-400' : 
                      accuracy.erDiff <= 1 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {accuracy.erDiff === 0 ? '✓' : `±${accuracy.erDiff}`}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-white font-semibold">{prediction.predictedWalks}</div>
                  <div className="text-gray-400 text-xs">BB</div>
                  {isResolved && accuracy && (
                    <div className={`text-xs ${
                      accuracy.walksDiff === 0 ? 'text-green-400' : 
                      accuracy.walksDiff <= 1 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {accuracy.walksDiff === 0 ? '✓' : `±${accuracy.walksDiff}`}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-white font-semibold">{prediction.predictedStrikeouts}</div>
                  <div className="text-gray-400 text-xs">K</div>
                  {isResolved && accuracy && (
                    <div className={`text-xs ${
                      accuracy.kDiff === 0 ? 'text-green-400' : 
                      accuracy.kDiff <= 2 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {accuracy.kDiff === 0 ? '✓' : `±${accuracy.kDiff}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Actual Stats (if resolved) */}
              {isResolved && (
                <div className="border-t border-gray-600 pt-3">
                  <div className="text-sm text-gray-400 mb-2">Actual Line:</div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="text-center">
                      <div className="text-white font-semibold">{formatIp(prediction.actualIp!)}</div>
                      <div className="text-gray-400 text-xs">IP</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-semibold">{prediction.actualHits}</div>
                      <div className="text-gray-400 text-xs">H</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-semibold">{prediction.actualEarnedRuns}</div>
                      <div className="text-gray-400 text-xs">ER</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-semibold">{prediction.actualWalks}</div>
                      <div className="text-gray-400 text-xs">BB</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-semibold">{prediction.actualStrikeouts}</div>
                      <div className="text-gray-400 text-xs">K</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="mt-3 pt-3 border-t border-gray-600">
                <div className="flex items-center justify-between">
                  <div className={`text-sm font-medium ${
                    isResolved ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {isResolved ? '✅ Resolved' : '⏳ Pending'}
                  </div>
                  {accuracy && (
                    <div className="text-sm text-gray-400">
                      {accuracy.accuracy}% accuracy
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
