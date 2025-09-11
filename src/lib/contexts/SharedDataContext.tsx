import React, { createContext, useContext, useCallback, useMemo } from 'react'
import { GameState } from '../types'
import { networkOptimizationService } from '../services/NetworkOptimizationService'

interface SharedDataContextType {
  // Game state
  gameState: GameState | null
  setGameState: (gameState: GameState) => void
  
  // Leaderboard data
  leaderboard: any | null
  setLeaderboard: (leaderboard: any) => void
  
  // User stats
  userStats: any | null
  setUserStats: (stats: any) => void
  
  // Network metrics
  getNetworkMetrics: () => any
  
  // Preload critical data
  preloadData: (gamePk?: number) => Promise<void>
}

const SharedDataContext = createContext<SharedDataContextType | null>(null)

interface SharedDataProviderProps {
  children: React.ReactNode
}

export const SharedDataProvider: React.FC<SharedDataProviderProps> = ({ children }) => {
  const [gameState, setGameState] = React.useState<GameState | null>(null)
  const [leaderboard, setLeaderboard] = React.useState<any | null>(null)
  const [userStats, setUserStats] = React.useState<any | null>(null)

  const getNetworkMetrics = useCallback(() => {
    return networkOptimizationService.getMetrics()
  }, [])

  const preloadData = useCallback(async (gamePk?: number) => {
    try {
      await networkOptimizationService.preloadCriticalData(gamePk)
    } catch (error) {
      console.error('Error preloading data:', error)
    }
  }, [])

  const contextValue = useMemo(() => ({
    gameState,
    setGameState,
    leaderboard,
    setLeaderboard,
    userStats,
    setUserStats,
    getNetworkMetrics,
    preloadData
  }), [gameState, leaderboard, userStats, getNetworkMetrics, preloadData])

  return (
    <SharedDataContext.Provider value={contextValue}>
      {children}
    </SharedDataContext.Provider>
  )
}

export const useSharedData = () => {
  const context = useContext(SharedDataContext)
  if (!context) {
    throw new Error('useSharedData must be used within a SharedDataProvider')
  }
  return context
}

// Hook for components that need to share leaderboard data
export const useSharedLeaderboard = () => {
  const { leaderboard, setLeaderboard } = useSharedData()
  
  const updateLeaderboard = useCallback((newLeaderboard: any) => {
    setLeaderboard(newLeaderboard)
  }, [setLeaderboard])

  return {
    leaderboard,
    updateLeaderboard
  }
}

// Hook for components that need to share game state
export const useSharedGameState = () => {
  const { gameState, setGameState } = useSharedData()
  
  const updateGameState = useCallback((newGameState: GameState) => {
    setGameState(newGameState)
  }, [setGameState])

  return {
    gameState,
    updateGameState
  }
}
