import { useState, useEffect } from 'react'
import { RecentGame, RecentGamesResponse } from '../lib/types'
import { recentGamesService } from '../lib/recentGamesService'

export const RecentGames = () => {
  const [recentGames, setRecentGames] = useState<RecentGame[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRecentGames = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await recentGamesService.getRecentGames()
        
        if (response.success) {
          setRecentGames(response.recentGames)
        } else {
          setError(response.error || 'Failed to load recent games')
        }
      } catch (err) {
        console.error('Error loading recent games:', err)
        setError('Failed to load recent games')
      } finally {
        setIsLoading(false)
      }
    }

    loadRecentGames()
  }, [])

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">⚾</div>
          <p>Failed to load recent games</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (recentGames.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">⚾</div>
          <p>No recent games found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">Recent Games</h3>
      
      <div className="space-y-3">
        {recentGames.map((game) => (
          <RecentGameItem key={game.gamePk} game={game} />
        ))}
      </div>
    </div>
  )
}

interface RecentGameItemProps {
  game: RecentGame
}

const RecentGameItem = ({ game }: RecentGameItemProps) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  const getResultColor = (marinersWon: boolean) => {
    return marinersWon ? 'text-green-400' : 'text-red-400'
  }

  const getResultIcon = (marinersWon: boolean) => {
    return marinersWon ? 'W' : 'L'
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-700/50 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className={`text-lg font-bold ${getResultColor(game.marinersWon)}`}>
          {getResultIcon(game.marinersWon)}
        </div>
        <div>
          <div className="text-white text-sm font-medium">
            {game.isMarinersHome ? 'vs' : '@'} {game.opponentAbbreviation}
          </div>
          <div className="text-gray-400 text-xs">
            {formatDate(game.date)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-white text-sm font-medium">
          {game.isMarinersHome ? (
            <>
              <span className={getResultColor(game.marinersWon)}>{game.marinersScore}</span>
              <span className="text-gray-400 mx-1">-</span>
              <span className="text-gray-300">{game.opponentScore}</span>
            </>
          ) : (
            <>
              <span className="text-gray-300">{game.opponentScore}</span>
              <span className="text-gray-400 mx-1">-</span>
              <span className={getResultColor(game.marinersWon)}>{game.marinersScore}</span>
            </>
          )}
        </div>
        <div className="text-gray-400 text-xs">
          {game.venue}
        </div>
      </div>
    </div>
  )
}
