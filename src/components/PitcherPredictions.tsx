import { useState, useEffect } from 'react'
import { MLBPitcher, MLBGame } from '../lib/types'
import { pitcherPredictionService } from '../lib/pitcherPredictionService'
import { PitcherPredictionForm } from './PitcherPredictionForm'
import { PitcherPredictionResults } from './PitcherPredictionResults'
import { getPlayerHeadshot } from '../lib/mlbHeadshots'

interface PitcherPredictionsProps {
  gamePk?: number
  game?: MLBGame
}

export const PitcherPredictions = ({ gamePk, game }: PitcherPredictionsProps) => {
  const [pitcher, setPitcher] = useState<MLBPitcher | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  useEffect(() => {
    const fetchPitcherInfo = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const pitcherData = await pitcherPredictionService.getPitcherInfo()
        setPitcher(pitcherData)
      } catch (err) {
        console.error('Error fetching pitcher info:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch pitcher information')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPitcherInfo()
  }, [gamePk])

  // Track when we've initially loaded data
  useEffect(() => {
    if (!isLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true)
    }
  }, [isLoading, hasInitiallyLoaded])

  const handlePredictionSubmitted = () => {
    // Trigger a refresh of the results
    setRefreshKey(prev => prev + 1)
  }

  // Only show full loading state on initial load
  if (isLoading && !hasInitiallyLoaded) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-white text-lg font-semibold mb-2">Loading Pitcher Information</h3>
          <p className="text-gray-400 text-sm">Finding the projected starting pitcher...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-red-300 text-lg mb-2">⚠️</div>
          <h3 className="text-red-300 font-semibold mb-2">Unable to Load Pitcher Data</h3>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!pitcher) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">⚾</div>
          <h3 className="text-white text-lg font-semibold mb-2">No Pitcher Information Available</h3>
          <p className="text-gray-400 text-sm">
            We couldn't find projected pitcher information for this game.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${isLoading ? 'opacity-75' : ''} transition-opacity duration-200`}>
      {/* Subtle updating indicator */}
      {isLoading && hasInitiallyLoaded && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center space-x-2 text-blue-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span>Updating pitcher information...</span>
          </div>
        </div>
      )}
      {/* Pitcher Info Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={getPlayerHeadshot(pitcher.id, { resolution: 240 })}
                alt={pitcher.fullName}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-600"
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = 'none'
                  const nextElement = target.nextElementSibling as HTMLElement
                  if (nextElement) {
                    nextElement.style.display = 'flex'
                  }
                }}
              />
              <div 
                className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-3xl hidden"
              >
                ⚾
              </div>
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">Pitcher Predictions</h2>
              <p className="text-gray-400 text-sm">Predict the starting pitcher's performance</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-medium">{pitcher.fullName}</div>
            <div className="text-gray-400 text-sm">#{pitcher.primaryNumber}</div>
          </div>
        </div>
      </div>

      {/* Prediction Form */}
      <PitcherPredictionForm
        gamePk={gamePk}
        pitcher={pitcher}
        game={game}
        onPredictionSubmitted={handlePredictionSubmitted}
      />

      {/* Prediction Results */}
      <PitcherPredictionResults
        key={refreshKey}
        gamePk={gamePk}
        pitcherId={pitcher.id}
      />
    </div>
  )
}
