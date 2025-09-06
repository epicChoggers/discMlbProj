import { useState, useEffect } from 'react'
import { AtBatOutcome, MLBPlay, getOutcomeCategory, getOutcomePoints } from '../lib/types'
import { predictionService } from '../lib/predictionService'

interface PredictionFormProps {
  gamePk: number
  currentAtBat: MLBPlay
  onPredictionSubmitted: () => void
}

// Initial prediction categories with point values
const INITIAL_OPTIONS = [
  { value: 'strikeout', label: 'Strikeout', emoji: '❌', description: 'Three strikes', points: 2, bonusPercent: 0 },
  { value: 'walk', label: 'Walk', emoji: '🚶', description: 'Four balls', points: 3, bonusPercent: 0 },
  { value: 'home_run', label: 'Home Run', emoji: '💥', description: 'Over the fence', points: 23, bonusPercent: 50 },
  { value: 'hit', label: 'Hit', emoji: '🏃', description: 'Ball in play for a hit', points: 2, bonusPercent: 0 },
  { value: 'out', label: 'Out', emoji: '⚾', description: 'Ball in play for an out', points: 1, bonusPercent: 0 },
  { value: 'other', label: 'Other', emoji: '❓', description: 'Hit by pitch, error, etc.', points: 1, bonusPercent: 0 }
]

// Specific outcomes for each category with point values
const SPECIFIC_OUTCOMES: Record<string, { value: AtBatOutcome; label: string; emoji: string; points: number; bonusPercent: number }[]> = {
  hit: [
    { value: 'single', label: 'Single', emoji: '🏃', points: 4, bonusPercent: 0 },
    { value: 'double', label: 'Double', emoji: '🏃🏃', points: 10, bonusPercent: 25 },
    { value: 'triple', label: 'Triple', emoji: '🏃🏃🏃', points: 18, bonusPercent: 50 },
    { value: 'home_run', label: 'Home Run', emoji: '💥', points: 23, bonusPercent: 50 }
  ],
  out: [
    { value: 'groundout', label: 'Groundout', emoji: '⚾', points: 1, bonusPercent: 0 },
    { value: 'flyout', label: 'Flyout', emoji: '✈️', points: 1, bonusPercent: 0 },
    { value: 'popout', label: 'Popout', emoji: '⬆️', points: 1, bonusPercent: 0 },
    { value: 'lineout', label: 'Lineout', emoji: '📏', points: 1, bonusPercent: 0 },
    { value: 'fielders_choice', label: "Fielder's Choice", emoji: '🤔', points: 1, bonusPercent: 0 }
  ],
  other: [
    { value: 'hit_by_pitch', label: 'Hit by Pitch', emoji: '💢', points: 2, bonusPercent: 0 },
    { value: 'error', label: 'Error', emoji: '😅', points: 1, bonusPercent: 0 },
    { value: 'sacrifice', label: 'Sacrifice', emoji: '🙏', points: 1, bonusPercent: 0 },
    { value: 'other', label: 'Other', emoji: '❓', points: 1, bonusPercent: 0 }
  ]
}

export const PredictionForm = ({ gamePk, currentAtBat, onPredictionSubmitted }: PredictionFormProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<AtBatOutcome | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasAlreadyPredicted, setHasAlreadyPredicted] = useState(false)
  const [isCheckingPrediction, setIsCheckingPrediction] = useState(true)

  // Check if user has already made a prediction for this at-bat
  useEffect(() => {
    const checkExistingPrediction = async () => {
      try {
        setIsCheckingPrediction(true)
        const hasPredicted = await predictionService.hasUserPredictedForAtBat(gamePk, currentAtBat.about.atBatIndex)
        setHasAlreadyPredicted(hasPredicted)
      } catch (error) {
        console.error('Error checking existing prediction:', error)
        setHasAlreadyPredicted(false)
      } finally {
        setIsCheckingPrediction(false)
      }
    }

    checkExistingPrediction()
  }, [gamePk, currentAtBat.about.atBatIndex])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedOutcome) {
      setError('Please select a prediction')
      return
    }

    // Validate gamePk before submitting
    if (!gamePk || gamePk === null || gamePk === undefined) {
      console.error('Invalid gamePk:', gamePk)
      setError('Game information is not available. Please refresh the page.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const predictionCategory = getOutcomeCategory(selectedOutcome)
      const result = await predictionService.submitPrediction(
        gamePk,
        currentAtBat.about.atBatIndex,
        selectedOutcome,
        predictionCategory
      )

      if (result) {
        setSuccess(true)
        onPredictionSubmitted()
        
        // Reset form after a delay
        setTimeout(() => {
          setSuccess(false)
          setSelectedCategory(null)
          setSelectedOutcome(null)
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

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    setSelectedOutcome(null)
    
    // If it's a direct outcome (strikeout, walk, home_run), set it immediately
    if (['strikeout', 'walk', 'home_run'].includes(category)) {
      setSelectedOutcome(category as AtBatOutcome)
    }
  }

  const handleOutcomeSelect = (outcome: AtBatOutcome) => {
    setSelectedOutcome(outcome)
  }

  const handleBack = () => {
    setSelectedCategory(null)
    setSelectedOutcome(null)
  }

  if (success) {
    return (
      <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-green-300 text-lg mb-2">✅</div>
          <h3 className="text-green-300 font-semibold mb-1">Prediction Submitted!</h3>
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
          <div className="text-yellow-300 text-lg mb-2">⏳</div>
          <h3 className="text-yellow-300 font-semibold mb-1">Already Predicted!</h3>
          <p className="text-yellow-400 text-sm">You've already made a prediction for this at-bat. Please wait for the next at-bat.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">Make Your Prediction</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Category Selection */}
        {!selectedCategory && (
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-3">
              What type of outcome do you predict?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INITIAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCategorySelect(option.value)}
                  className="p-4 rounded-lg border-2 transition-all duration-200 border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-600"
                >
                  <div className="text-2xl mb-2">{option.emoji}</div>
                  <div className="text-sm font-medium mb-1">{option.label}</div>
                  <div className="text-xs text-gray-400 mb-1">{option.description}</div>
                  <div className="text-xs text-yellow-400 font-bold">
                    {option.points} pts
                    {option.bonusPercent > 0 && (
                      <span className="text-green-400 ml-1">+{option.bonusPercent}%</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Specific Outcome Selection */}
        {selectedCategory && !['strikeout', 'walk', 'home_run'].includes(selectedCategory) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-gray-300 text-sm font-medium">
                What specific outcome?
              </label>
              <button
                type="button"
                onClick={handleBack}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                ← Back
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPECIFIC_OUTCOMES[selectedCategory]?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOutcomeSelect(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                    selectedOutcome === option.value
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-600'
                  }`}
                >
                  <div className="text-lg mb-1">{option.emoji}</div>
                  <div className="text-xs font-medium">{option.label}</div>
                  <div className="text-xs text-yellow-400 font-bold">
                    {option.points} pts
                    {option.bonusPercent > 0 && (
                      <span className="text-green-400 ml-1">+{option.bonusPercent}%</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Prediction Summary */}
        {selectedOutcome && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
            <div className="text-blue-300 text-sm font-medium mb-1">Your Prediction:</div>
            <div className="text-white flex items-center justify-between">
              <div>
                {INITIAL_OPTIONS.find(opt => opt.value === selectedOutcome)?.emoji || 
                 Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.emoji} {' '}
                {INITIAL_OPTIONS.find(opt => opt.value === selectedOutcome)?.label || 
                 Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.label}
              </div>
              <div className="text-yellow-400 font-bold">
                {(() => {
                  const outcome = Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)
                  if (outcome) {
                    return (
                      <>
                        {outcome.points} pts
                        {outcome.bonusPercent > 0 && (
                          <span className="text-green-400 ml-1">+{outcome.bonusPercent}%</span>
                        )}
                      </>
                    )
                  }
                  // For direct outcomes like strikeout, walk, home_run
                  const points = getOutcomePoints(selectedOutcome)
                  return (
                    <>
                      {points.withBonus} pts
                      {points.bonusPercent > 0 && (
                        <span className="text-green-400 ml-1">+{points.bonusPercent}%</span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        {selectedOutcome && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Prediction'}
          </button>
        )}
      </form>

      {/* Current At-Bat Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-gray-400 text-sm">
          <div className="flex justify-between">
            <span>Batter: {currentAtBat.matchup.batter.fullName}</span>
            <span>Pitcher: {currentAtBat.matchup.pitcher.fullName}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Count: {currentAtBat.count.balls}-{currentAtBat.count.strikes}</span>
            <span>Outs: {currentAtBat.count.outs}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

