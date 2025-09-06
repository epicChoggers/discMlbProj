import { useState, useEffect, useCallback } from 'react'
import { GameState } from './types'
import { mlbService } from './mlbService'
import { predictionService } from './predictionService'

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>({
    game: null,
    currentAtBat: null,
    isLoading: true,
    lastUpdated: new Date().toISOString()
  })

  const refreshGameState = useCallback(async () => {
    setGameState(prev => ({ ...prev, isLoading: true }))
    const newGameState = await mlbService.getGameState()
    
    // Auto-resolve ALL completed at-bats
    if (newGameState.game && newGameState.game.gamePk) {
      await predictionService.autoResolveAllCompletedAtBats(newGameState.game.gamePk, newGameState.game)
    }
    
    setGameState(newGameState)
  }, [])

  useEffect(() => {
    // Initial load
    refreshGameState()

    // Set up real-time updates
    const handleGameUpdate = async (newGameState: GameState) => {
      // Auto-resolve ALL completed at-bats on real-time updates too
      if (newGameState.game && newGameState.game.gamePk) {
        await predictionService.autoResolveAllCompletedAtBats(newGameState.game.gamePk, newGameState.game)
      }
      
      setGameState(newGameState)
    }

    mlbService.startLiveUpdates(handleGameUpdate)

    // Cleanup
    return () => {
      mlbService.removeListener(handleGameUpdate)
    }
  }, [refreshGameState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mlbService.stopLiveUpdates()
    }
  }, [])

  return {
    gameState,
    refreshGameState,
    isGameLive: gameState.game ? mlbService.isGameLive(gameState.game) : false
  }
}

