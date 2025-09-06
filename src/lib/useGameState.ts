import { useState, useEffect, useCallback } from 'react'
import { GameState } from './types'
import { mlbService } from './mlbService'
import { simulationService } from './simulationService'

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>({
    game: null,
    currentAtBat: null,
    isLoading: true,
    lastUpdated: new Date().toISOString()
  })
  const [isSimulationMode, setIsSimulationMode] = useState(false)

  const refreshGameState = useCallback(async () => {
    setGameState(prev => ({ ...prev, isLoading: true }))
    const newGameState = await mlbService.getGameState()
    setGameState(newGameState)
  }, [])

  const startSimulation = useCallback(() => {
    setIsSimulationMode(true)
    simulationService.startSimulation()
  }, [])

  const stopSimulation = useCallback(() => {
    setIsSimulationMode(false)
    simulationService.stopSimulation()
  }, [])

  useEffect(() => {
    // Initial load
    refreshGameState()

    // Set up real-time updates
    const handleGameUpdate = (newGameState: GameState) => {
      setGameState(newGameState)
    }

    const handleSimulationUpdate = (simulationState: any) => {
      setGameState(simulationState)
    }

    mlbService.startLiveUpdates(handleGameUpdate)
    simulationService.addListener(handleSimulationUpdate)

    // Cleanup
    return () => {
      mlbService.removeListener(handleGameUpdate)
      simulationService.removeListener(handleSimulationUpdate)
    }
  }, [refreshGameState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mlbService.stopLiveUpdates()
      simulationService.cleanup()
    }
  }, [])

  return {
    gameState,
    refreshGameState,
    isGameLive: gameState.game ? mlbService.isGameLive(gameState.game) : false,
    isSimulationMode,
    startSimulation,
    stopSimulation
  }
}

