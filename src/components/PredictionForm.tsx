import { useState, useEffect } from 'react'
import { AtBatOutcome, MLBPlay, getOutcomeCategory } from '../lib/types'
import { predictionServiceNew } from '../lib/predictionService'

interface PredictionFormProps {
  gamePk: number
  currentAtBat: MLBPlay
  onPredictionSubmitted: () => void
}

// Main prediction categories - simplified to three options
const MAIN_CATEGORIES = [
  { 
    value: 'out', 
    label: 'Out', 
    emoji: '⚾', 
    description: 'Batter makes an out',
    basePoints: 1,
    category: 'out'
  },
  { 
    value: 'hit', 
    label: 'Hit', 
    emoji: '🏃', 
    description: 'Batter gets a hit',
    basePoints: 2,
    category: 'hit'
  },
  { 
    value: 'walk', 
    label: 'Walk', 
    emoji: '🚶', 
    description: 'Batter walks or strikes out',
    basePoints: 3,
    category: 'walk'
  }
]

// Specific outcomes for each main category with higher point values
const SPECIFIC_OUTCOMES: Record<string, { value: AtBatOutcome; label: string; emoji: string; points: number; bonusPercent: number; description: string }[]> = {
  out: [
    { value: 'field_out', label: 'Field Out', emoji: '⚾', points: 1, bonusPercent: 0, description: 'Generic field out' },
    { value: 'fielders_choice', label: "Fielder's Choice", emoji: '🤔', points: 1, bonusPercent: 0, description: 'Fielder chooses to get another out' },
    { value: 'fielders_choice_out', label: "Fielder's Choice Out", emoji: '🤔', points: 1, bonusPercent: 0, description: 'Fielder\'s choice resulting in out' },
    { value: 'force_out', label: 'Force Out', emoji: '⚾', points: 1, bonusPercent: 0, description: 'Force play out' },
    { value: 'grounded_into_double_play', label: 'Grounded Into DP', emoji: '⚾', points: 1, bonusPercent: 0, description: 'Double play groundout' },
    { value: 'grounded_into_triple_play', label: 'Grounded Into TP', emoji: '⚾', points: 1, bonusPercent: 0, description: 'Triple play groundout' },
    { value: 'triple_play', label: 'Triple Play', emoji: '⚾', points: 1, bonusPercent: 0, description: 'Triple play' },
    { value: 'double_play', label: 'Double Play', emoji: '⚾', points: 1, bonusPercent: 0, description: 'Double play' }
  ],
  hit: [
    { value: 'single', label: 'Single', emoji: '🏃', points: 6, bonusPercent: 20, description: 'One base hit' },
    { value: 'double', label: 'Double', emoji: '🏃🏃', points: 15, bonusPercent: 50, description: 'Two base hit' },
    { value: 'triple', label: 'Triple', emoji: '🏃🏃🏃', points: 27, bonusPercent: 80, description: 'Three base hit' },
    { value: 'home_run', label: 'Home Run', emoji: '💥', points: 40, bonusPercent: 100, description: 'Over the fence' }
  ],
  walk: [
    { value: 'walk', label: 'Walk', emoji: '🚶', points: 4, bonusPercent: 10, description: 'Four balls' },
    { value: 'intent_walk', label: 'Intentional Walk', emoji: '🚶', points: 4, bonusPercent: 10, description: 'Intentional walk' },
    { value: 'strikeout', label: 'Strikeout', emoji: '❌', points: 3, bonusPercent: 10, description: 'Three strikes' },
    { value: 'strike_out', label: 'Strike Out', emoji: '❌', points: 3, bonusPercent: 10, description: 'Three strikes' },
    { value: 'strikeout_double_play', label: 'Strikeout DP', emoji: '❌', points: 3, bonusPercent: 10, description: 'Strikeout double play' },
    { value: 'strikeout_triple_play', label: 'Strikeout TP', emoji: '❌', points: 3, bonusPercent: 10, description: 'Strikeout triple play' },
    { value: 'hit_by_pitch', label: 'Hit by Pitch', emoji: '💢', points: 3, bonusPercent: 10, description: 'Pitch hits batter' },
    { value: 'field_error', label: 'Field Error', emoji: '😅', points: 1, bonusPercent: 0, description: 'Fielding error' },
    { value: 'catcher_interf', label: 'Catcher Interference', emoji: '😅', points: 2, bonusPercent: 0, description: 'Catcher interference' },
    { value: 'batter_interference', label: 'Batter Interference', emoji: '😅', points: 2, bonusPercent: 0, description: 'Batter interference' },
    { value: 'fan_interference', label: 'Fan Interference', emoji: '😅', points: 2, bonusPercent: 0, description: 'Fan interference' },
    { value: 'sac_fly', label: 'Sacrifice Fly', emoji: '🙏', points: 3, bonusPercent: 10, description: 'Sacrifice fly' },
    { value: 'sac_bunt', label: 'Sacrifice Bunt', emoji: '🙏', points: 2, bonusPercent: 0, description: 'Sacrifice bunt' },
    { value: 'sac_fly_double_play', label: 'Sac Fly DP', emoji: '🙏', points: 3, bonusPercent: 10, description: 'Sacrifice fly double play' },
    { value: 'sac_bunt_double_play', label: 'Sac Bunt DP', emoji: '🙏', points: 2, bonusPercent: 0, description: 'Sacrifice bunt double play' }
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
  const [isWaitingForResolution, setIsWaitingForResolution] = useState(false)

  // Check if user has already made a prediction for this at-bat and if it's resolved
  useEffect(() => {
    const checkExistingPrediction = async () => {
      try {
        setIsCheckingPrediction(true)
        const hasPredicted = await predictionServiceNew.hasUserPredictedForAtBat(gamePk, currentAtBat.about.atBatIndex)
        setHasAlreadyPredicted(hasPredicted)
        
        // If user has predicted, check if the at-bat is resolved
        if (hasPredicted) {
          const predictions = await predictionServiceNew.getAtBatPredictions(gamePk, currentAtBat.about.atBatIndex)
          const userId = await predictionServiceNew.getCurrentUserId()
          const userPrediction = predictions.find(p => p.userId === userId)
          const isResolved = userPrediction?.actualOutcome !== undefined
          setIsWaitingForResolution(!isResolved)
        } else {
          setIsWaitingForResolution(false)
        }
      } catch (error) {
        console.error('Error checking existing prediction:', error)
        setHasAlreadyPredicted(false)
        setIsWaitingForResolution(false)
      } finally {
        setIsCheckingPrediction(false)
      }
    }

    checkExistingPrediction()
  }, [gamePk, currentAtBat.about.atBatIndex])

  // Subscribe to real-time updates for this at-bat to detect when it gets resolved
  useEffect(() => {
    if (!hasAlreadyPredicted || !isWaitingForResolution) {
      return
    }

    const subscription = predictionServiceNew.subscribeToPredictions(
      gamePk,
      async (predictions) => {
        // Check if our prediction has been resolved
        const userId = await predictionServiceNew.getCurrentUserId()
        const userPrediction = predictions.find(p => p.userId === userId)
        if (userPrediction && userPrediction.actualOutcome !== undefined) {
          setIsWaitingForResolution(false)
        }
      },
      currentAtBat.about.atBatIndex
    )

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [gamePk, currentAtBat.about.atBatIndex, hasAlreadyPredicted, isWaitingForResolution])

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
      console.log('Submitting prediction:', {
        gamePk,
        atBatIndex: currentAtBat.about.atBatIndex,
        prediction: selectedOutcome,
        category: predictionCategory
      })

      const result = await predictionServiceNew.submitPrediction(
        gamePk,
        currentAtBat.about.atBatIndex,
        selectedOutcome,
        predictionCategory
      )

      if (result) {
        console.log('Prediction submitted successfully:', result)
        setSuccess(true)
        setHasAlreadyPredicted(true)
        setIsWaitingForResolution(true)
        onPredictionSubmitted()
        
        // Reset form after a delay
        setTimeout(() => {
          setSuccess(false)
          setSelectedCategory(null)
          setSelectedOutcome(null)
        }, 2000)
      } else {
        console.error('Prediction submission returned null/undefined')
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
    if (isWaitingForResolution) {
      return (
        <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 mb-4">
          <div className="text-center">
            <div className="text-blue-300 text-lg mb-2">⏳</div>
            <h3 className="text-blue-300 font-semibold mb-1">Waiting for Resolution</h3>
            <p className="text-blue-400 text-sm">Your prediction has been submitted! Waiting for this at-bat to complete...</p>
          </div>
        </div>
      )
    } else {
      return (
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-4">
          <div className="text-center">
            <div className="text-yellow-300 text-lg mb-2">✅</div>
            <h3 className="text-yellow-300 font-semibold mb-1">At-Bat Resolved!</h3>
            <p className="text-yellow-400 text-sm">This at-bat has been completed. Check the results below!</p>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">Make Your Prediction</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Main Category Selection */}
        {!selectedCategory && (
          <div>
            <label className="block text-gray-300 text-lg font-medium mb-4 text-center">
              What type of outcome do you predict?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {MAIN_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => handleCategorySelect(category.value)}
                  className="p-6 rounded-xl border-2 transition-all duration-200 border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500 hover:bg-gray-600 hover:scale-105"
                >
                  <div className="text-4xl mb-3">{category.emoji}</div>
                  <div className="text-lg font-semibold mb-2">{category.label}</div>
                  <div className="text-sm text-gray-400 mb-2">{category.description}</div>
                  <div className="text-sm text-yellow-400 font-bold">
                    {category.basePoints} pts base
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Specific Outcome Selection */}
        {selectedCategory && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-gray-300 text-lg font-medium">
                What specific outcome?
              </label>
              <button
                type="button"
                onClick={handleBack}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium px-3 py-1 rounded-lg border border-blue-500 hover:bg-blue-900/20"
              >
                ← Back
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {SPECIFIC_OUTCOMES[selectedCategory]?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOutcomeSelect(option.value)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    selectedOutcome === option.value
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300 scale-105'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-600 hover:scale-105'
                  }`}
                >
                  <div className="text-2xl mb-2">{option.emoji}</div>
                  <div className="text-sm font-medium mb-1">{option.label}</div>
                  <div className="text-xs text-gray-400 mb-2">{option.description}</div>
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
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <div className="text-blue-300 text-sm font-medium mb-2">Your Prediction:</div>
            <div className="text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.emoji || '❓'}
                </div>
                <div>
                  <div className="font-semibold">
                    {Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.label || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.description || 'Unknown outcome'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-yellow-400 font-bold text-lg">
                  {Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.points || 0} pts
                </div>
                {(Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.bonusPercent || 0) > 0 && (
                  <div className="text-green-400 text-sm">
                    +{Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.bonusPercent}% bonus
                  </div>
                )}
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

