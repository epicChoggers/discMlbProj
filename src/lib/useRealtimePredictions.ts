import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { AtBatPrediction } from './types'
import { predictionService } from './predictionService'

interface UseRealtimePredictionsProps {
  gamePk: number
  atBatIndex?: number
}

export const useRealtimePredictions = ({ gamePk, atBatIndex }: UseRealtimePredictionsProps) => {
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
        predictionsData = await predictionService.getAtBatPredictions(gamePk, atBatIndex)
      } else {
        predictionsData = await predictionService.getUserGamePredictions(gamePk)
      }
      
      setPredictions(predictionsData)
    } catch (err) {
      console.error('Error loading predictions:', err)
      setError('Failed to load predictions')
    } finally {
      setIsLoading(false)
    }
  }, [gamePk, atBatIndex])

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(async (payload: any) => {
    console.log('Real-time prediction update:', payload)
    
    // Show updating indicator
    setIsUpdating(true)
    
    try {
      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Reload predictions
      await loadPredictions()
    } catch (err) {
      console.error('Error handling real-time update:', err)
    } finally {
      // Hide updating indicator
      setTimeout(() => setIsUpdating(false), 500)
    }
  }, [loadPredictions])

  // Set up real-time subscription
  useEffect(() => {
    if (!gamePk) return

    // Load initial data
    loadPredictions()

    // Set up real-time subscription
    const channel = supabase
      .channel(`predictions-${gamePk}-${atBatIndex || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'at_bat_predictions',
          filter: `game_pk=eq.${gamePk}`
        },
        handleRealtimeUpdate
      )
      .subscribe((status) => {
        console.log('Prediction subscription status:', status)
        if (status === 'CHANNEL_ERROR') {
          setError('Connection error')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gamePk, atBatIndex, loadPredictions, handleRealtimeUpdate])

  return {
    predictions,
    isLoading,
    isUpdating,
    error,
    refetch: loadPredictions
  }
}
