import { supabase } from '../../supabaseClient'

export interface RealtimeEvent {
  id: string
  type: 'prediction' | 'leaderboard' | 'user_stats' | 'game_state'
  timestamp: number
  data: any
}

export class RealtimeOptimizationService {
  private eventQueue: RealtimeEvent[] = []
  private processingQueue = false
  private subscribers = new Map<string, Set<(data: any) => void>>()
  private lastProcessedEvents = new Map<string, string>()
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly BATCH_DELAY = 100 // Process events in batches every 100ms
  private readonly MAX_QUEUE_SIZE = 50

  constructor() {
    this.startBatchProcessor()
  }

  // Subscribe to real-time events with deduplication
  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }
    
    this.subscribers.get(eventType)!.add(callback)
    
    return () => {
      const subscribers = this.subscribers.get(eventType)
      if (subscribers) {
        subscribers.delete(callback)
        if (subscribers.size === 0) {
          this.subscribers.delete(eventType)
        }
      }
    }
  }

  // Add event to processing queue
  addEvent(eventType: string, data: any): void {
    const eventId = `${eventType}_${data.id || Date.now()}_${Date.now()}`
    
    // Check for duplicate events
    const lastEvent = this.lastProcessedEvents.get(eventType)
    if (lastEvent === eventId) {
      return // Skip duplicate
    }
    
    // Prevent queue overflow
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      this.eventQueue.shift() // Remove oldest event
    }
    
    const event: RealtimeEvent = {
      id: eventId,
      type: eventType as any,
      timestamp: Date.now(),
      data
    }
    
    this.eventQueue.push(event)
    this.lastProcessedEvents.set(eventType, eventId)
    
    // Trigger batch processing if not already running
    if (!this.processingQueue) {
      this.processBatch()
    }
  }

  // Start batch processor
  private startBatchProcessor(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }
    
    this.batchTimeout = setInterval(() => {
      if (this.eventQueue.length > 0 && !this.processingQueue) {
        this.processBatch()
      }
    }, this.BATCH_DELAY)
  }

  // Process events in batches
  private async processBatch(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return
    }
    
    this.processingQueue = true
    
    try {
      // Group events by type for efficient processing
      const eventsByType = new Map<string, RealtimeEvent[]>()
      
      for (const event of this.eventQueue) {
        if (!eventsByType.has(event.type)) {
          eventsByType.set(event.type, [])
        }
        eventsByType.get(event.type)!.push(event)
      }
      
      // Process each event type
      for (const [eventType, events] of eventsByType) {
        const subscribers = this.subscribers.get(eventType)
        if (subscribers && subscribers.size > 0) {
          // Use the most recent event of each type
          const latestEvent = events[events.length - 1]
          
          // Notify all subscribers
          subscribers.forEach(callback => {
            try {
              callback(latestEvent.data)
            } catch (error) {
              console.error(`Error in ${eventType} subscriber:`, error)
            }
          })
        }
      }
      
      // Clear processed events
      this.eventQueue = []
      
    } catch (error) {
      console.error('Error processing event batch:', error)
    } finally {
      this.processingQueue = false
    }
  }

  // Set up optimized Supabase subscriptions
  setupOptimizedSubscriptions(): {
    unsubscribe: () => void
  } {
    const subscriptions: any[] = []
    
    // Prediction updates
    const predictionSub = supabase
      .channel('optimized_predictions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'at_bat_predictions'
        },
        (payload) => {
          this.addEvent('prediction', payload)
        }
      )
      .subscribe()
    
    subscriptions.push(predictionSub)
    
    // User profile updates
    const profileSub = supabase
      .channel('optimized_profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles'
        },
        (payload) => {
          this.addEvent('leaderboard', payload)
        }
      )
      .subscribe()
    
    subscriptions.push(profileSub)
    
    return {
      unsubscribe: () => {
        subscriptions.forEach(sub => {
          if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe()
          }
        })
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout)
        }
      }
    }
  }

  // Cleanup
  destroy(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    this.eventQueue = []
    this.subscribers.clear()
    this.lastProcessedEvents.clear()
  }
}

export const realtimeOptimizationService = new RealtimeOptimizationService()
