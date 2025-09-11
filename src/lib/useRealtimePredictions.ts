import { useState, useEffect, useCallback, useRef } from 'react'
import { AtBatPrediction } from './types'
import { predictionServiceNew } from './predictionService'
import { supabase } from '../supabaseClient'
import { resolvePredictionsService } from './resolvePredictionsService'
import { debounce } from './utils/debounce'

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
  const lastProcessedEvent = useRef<string | null>(null)
  const processingEvent = useRef(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subscriptionRef = useRef<any>(null)

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
      
      // console.log('Loaded predictions:', predictionsData.length)
      setPredictions(predictionsData)
    } catch (err) {
      console.error('Error loading predictions:', err)
      setError('Failed to load predictions')
    } finally {
      setIsLoading(false)
    }
  }, [gamePk, atBatIndex])

  // Optimized refresh predictions with better state management
  const refreshPredictions = useCallback(
    debounce(async () => {
      if (processingEvent.current) return
      
      processingEvent.current = true
      setIsUpdating(true)
      
      // Clear any existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      
      try {
        // Call the resolve-predictions API to resolve any pending predictions
        await resolvePredictionsService.resolvePredictions()
        
        // Then reload the predictions to get the updated data
        await loadPredictions()
      } catch (err) {
        console.error('Error refreshing predictions on game state update:', err)
      } finally {
        processingEvent.current = false
        // Use a shorter timeout for better responsiveness
        updateTimeoutRef.current = setTimeout(() => setIsUpdating(false), 200)
      }
    }, 500), // Reduced debounce to 500ms for better responsiveness
    [loadPredictions]
  )

  // Register for game state updates
  useEffect(() => {
    if (onGameStateUpdate) {
      const unsubscribe = onGameStateUpdate(refreshPredictions)
      return unsubscribe
    }
  }, [onGameStateUpdate, refreshPredictions])

  // Set up real-time subscription with improved error handling and cleanup
  useEffect(() => {
    if (!gamePk) return

    const setupRealtime = async () => {
      try {
        const channelName = `predictions_${gamePk}_${atBatIndex || 'all'}`

        // Load initial predictions
        await loadPredictions()
        
        // Clean up existing subscription
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current)
        }
        
        subscriptionRef.current = supabase
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
              // Create unique event identifier to prevent duplicate processing
              const newId = payload.new && typeof payload.new === 'object' && 'id' in payload.new ? payload.new.id : 'unknown'
              const oldId = payload.old && typeof payload.old === 'object' && 'id' in payload.old ? payload.old.id : 'unknown'
              const eventId = `${payload.eventType}_${newId || oldId}_${Date.now()}`
              
              // Skip if we've already processed this event
              if (lastProcessedEvent.current === eventId || processingEvent.current) {
                return
              }
              
              lastProcessedEvent.current = eventId
              
              // If we're filtering by atBatIndex, check if this event is relevant
              if (atBatIndex !== undefined && payload.new && (payload.new as any).at_bat_index !== atBatIndex) {
                return
              }
              
              // Use debounced refresh to prevent excessive API calls
              refreshPredictions()
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Prediction subscription error')
              setError('Connection error')
            } else if (status === 'SUBSCRIBED') {
              setError(null) // Clear any previous errors
            }
          })
      } catch (err) {
        console.error('Error setting up prediction real-time:', err)
        setError('Failed to connect')
      }
    }

    setupRealtime()

    return () => {
      // Clean up subscription and timeouts
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = null
      }
    }
  }, [gamePk, atBatIndex, loadPredictions, refreshPredictions])

  return {
    predictions,
    isLoading,
    isUpdating,
    error,
    refreshPredictions
  }
}
