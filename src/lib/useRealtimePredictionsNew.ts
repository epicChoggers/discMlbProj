import { useState, useEffect, useCallback } from 'react'
import { AtBatPrediction } from './types'
import { predictionServiceNew } from './predictionServiceNew'
import { supabase } from '../supabaseClient'

interface UseRealtimePredictionsNewProps {
  gamePk: number
  atBatIndex?: number
  onGameStateUpdate?: (callback: () => void) => () => void
}

export const useRealtimePredictionsNew = ({ gamePk, atBatIndex, onGameStateUpdate }: UseRealtimePredictionsNewProps) => {
  const [predictions, setPredictions] = useState<AtBatPrediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load initial predictions
  const loadPredictions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      let predictionsData: AtBatPrediction[]
      if (atBatIndex !== undefined) {
        predictionsData = await predictionServiceNew.getAtBatPredictions(gamePk, atBatIndex)
      } else {
        // Get all predictions for the game, not just user's predictions
        predictionsData = await predictionServiceNew.getAllGamePredictions(gamePk)
      }
      
      console.log('Loaded predictions:', predictionsData.length)
      setPredictions(predictionsData)
    } catch (err) {
      console.error('Error loading predictions:', err)
      setError('Failed to load predictions')
    } finally {
      setIsLoading(false)
    }
  }, [gamePk, atBatIndex])

  // Refresh predictions when game state updates (for when at-bat outcomes are resolved)
  const refreshPredictions = useCallback(async () => {
    console.log('Game state updated, refreshing predictions...')
    setIsUpdating(true)
    try {
      await loadPredictions()
    } catch (err) {
      console.error('Error refreshing predictions on game state update:', err)
    } finally {
      setTimeout(() => setIsUpdating(false), 500)
    }
  }, [loadPredictions])

  // Register for game state updates
  useEffect(() => {
    if (onGameStateUpdate) {
      console.log('Registering for game state updates to refresh predictions')
      const unsubscribe = onGameStateUpdate(refreshPredictions)
      return unsubscribe
    }
  }, [onGameStateUpdate, refreshPredictions])

  // Set up real-time subscription
  useEffect(() => {
    if (!gamePk) return

    let channel: any

    const setupRealtime = async () => {
      try {
        console.log('Setting up prediction real-time subscription for game:', gamePk)
        
        const channelName = `predictions_${gamePk}_${atBatIndex || 'all'}`
        console.log('Channel name:', channelName)

        // Load initial predictions
        await loadPredictions()
        
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'at_bat_predictions',
              filter: `game_pk=eq.${gamePk}`
            },
            async (payload) => {
              console.log('Received prediction real-time update:', payload)
              console.log('Event type:', payload.eventType)
              console.log('New data:', payload.new)
              console.log('Old data:', payload.old)
              
              // If we're filtering by atBatIndex, check if this event is relevant
              if (atBatIndex !== undefined && payload.new && (payload.new as any).at_bat_index !== atBatIndex) {
                console.log('Event not relevant for current at-bat:', (payload.new as any).at_bat_index, 'vs', atBatIndex)
                return
              }
              
              console.log('Processing real-time event for current at-bat')
              
              // Show updating indicator
              setIsUpdating(true)
              
              try {
                // Add a small delay to ensure database consistency
                await new Promise(resolve => setTimeout(resolve, 200))
                
                // Reload predictions
                await loadPredictions()
                console.log('Successfully updated predictions after real-time event')
              } catch (err) {
                console.error('Error handling real-time update:', err)
              } finally {
                // Hide updating indicator
                setTimeout(() => setIsUpdating(false), 500)
              }
            }
          )
          .subscribe((status) => {
            console.log('Prediction subscription status:', status)
            if (status === 'SUBSCRIBED') {
              console.log('Successfully subscribed to prediction updates')
            } else if (status === 'CHANNEL_ERROR') {
              console.error('Prediction subscription error')
              setError('Connection error')
            }
          })
      } catch (err) {
        console.error('Error setting up prediction real-time:', err)
        setError('Failed to connect')
      }
    }

    setupRealtime()

    return () => {
      if (channel) {
        console.log('Unsubscribing from prediction updates')
        supabase.removeChannel(channel)
      }
    }
  }, [gamePk, atBatIndex, loadPredictions])

  return {
    predictions,
    isLoading,
    isUpdating,
    error,
    refreshPredictions
  }
}
