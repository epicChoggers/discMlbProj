import { useState, useEffect } from 'react'
import { AtBatOutcome, MLBPlay, getOutcomeCategory } from '../lib/types'
import { predictionServiceNew } from '../lib/predictionService'

interface PredictionFormProps {
  gamePk: number
  currentAtBat: MLBPlay
  onPredictionSubmitted: () => void
}

// Main prediction categories - simplified to two options
const MAIN_CATEGORIES = [
  { 
    value: 'out', 
    label: 'Out', 
    emoji: '⚾', 
    description: 'Batter makes an out',
    categoryPoints: 1,
    category: 'out'
  },
  { 
    value: 'hit', 
    label: 'Hit', 
    emoji: '🏃', 
    description: 'Batter gets a hit or reaches base',
    categoryPoints: 2,
    category: 'hit'
  }
]

// Specific outcomes for each main category - using new unified point system
const SPECIFIC_OUTCOMES: Record<string, { value: AtBatOutcome; label: string; emoji: string; exactPoints: number; categoryPoints: number; description: string }[]> = {
  out: [
    { value: 'strikeout', label: 'Strikeout', emoji: '❌', exactPoints: 3, categoryPoints: 1, description: 'Three strikes' },
    { value: 'field_out', label: 'Field Out', emoji: '⚾', exactPoints: 2, categoryPoints: 1, description: 'Any field out' }
  ],
  hit: [
    { value: 'single', label: 'Single', emoji: '🏃', exactPoints: 3, categoryPoints: 2, description: 'One base hit' },
    { value: 'double', label: 'Double', emoji: '🏃🏃', exactPoints: 4, categoryPoints: 2, description: 'Two base hit' },
    { value: 'triple', label: 'Triple', emoji: '🏃🏃🏃', exactPoints: 5, categoryPoints: 2, description: 'Three base hit' },
    { value: 'home_run', label: 'Home Run', emoji: '💥', exactPoints: 6, categoryPoints: 2, description: 'Over the fence' },
    { value: 'walk', label: 'Walk', emoji: '🚶', exactPoints: 3, categoryPoints: 2, description: 'Four balls or hit by pitch' }
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
  const [lastPredictedAtBatIndex, setLastPredictedAtBatIndex] = useState<number | null>(null)

  // Check if user has already made a prediction for this at-bat and if it's resolved
  useEffect(() => {
    const checkExistingPrediction = async () => {
      try {
        setIsCheckingPrediction(true)
        const currentAtBatIndex = currentAtBat.about.atBatIndex
        const hasPredicted = await predictionServiceNew.hasUserPredictedForAtBat(gamePk, currentAtBatIndex)
        
        // Check if this is a new at-bat (different from the last one we predicted for)
        const isNewAtBat = lastPredictedAtBatIndex === null || lastPredictedAtBatIndex !== currentAtBatIndex
        
        if (hasPredicted && !isNewAtBat) {
          // User has already predicted for this exact at-bat
          setHasAlreadyPredicted(true)
          
          // Check if the at-bat is resolved
          const predictions = await predictionServiceNew.getAtBatPredictions(gamePk, currentAtBatIndex)
          const userId = await predictionServiceNew.getCurrentUserId()
          const userPrediction = predictions.find(p => p.userId === userId)
          const isResolved = userPrediction?.actualOutcome !== undefined
          
          // Only show waiting for resolution if the at-bat is not yet resolved
          setIsWaitingForResolution(!isResolved)
        } else if (hasPredicted && isNewAtBat) {
          // User has predicted for a previous at-bat, but this is a new at-bat
          setHasAlreadyPredicted(false)
          setIsWaitingForResolution(false)
          setLastPredictedAtBatIndex(null) // Reset since we're allowing predictions for new at-bat
        } else {
          // User hasn't predicted for this at-bat
          setHasAlreadyPredicted(false)
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
  }, [gamePk, currentAtBat.about.atBatIndex, lastPredictedAtBatIndex])

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
        setLastPredictedAtBatIndex(currentAtBat.about.atBatIndex) // Track this at-bat as predicted
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

  // Check if the inning has ended (3 outs) - prevent predictions
  const isInningEnded = currentAtBat?.count?.outs >= 3

  // Check if count is too advanced (2+ balls or 2+ strikes) - prevent predictions
  const balls = currentAtBat?.count?.balls || 0
  const strikes = currentAtBat?.count?.strikes || 0
  const isCountTooAdvanced = balls >= 2 || strikes >= 2

  // Check if at-bat is already complete - prevent predictions
  const isAtBatComplete = currentAtBat?.about?.isComplete === true

  // Show a message if user has already predicted for this at-bat
  if (hasAlreadyPredicted) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Make Your Prediction</h3>
          {isWaitingForResolution ? (
            <div className="flex items-center space-x-2 text-blue-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span>Waiting for resolution...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-green-400 text-sm">
              <div className="text-green-400">✅</div>
              <span>Previous at-bat resolved</span>
            </div>
          )}
        </div>
        
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <div className="text-center">
            <div className="text-red-300 text-lg mb-2">🚫</div>
            <h4 className="text-red-300 font-semibold mb-1">Already Predicted</h4>
            <p className="text-red-400 text-sm">
              {isWaitingForResolution 
                ? "You have already made a prediction for this at-bat. Please wait for the next at-bat."
                : "You have already made a prediction for this at-bat. Please wait for the next at-bat."
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show message when inning has ended (3 outs)
  if (isInningEnded) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-orange-400 text-lg mb-2">🏁</div>
          <h3 className="text-orange-300 font-semibold mb-1">Inning Ended</h3>
          <p className="text-orange-400 text-sm">This inning has ended with 3 outs. Predictions will be available for the next inning.</p>
        </div>
      </div>
    )
  }

  // Show message when at-bat is already complete
  if (isAtBatComplete) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">✅</div>
          <h3 className="text-red-300 font-semibold mb-1">At-Bat Complete</h3>
          <p className="text-red-400 text-sm">
            This at-bat has already been completed. Predictions are no longer accepted.
          </p>
        </div>
      </div>
    )
  }

  // Show message when count is too advanced (2+ balls or 2+ strikes)
  if (isCountTooAdvanced) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">⏰</div>
          <h3 className="text-red-300 font-semibold mb-1">Too Late to Predict</h3>
          <p className="text-red-400 text-sm">
            Predictions are no longer accepted after the count reaches 2+ balls or 2+ strikes. 
            Current count: {balls}-{strikes}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">Make Your Prediction</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Main Category Selection */}
        {!selectedCategory && (
          <div>
            <label className="block text-gray-300 text-lg font-medium mb-4 text-center">
              What type of outcome do you predict?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {category.categoryPoints} pts category
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
                    {option.exactPoints} pts exact
                  </div>
                  <div className="text-xs text-blue-400 font-bold">
                    {option.categoryPoints} pts category
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
                  {Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.exactPoints || 0} pts exact
                </div>
                <div className="text-blue-400 font-bold text-sm">
                  {Object.values(SPECIFIC_OUTCOMES).flat().find(opt => opt.value === selectedOutcome)?.categoryPoints || 0} pts category
                </div>
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

