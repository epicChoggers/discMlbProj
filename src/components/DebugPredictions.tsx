import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { predictionServiceNew } from '../lib/predictionService'

interface DebugPredictionsProps {
  gamePk: number
}

export const DebugPredictions = ({ gamePk }: DebugPredictionsProps) => {
  const [events, setEvents] = useState<Array<{ timestamp: string; event: string; data: any }>>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

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
          console.log('DEBUG: Event type:', payload.eventType)
          console.log('DEBUG: New data:', payload.new)
          console.log('DEBUG: Old data:', payload.old)
          setEvents(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            event: payload.eventType,
            data: {
              id: (payload.new as any)?.id || (payload.old as any)?.id,
              at_bat_index: (payload.new as any)?.at_bat_index || (payload.old as any)?.at_bat_index,
              prediction: (payload.new as any)?.prediction || (payload.old as any)?.prediction,
              user_id: (payload.new as any)?.user_id || (payload.old as any)?.user_id,
              game_pk: (payload.new as any)?.game_pk || (payload.old as any)?.game_pk
            }
          }])
        }
      )
      .subscribe((status) => {
        console.log('DEBUG: Subscription status:', status)
        console.log('DEBUG: Channel name:', `debug-predictions-${gamePk}`)
        console.log('DEBUG: Filter:', `game_pk=eq.${gamePk}`)
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    return () => {
      console.log('Cleaning up debug subscription')
      supabase.removeChannel(channel)
    }
  }, [gamePk])

  const testPrediction = async () => {
    setIsTesting(true)
    try {
      console.log('DEBUG: Testing prediction submission...')
      const result = await predictionServiceNew.submitPrediction(
        gamePk,
        999, // Use a test at-bat index
        'single',
        'hit'
      )
      console.log('DEBUG: Test prediction result:', result)
      
      // Also test direct database insert
      console.log('DEBUG: Testing direct database insert...')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('at_bat_predictions')
          .insert([{
            user_id: user.id,
            game_pk: gamePk,
            at_bat_index: 998,
            prediction: 'double',
            prediction_category: 'hit',
            created_at: new Date().toISOString()
          }])
          .select()
          .single()
        
        console.log('DEBUG: Direct insert result:', data, error)
      }
    } catch (error) {
      console.error('DEBUG: Test prediction error:', error)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-white text-lg font-semibold mb-2">Debug: Real-time Events</h3>
      <div className="text-sm text-gray-400 mb-2">
        Status: {isSubscribed ? '✅ Subscribed' : '❌ Not subscribed'} | Game: {gamePk}
      </div>
      <button
        onClick={testPrediction}
        disabled={isTesting}
        className="mb-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded"
      >
        {isTesting ? 'Testing...' : 'Test Prediction Submission'}
      </button>
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
