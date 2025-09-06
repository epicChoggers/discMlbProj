import { useState } from 'react'
import { useGameState } from '../lib/useGameState'
import { GameState } from './GameState'
import { PredictionForm } from './PredictionForm'
import { PredictionResults } from './PredictionResults'
import { Leaderboard } from './Leaderboard'
import { UserProfile } from './UserProfile'
import { ToastContainer } from './Toast'
import { signOut } from '../supabaseClient'
import { MLBGame, MLBPlay } from '../lib/types'

interface TextWallProps {
  onSignOut: () => void
}

export const TextWall = ({ onSignOut }: TextWallProps) => {
  const { gameState, isGameLive, isSimulationMode, startSimulation, stopSimulation } = useGameState()
  const [activeTab, setActiveTab] = useState<'predictions' | 'leaderboard'>('predictions')
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [toasts, setToasts] = useState<Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info'
    duration?: number
  }>>([])

  const handleSignOut = async () => {
    try {
      await signOut()
      onSignOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handlePredictionSubmitted = () => {
    // Add a toast notification for successful prediction submission
    addToast('Prediction submitted! Good luck! 🍀', 'success')
  }

  const addToast = (message: string, type: 'success' | 'error' | 'info', duration?: number) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type, duration }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const handleToggleLiveMode = (isLive: boolean) => {
    setIsLiveMode(isLive)
    if (isLive) {
      startSimulation()
    } else {
      stopSimulation()
    }
  }

  // Create a simulated at-bat for test mode
  const createSimulatedAtBat = (game: MLBGame): MLBPlay | null => {
    if (!game.liveData?.plays?.allPlays || game.liveData.plays.allPlays.length === 0) {
      return null
    }

    const lastPlay = game.liveData.plays.allPlays[game.liveData.plays.allPlays.length - 1]
    if (!lastPlay) {
      return null
    }

    // Create a simulated "current" at-bat by modifying the last play
    return {
      ...lastPlay,
      about: {
        ...lastPlay.about,
        atBatIndex: lastPlay.about.atBatIndex + 1 // Make it the "next" at-bat
      },
      count: {
        balls: 0,
        strikes: 0,
        outs: lastPlay.count.outs
      },
      result: {
        type: 'at_bat',
        event: '',
        description: '',
        rbi: 0,
        awayScore: lastPlay.result.awayScore,
        homeScore: lastPlay.result.homeScore
      }
    }
  }

  // Determine if we should show live features
  const shouldShowLiveFeatures = isGameLive || isLiveMode || isSimulationMode

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">⚾ Mariners Predictions</h1>
            <p className="text-sm text-gray-400">
              {shouldShowLiveFeatures ? (isSimulationMode ? 'Live Game (Simulation Mode)' : 'Live Game') : 'Most Recent Game'}
            </p>
          </div>
          <UserProfile onSignOut={handleSignOut} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full flex">
          {/* Left Sidebar - Game State */}
          <div className="w-1/3 border-r border-gray-700 p-4 overflow-y-auto">
            <GameState 
              gameState={gameState} 
              onToggleLiveMode={handleToggleLiveMode}
              isLiveMode={isLiveMode}
              isSimulationMode={isSimulationMode}
            />
            <Leaderboard gamePk={gameState.game?.gamePk} />
          </div>

          {/* Right Side - Predictions */}
          <div className="flex-1 flex flex-col">
            {/* Tab Navigation */}
            <div className="border-b border-gray-700">
              <nav className="flex space-x-8 px-4">
                <button
                  onClick={() => setActiveTab('predictions')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'predictions'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  ⚾ Predictions
                </button>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'leaderboard'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  🏆 Leaderboard
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'predictions' && (
                <div className="h-full overflow-y-auto p-4">
                  {gameState.game ? (
                    <div className="space-y-4">
                      {shouldShowLiveFeatures && (gameState.currentAtBat || isLiveMode) ? (
                        <>
                          {gameState.currentAtBat ? (
                            <PredictionForm
                              gamePk={gameState.game.gamePk}
                              currentAtBat={gameState.currentAtBat}
                              onPredictionSubmitted={handlePredictionSubmitted}
                            />
                          ) : isLiveMode ? (() => {
                            const simulatedAtBat = createSimulatedAtBat(gameState.game)
                            return simulatedAtBat ? (
                              <PredictionForm
                                gamePk={gameState.game.gamePk}
                                currentAtBat={simulatedAtBat}
                                onPredictionSubmitted={handlePredictionSubmitted}
                              />
                            ) : null
                          })() : null}
                          <PredictionResults
                            gamePk={gameState.game.gamePk}
                            currentAtBatIndex={gameState.currentAtBat?.about.atBatIndex}
                          />
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-white text-lg font-semibold mb-4">
                              {gameState.game.status.abstractGameState === 'Final' 
                                ? 'Game Results' 
                                : 'Game Information'}
                            </h3>
                            <div className="text-gray-400">
                              {gameState.game.status.abstractGameState === 'Final' 
                                ? 'This game has ended. You can view predictions that were made during the game.'
                                : 'This game has not started yet or is not currently live.'}
                            </div>
                          </div>
                          
                          {/* Show predictions from this game if it's completed */}
                          {gameState.game.status.abstractGameState === 'Final' && (
                            <PredictionResults
                              gamePk={gameState.game.gamePk}
                              currentAtBatIndex={0} // Show all predictions for the game
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 mt-8">
                      <div className="text-4xl mb-2">⚾</div>
                      <p className="text-lg">No game data available</p>
                      <p className="text-sm">Check back later for Mariners games</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'leaderboard' && (
                <div className="h-full overflow-y-auto p-4">
                  <Leaderboard gamePk={gameState.game?.gamePk} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}