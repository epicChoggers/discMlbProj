import { Message, PendingMessage } from '../lib/types'

interface MessageBubbleProps {
  message: Message | PendingMessage
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isPending = 'isPending' in message
  const author = message.author || 'Anon'
  const createdAt = isPending ? new Date() : new Date(message.created_at)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className={`mb-4 ${isPending ? 'opacity-60' : ''}`}>
      <div className="bg-gray-700 rounded-lg p-4 shadow-sm">
        {/* Author and timestamp */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-400">
            {author}
          </span>
          <span className="text-xs text-gray-400">
            {formatTime(createdAt)}
            {isPending && (
              <span className="ml-2 text-yellow-400">Sending...</span>
            )}
          </span>
        </div>
        
        {/* Message text */}
        <p className="text-gray-100 whitespace-pre-wrap break-words">
          {message.text}
        </p>
      </div>
    </div>
  )
}
