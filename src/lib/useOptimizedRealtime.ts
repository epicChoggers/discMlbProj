import { useState, useEffect, useCallback, useRef } from 'react'
import { realtimeOptimizationService } from './services/RealtimeOptimizationService'

interface UseOptimizedRealtimeOptions {
  eventTypes: string[]
  onUpdate: (eventType: string, data: any) => void
  debounceMs?: number
}

export const useOptimizedRealtime = ({ 
  eventTypes, 
  onUpdate, 
  debounceMs = 200 
}: UseOptimizedRealtimeOptions) => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const subscriptionRef = useRef<any>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)

  // Debounced update handler
  const debouncedUpdate = useCallback((eventType: string, data: any) => {
    const now = Date.now()
    
    // Skip if too frequent
    if (now - lastUpdateTimeRef.current < debounceMs) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        onUpdate(eventType, data)
        setLastUpdate(new Date())
        lastUpdateTimeRef.current = Date.now()
      }, debounceMs)
    } else {
      onUpdate(eventType, data)
      setLastUpdate(new Date())
      lastUpdateTimeRef.current = now
    }
  }, [onUpdate, debounceMs])

  useEffect(() => {
    // Set up subscriptions for each event type
    const unsubscribers: (() => void)[] = []
    
    eventTypes.forEach(eventType => {
      const unsubscribe = realtimeOptimizationService.subscribe(eventType, (data) => {
        debouncedUpdate(eventType, data)
      })
      unsubscribers.push(unsubscribe)
    })

    // Set up optimized Supabase subscriptions
    subscriptionRef.current = realtimeOptimizationService.setupOptimizedSubscriptions()
    setIsConnected(true)

    return () => {
      // Clean up subscriptions
      unsubscribers.forEach(unsubscribe => unsubscribe())
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      setIsConnected(false)
    }
  }, [eventTypes, debouncedUpdate])

  return {
    isConnected,
    lastUpdate,
    reconnect: useCallback(() => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
      subscriptionRef.current = realtimeOptimizationService.setupOptimizedSubscriptions()
      setIsConnected(true)
    }, [])
  }
}
