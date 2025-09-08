import { useState, useEffect } from 'react'
import { MLBPitcher } from '../lib/types'
import { pitcherPredictionService } from '../lib/pitcherPredictionService'

interface PitcherPredictionFormProps {
  gamePk?: number
  pitcher: MLBPitcher
  onPredictionSubmitted: () => void
}

export const PitcherPredictionForm = ({ gamePk, pitcher, onPredictionSubmitted }: PitcherPredictionFormProps) => {
  const [formData, setFormData] = useState({
    predictedIp: 6.0,
    predictedHits: 5,
    predictedEarnedRuns: 2,
    predictedWalks: 2,
    predictedStrikeouts: 6
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasAlreadyPredicted, setHasAlreadyPredicted] = useState(false)
  const [isCheckingPrediction, setIsCheckingPrediction] = useState(true)

  // Check if user has already made a prediction for this pitcher
  useEffect(() => {
    const checkExistingPrediction = async () => {
      try {
        setIsCheckingPrediction(true)
        const hasPredicted = await pitcherPredictionService.hasUserPredictedForPitcher(gamePk, pitcher.id)
        setHasAlreadyPredicted(hasPredicted)
      } catch (error) {
        console.error('Error checking existing prediction:', error)
        setHasAlreadyPredicted(false)
      } finally {
        setIsCheckingPrediction(false)
      }
    }

    checkExistingPrediction()
  }, [gamePk, pitcher.id])

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setFormData(prev => ({
        ...prev,
        [field]: numValue
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsSubmitting(true)
    setError(null)

    try {
      // If gamePk is not provided, we need to get it from the pitcher info
      let actualGamePk = gamePk
      if (!actualGamePk) {
        // Get today's game info to get the gamePk
        const { game } = await pitcherPredictionService.getPitcherInfoWithGame()
        actualGamePk = game.gamePk
      }

      if (!actualGamePk) {
        throw new Error('Unable to determine game ID for prediction')
      }

      const result = await pitcherPredictionService.submitPitcherPrediction(
        actualGamePk,
        pitcher.id,
        pitcher.fullName,
        formData.predictedIp,
        formData.predictedHits,
        formData.predictedEarnedRuns,
        formData.predictedWalks,
        formData.predictedStrikeouts
      )

      if (result) {
        setSuccess(true)
        setHasAlreadyPredicted(true)
        onPredictionSubmitted()
        
        // Reset form after a delay
        setTimeout(() => {
          setSuccess(false)
        }, 2000)
      } else {
        setError('Failed to submit prediction')
      }
    } catch (err) {
      console.error('Prediction submission error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit prediction'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }


  if (success) {
    return (
      <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-green-300 text-lg mb-2">✅</div>
          <h3 className="text-green-300 font-semibold mb-1">Pitcher Prediction Submitted!</h3>
          <p className="text-green-400 text-sm">Good luck with your prediction!</p>
        </div>
      </div>
    )
  }

  if (isCheckingPrediction) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Checking prediction status...</p>
        </div>
      </div>
    )
  }

  if (hasAlreadyPredicted) {
    return (
      <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-yellow-300 text-lg mb-2">✅</div>
          <h3 className="text-yellow-300 font-semibold mb-1">Already Predicted!</h3>
          <p className="text-yellow-400 text-sm">You have already made a prediction for {pitcher.fullName} in this game.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">Predict {pitcher.fullName}'s Line</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pitcher Info */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">⚾</div>
            <div>
              <div className="text-white font-medium">{pitcher.fullName}</div>
              <div className="text-gray-400 text-sm">#{pitcher.primaryNumber} • {pitcher.currentTeam.name}</div>
            </div>
          </div>
        </div>

        {/* Prediction Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Innings Pitched */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Innings Pitched (IP)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="9.2"
                value={formData.predictedIp}
                onChange={(e) => handleInputChange('predictedIp', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="6.0"
              />
              <div className="absolute right-3 top-2 text-gray-400 text-sm">IP</div>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              Use decimals like 6.1 (6⅓), 6.2 (6⅔), 7.0 (7)
            </p>
          </div>

          {/* Hits */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Hits Allowed
            </label>
            <input
              type="number"
              min="0"
              value={formData.predictedHits}
              onChange={(e) => handleInputChange('predictedHits', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="5"
            />
          </div>

          {/* Earned Runs */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Earned Runs
            </label>
            <input
              type="number"
              min="0"
              value={formData.predictedEarnedRuns}
              onChange={(e) => handleInputChange('predictedEarnedRuns', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="2"
            />
          </div>

          {/* Walks */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Walks
            </label>
            <input
              type="number"
              min="0"
              value={formData.predictedWalks}
              onChange={(e) => handleInputChange('predictedWalks', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="2"
            />
          </div>

          {/* Strikeouts */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Strikeouts
            </label>
            <input
              type="number"
              min="0"
              value={formData.predictedStrikeouts}
              onChange={(e) => handleInputChange('predictedStrikeouts', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="6"
            />
          </div>
        </div>

        {/* Prediction Summary */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="text-blue-300 text-sm font-medium mb-2">Your Prediction:</div>
          <div className="text-white grid grid-cols-5 gap-2 text-sm">
            <div className="text-center">
              <div className="font-semibold">{formData.predictedIp}</div>
              <div className="text-gray-400 text-xs">IP</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{formData.predictedHits}</div>
              <div className="text-gray-400 text-xs">H</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{formData.predictedEarnedRuns}</div>
              <div className="text-gray-400 text-xs">ER</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{formData.predictedWalks}</div>
              <div className="text-gray-400 text-xs">BB</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{formData.predictedStrikeouts}</div>
              <div className="text-gray-400 text-xs">K</div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Pitcher Prediction'}
        </button>
      </form>

      {/* Scoring Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-gray-400 text-xs">
          <div className="font-medium mb-1">Scoring:</div>
          <div>• Exact IP: 10 pts • Within 0.1 IP: 5 pts • Within 0.2 IP: 2 pts</div>
          <div>• Exact Hits: 8 pts • Within 1: 4 pts • Within 2: 2 pts</div>
          <div>• Exact ER: 10 pts • Within 1: 5 pts</div>
          <div>• Exact BB: 6 pts • Within 1: 3 pts</div>
          <div>• Exact K: 8 pts • Within 2: 4 pts • Within 4: 2 pts</div>
        </div>
      </div>
    </div>
  )
}
