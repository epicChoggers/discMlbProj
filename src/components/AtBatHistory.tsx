import { useState, useEffect } from 'react'
import { gumboMlbService, GumboAtBatData } from '../lib/gumboMlbService'

interface AtBatHistoryProps {
  gamePk: number
  currentAtBatIndex?: number
}

export const AtBatHistory = ({ gamePk, currentAtBatIndex }: AtBatHistoryProps) => {
  const [atBatHistory, setAtBatHistory] = useState<GumboAtBatData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAtBatHistory = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('Loading at-bat history for game:', gamePk)
        
        // Get comprehensive game state to access all plays
        const gumboState = await gumboMlbService.getGumboGameState(gamePk)
        
        if (!gumboState.success || !gumboState.game?.liveData?.plays?.allPlays) {
          setError('No at-bat history available')
          return
        }

        const allPlays = gumboState.game.liveData.plays.allPlays
        
        // Filter to completed at-bats and sort by atBatIndex
        const completedAtBats = allPlays
          .filter((play: any) => 
            play.about?.atBatIndex && 
            play.about?.isComplete && 
            play.result?.event
          )
          .sort((a: any, b: any) => b.about.atBatIndex - a.about.atBatIndex) // Most recent first
          .slice(0, 10) // Show last 10 at-bats
        
        // Convert MLBPlay[] to GumboAtBatData[] format
        const convertedAtBats: GumboAtBatData[] = completedAtBats.map((play: any) => ({
          about: {
            atBatIndex: play.about.atBatIndex,
            inning: play.about.inning,
            halfInning: play.about.halfInning,
            isComplete: play.about.isComplete || true,
            isScoringPlay: play.about.isScoringPlay || false,
            hasReview: play.about.hasReview || false,
            hasOut: play.about.hasOut || false,
            captivatingIndex: play.about.captivatingIndex || play.about.atBatIndex
          },
          matchup: play.matchup,
          result: play.result,
          pitcherDetails: play.pitcherDetails,
          batterDetails: play.batterDetails,
          credits: play.credits,
          alignment: play.alignment
        }))
        
        setAtBatHistory(convertedAtBats)
        console.log(`Loaded ${completedAtBats.length} completed at-bats`)
        
      } catch (error) {
        console.error('Error loading at-bat history:', error)
        setError('Failed to load at-bat history')
      } finally {
        setIsLoading(false)
      }
    }

    loadAtBatHistory()
  }, [gamePk, currentAtBatIndex])

  const getOutcomeEmoji = (event: string) => {
    const emojiMap: Record<string, string> = {
      'single': '🏃',
      'double': '🏃🏃',
      'triple': '🏃🏃🏃',
      'home_run': '💥',
      'walk': '🚶',
      'strikeout': '❌',
      'strike_out': '❌',
      'field_out': '⚾',
      'ground_out': '⚾',
      'fly_out': '⚾',
      'pop_out': '⚾',
      'line_out': '⚾',
      'force_out': '⚾',
      'fielders_choice': '🤔',
      'hit_by_pitch': '💢',
      'sac_fly': '🙏',
      'sac_bunt': '🙏',
      'field_error': '😅',
      'catcher_interf': '😅',
      'double_play': '⚾⚾',
      'triple_play': '⚾⚾⚾'
    }
    
    return emojiMap[event] || '❓'
  }

  const getOutcomeColor = (event: string) => {
    if (['single', 'double', 'triple', 'home_run', 'walk', 'hit_by_pitch'].includes(event)) {
      return 'text-green-400'
    } else if (['strikeout', 'strike_out', 'field_out', 'ground_out', 'fly_out', 'pop_out', 'line_out', 'force_out'].includes(event)) {
      return 'text-red-400'
    } else {
      return 'text-yellow-400'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Loading at-bat history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-red-300 text-lg mb-2">⚠️</div>
          <h3 className="text-red-300 font-semibold mb-1">Unable to Load History</h3>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (atBatHistory.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">📊</div>
          <h3 className="text-gray-300 font-semibold mb-1">No At-Bat History</h3>
          <p className="text-gray-400 text-sm">No completed at-bats available yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">Recent At-Bat History</h3>
      
      <div className="space-y-3">
        {atBatHistory.map((atBat, index) => (
          <div 
            key={atBat.about?.atBatIndex || index}
            className={`bg-gray-700 rounded-lg p-3 border-l-4 ${
              currentAtBatIndex && atBat.about?.atBatIndex === currentAtBatIndex - 1
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {getOutcomeEmoji(atBat.result?.event || '')}
                </div>
                <div>
                  <div className="text-white font-medium">
                    At-Bat #{atBat.about?.atBatIndex}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {atBat.about?.inning} {atBat.about?.halfInning}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${getOutcomeColor(atBat.result?.event || '')}`}>
                  {atBat.result?.event?.replace('_', ' ').toUpperCase() || 'Unknown'}
                </div>
                {atBat.result?.rbi > 0 && (
                  <div className="text-green-400 text-sm">
                    {atBat.result.rbi} RBI
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="text-blue-300">
                  <span className="text-gray-400">P:</span> {atBat.matchup?.pitcher?.fullName}
                </div>
                <div className="text-green-300">
                  <span className="text-gray-400">B:</span> {atBat.matchup?.batter?.fullName}
                </div>
              </div>
              <div className="text-gray-400">
                {atBat.matchup?.batSide?.code} vs {atBat.matchup?.pitchHand?.code}
              </div>
            </div>
            
            {atBat.result?.description && (
              <div className="mt-2 text-xs text-gray-400 italic">
                {atBat.result.description}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-center">
          <div className="text-gray-400 text-xs">
            Showing last {atBatHistory.length} completed at-bats
          </div>
          {currentAtBatIndex && (
            <div className="text-blue-400 text-xs mt-1">
              Current at-bat: #{currentAtBatIndex}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
