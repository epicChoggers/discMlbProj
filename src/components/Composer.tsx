import { useState, useRef, useEffect } from 'react'
import { validateMessage, sanitizeText } from '../lib/validators'

interface ComposerProps {
  onSendMessage: (text: string, author?: string) => Promise<void>
  isConnected: boolean
}

export const Composer = ({ onSendMessage, isConnected }: ComposerProps) => {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const maxLength = 500
  const remainingChars = maxLength - text.length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validation = validateMessage(text)
    if (!validation.isValid) {
      setError(validation.error)
      return
    }

    if (!isConnected) {
      setError('Not connected to server')
      return
    }

    setIsSending(true)
    setError(undefined)

    try {
      const sanitizedText = sanitizeText(text)
      const sanitizedAuthor = author.trim() || undefined
      
      await onSendMessage(sanitizedText, sanitizedAuthor)
      
      // Clear form on success
      setText('')
      setAuthor('')
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim() && !isSending) {
        handleSubmit(e)
      }
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [text])

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Author input (optional) */}
        <div>
          <label htmlFor="author" className="block text-sm font-medium text-gray-300 mb-1">
            Name (optional)
          </label>
          <input
            id="author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your name"
            maxLength={50}
            disabled={isSending}
          />
        </div>

        {/* Message textarea */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
            Message
          </label>
          <textarea
            ref={textareaRef}
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            rows={3}
            maxLength={maxLength}
            disabled={isSending}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-400">
              {remainingChars} characters remaining
            </p>
            <p className="text-xs text-gray-400">
              Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Send button */}
        <button
          type="submit"
          disabled={!text.trim() || isSending || !isConnected}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
        >
          {isSending ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  )
}
