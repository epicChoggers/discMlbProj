import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Message, PendingMessage, MessageOrPending, RealtimeStatus } from './types'

export const useRealtimeMessages = () => {
  const [messages, setMessages] = useState<MessageOrPending[]>([])
  const [status, setStatus] = useState<RealtimeStatus>({
    isConnected: false,
    isConnecting: true,
  })

  // Load initial messages
  const loadMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) {
        console.error('Error loading messages:', error)
        setStatus(prev => ({ ...prev, error: 'Failed to load messages' }))
        return
      }

      setMessages(data || [])
    } catch (err) {
      console.error('Error loading messages:', err)
      setStatus(prev => ({ ...prev, error: 'Failed to load messages' }))
    }
  }, [])

  // Add a new message optimistically
  const addPendingMessage = useCallback((text: string, author?: string) => {
    const pendingMessage: PendingMessage = {
      id: `pending-${Date.now()}`,
      text,
      author,
      isPending: true,
    }
    
    setMessages(prev => [...prev, pendingMessage])
    return pendingMessage.id
  }, [])

  // Remove a pending message (on error)
  const removePendingMessage = useCallback((pendingId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== pendingId))
  }, [])

  // Send a new message
  const sendMessage = useCallback(async (text: string, author?: string) => {
    console.log('Sending message:', { text, author })
    const pendingId = addPendingMessage(text, author)
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ text, author }])
        .select()
        .single()

      if (error) {
        console.error('Error inserting message:', error)
        removePendingMessage(pendingId)
        throw error
      }

      console.log('Message inserted successfully:', data)
      // Remove pending message and let realtime handle the new message
      removePendingMessage(pendingId)
      return data
    } catch (err) {
      console.error('Error sending message:', err)
      removePendingMessage(pendingId)
      throw err
    }
  }, [addPendingMessage, removePendingMessage])

  // Set up realtime subscription
  useEffect(() => {
    let channel: any

    const setupRealtime = async () => {
      try {
        setStatus(prev => ({ ...prev, isConnecting: true, error: undefined }))

        // Load initial messages
        await loadMessages()

        // Set up realtime subscription
        console.log('Setting up realtime subscription...')
        channel = supabase
          .channel('messages')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            (payload) => {
              console.log('Received realtime message:', payload)
              const newMessage = payload.new as Message
              setMessages(prev => {
                // Check if message already exists (avoid duplicates)
                const exists = prev.some(msg => msg.id === newMessage.id)
                if (exists) return prev
                return [...prev, newMessage]
              })
            }
          )
          .subscribe((status) => {
            console.log('Realtime subscription status:', status)
            if (status === 'SUBSCRIBED') {
              setStatus({
                isConnected: true,
                isConnecting: false,
              })
            } else if (status === 'CHANNEL_ERROR') {
              setStatus({
                isConnected: false,
                isConnecting: false,
                error: 'Connection error',
              })
            }
          })
      } catch (err) {
        console.error('Error setting up realtime:', err)
        setStatus({
          isConnected: false,
          isConnecting: false,
          error: 'Failed to connect',
        })
      }
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [loadMessages])

  return {
    messages,
    status,
    sendMessage,
  }
}
