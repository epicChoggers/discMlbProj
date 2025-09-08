import { useState, useEffect, useCallback } from 'react'
import { GameState } from './types'
import { mlbServiceNew } from './mlbService'

export const useGameStateNew = () => {
  const [gameState, setGameState] = useState<GameState>({
    game: null,
    currentAtBat: null,
    isLoading: true,
    lastUpdated: new Date().toISOString()
  })

  // Callback to notify other components when game state updates
  const [gameStateUpdateCallbacks, setGameStateUpdateCallbacks] = useState<Set<() => void>>(new Set())

  const addGameStateUpdateCallback = useCallback((callback: () => void) => {
    setGameStateUpdateCallbacks(prev => new Set([...prev, callback]))
    return () => {
      setGameStateUpdateCallbacks(prev => {
        const newSet = new Set(prev)
        newSet.delete(callback)
        return newSet
      })
    }
  }, [])

  const refreshGameState = useCallback(async () => {
    setGameState(prev => ({ ...prev, isLoading: true }))
    const newGameState = await mlbServiceNew.getGameState()
    
    // Note: Prediction resolution is now handled server-side by DataSyncService
    // No need to call autoResolveAllCompletedAtBats here
    
    setGameState(newGameState)
    
    // Notify all registered callbacks that game state has updated
    gameStateUpdateCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Error in game state update callback:', error)
      }
    })
  }, [gameStateUpdateCallbacks])

  useEffect(() => {
    // Initial load
    refreshGameState()

    // Set up real-time updates
    const handleGameUpdate = async (newGameState: GameState) => {
      // Note: Prediction resolution is now handled server-side by DataSyncService
      // No need to call autoResolveAllCompletedAtBats here
      
      setGameState(newGameState)
      
      // Notify all registered callbacks that game state has updated
      gameStateUpdateCallbacks.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('Error in game state update callback:', error)
        }
      })
    }

    mlbServiceNew.startLiveUpdates(handleGameUpdate)

    // Cleanup
    return () => {
      mlbServiceNew.removeListener(handleGameUpdate)
    }
  }, [refreshGameState, gameStateUpdateCallbacks])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mlbServiceNew.stopLiveUpdates()
    }
  }, [])

  return {
    gameState,
    refreshGameState,
    isGameLive: gameState.game ? mlbServiceNew.isGameLive(gameState.game) : false,
    addGameStateUpdateCallback
  }
}
