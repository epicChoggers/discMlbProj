import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

interface DebugPredictionsProps {
  gamePk: number
}

export const DebugPredictions = ({ gamePk }: DebugPredictionsProps) => {
  const [events, setEvents] = useState<Array<{ timestamp: string; event: string; data: any }>>([])
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!gamePk) return

    console.log('Setting up debug subscription for game:', gamePk)

    const channel = supabase
      .channel(`debug-predictions-${gamePk}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'at_bat_predictions',
          filter: `game_pk=eq.${gamePk}`
        },
        (payload) => {
          console.log('DEBUG: Received prediction event:', payload)
          setEvents(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            event: payload.eventType,
            data: {
              id: payload.new?.id || payload.old?.id,
              at_bat_index: payload.new?.at_bat_index || payload.old?.at_bat_index,
              prediction: payload.new?.prediction || payload.old?.prediction,
              user_id: payload.new?.user_id || payload.old?.user_id
            }
          }])
        }
      )
      .subscribe((status) => {
        console.log('DEBUG: Subscription status:', status)
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    return () => {
      console.log('Cleaning up debug subscription')
      supabase.removeChannel(channel)
    }
  }, [gamePk])

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-white text-lg font-semibold mb-2">Debug: Real-time Events</h3>
      <div className="text-sm text-gray-400 mb-2">
        Status: {isSubscribed ? '✅ Subscribed' : '❌ Not subscribed'} | Game: {gamePk}
      </div>
      <div className="max-h-40 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-gray-500 text-sm">No events received yet...</div>
        ) : (
          events.slice(-10).reverse().map((event, index) => (
            <div key={index} className="text-xs text-gray-300 mb-1">
              <span className="text-blue-400">{event.timestamp}</span> - 
              <span className="text-green-400 ml-1">{event.event}</span>
              <div className="text-gray-500 ml-2">
                {JSON.stringify(event.data, null, 2)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
