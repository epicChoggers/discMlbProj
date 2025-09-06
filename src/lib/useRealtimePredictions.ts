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
        // Get all predictions for the game, not just user's predictions
        predictionsData = await predictionService.getAllGamePredictions(gamePk)
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

  // Set up real-time subscription
  useEffect(() => {
    if (!gamePk) return

    let channel: any

    const setupRealtime = async () => {
      try {
        console.log('Setting up prediction real-time subscription for game:', gamePk, 'atBat:', atBatIndex)
        
        // Load initial data
        await loadPredictions()

        // Set up real-time subscription
        const channelName = `predictions-${gamePk}-${atBatIndex !== undefined ? atBatIndex : 'all'}`
        console.log('Creating channel:', channelName)
        console.log('Subscription filter:', `game_pk=eq.${gamePk}`)
        
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
        console.log('Cleaning up prediction subscription')
        supabase.removeChannel(channel)
      }
    }
  }, [gamePk, atBatIndex, loadPredictions])

  return {
    predictions,
    isLoading,
    isUpdating,
    error,
    refetch: loadPredictions
  }
}
