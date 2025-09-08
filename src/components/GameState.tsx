import { GameState as GameStateType, MLBPlay, MLBGame } from '../lib/types'
import { getPlayerHeadshot } from '../lib/mlbHeadshots'
import { AtBatHistory } from './AtBatHistory'

interface GameStateProps {
  gameState: GameStateType
}

interface GameStateWithToggleProps extends GameStateProps {
  onToggleLiveMode?: (isLive: boolean) => void
  isLiveMode?: boolean
}

export const GameState = ({ gameState, isLiveMode }: GameStateWithToggleProps) => {
  const { game, currentAtBat, isLoading, error } = gameState



  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">⚾</div>
          <h3 className="text-white text-lg font-semibold mb-2">No Game Today</h3>
          <p className="text-gray-400 text-sm">
            {error || "The Mariners don't have a game scheduled for today."}
          </p>
        </div>
      </div>
    )
  }

  const isLive = isLiveMode || game.status?.abstractGameState === 'Live'
  
  // Handle different data structures from schedule vs detailed game API
  const homeTeam = game.teams?.home || game.gameData?.teams?.home
  const awayTeam = game.teams?.away || game.gameData?.teams?.away
  
  // Check for team ID - handle both structures: team.id (schedule) and id (game details)
  const homeTeamId = (homeTeam as any)?.team?.id || (homeTeam as any)?.id
  const awayTeamId = (awayTeam as any)?.team?.id || (awayTeam as any)?.id
  
  if (!homeTeamId || !awayTeamId) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">⚾</div>
          <h3 className="text-white text-lg font-semibold mb-2">Game Data Error</h3>
          <p className="text-gray-400 text-sm">
            Unable to load team information for this game.
          </p>
        </div>
      </div>
    )
  }
  
  const teamId = parseInt(import.meta.env.VITE_TEAM_ID || '136')
  const isMarinersHome = homeTeamId === teamId
  const marinersTeam = isMarinersHome ? homeTeam : awayTeam
  const opponentTeam = isMarinersHome ? awayTeam : homeTeam

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">⚾</div>
          <div>
            <h3 className="text-white text-lg font-semibold">
              {(marinersTeam as any)?.team?.name || (marinersTeam as any)?.name} vs {(opponentTeam as any)?.team?.name || (opponentTeam as any)?.name}
            </h3>
            <p className="text-gray-400 text-sm">
              {game.venue.name} • {new Date(game.gameDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isLive 
              ? 'bg-green-900 text-green-300' 
              : game.status?.abstractGameState === 'Final'
              ? 'bg-gray-700 text-gray-300'
              : 'bg-yellow-900 text-yellow-300'
          }`}>
            {game.status?.detailedState || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Score */}
      {game.liveData?.linescore && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="text-center">
              <div className="text-gray-400 text-sm">{(opponentTeam as any)?.team?.abbreviation || (opponentTeam as any)?.abbreviation}</div>
              <div className="text-white text-2xl font-bold">
                {game.liveData.linescore.teams.away.runs}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">
                {game.liveData.linescore.currentInningOrdinal}
              </div>
              <div className="text-white text-lg">
                {game.liveData.linescore.inningState}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">{(marinersTeam as any)?.team?.abbreviation || (marinersTeam as any)?.abbreviation}</div>
              <div className="text-white text-2xl font-bold">
                {game.liveData.linescore.teams.home.runs}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current At-Bat */}
      {currentAtBat && isLive && (
        <CurrentAtBat atBat={currentAtBat} />
      )}

      {/* At-Bat History - Enhanced with GUMBO data */}
      {isLive && game.gamePk && (
        <AtBatHistory 
          gamePk={game.gamePk} 
          currentAtBatIndex={currentAtBat?.about?.atBatIndex} 
        />
      )}

      {/* Final Play for Completed Games */}
      {!isLive && game.status?.abstractGameState === 'Final' && game.liveData?.plays && (
        <FinalPlay game={game} />
      )}

      {/* Game Status Message */}
      {!isLive && (
        <div className="text-center text-gray-400">
          {game.status?.abstractGameState === 'Final' 
            ? 'Game has ended - View predictions from this game' 
            : game.status?.abstractGameState === 'Scheduled'
            ? 'Game has not started yet'
            : 'Most recent game'}
        </div>
      )}
    </div>
  )
}

interface CurrentAtBatProps {
  atBat: MLBPlay
}

const CurrentAtBat = ({ atBat }: CurrentAtBatProps) => {
  const { matchup, count, about } = atBat
  const { batter, pitcher } = matchup

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="text-white font-semibold mb-3">Current At-Bat</h4>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Batter */}
        <div className="text-center">
          <div className="text-gray-400 text-sm mb-2">Batter</div>
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img
                src={getPlayerHeadshot(batter.id, { resolution: 120 })}
                alt={batter.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = 'none'
                  const nextElement = target.nextElementSibling as HTMLElement
                  if (nextElement) {
                    nextElement.style.display = 'flex'
                  }
                }}
              />
              <div 
                className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-lg hidden"
              >
                ⚾
              </div>
            </div>
            <div>
              <div className="text-white font-medium">{batter.fullName}</div>
              <div className="text-gray-400 text-xs">#{batter.primaryNumber}</div>
            </div>
          </div>
        </div>

        {/* Pitcher */}
        <div className="text-center">
          <div className="text-gray-400 text-sm mb-2">Pitcher</div>
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img
                src={getPlayerHeadshot(pitcher.id, { resolution: 120 })}
                alt={pitcher.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = 'none'
                  const nextElement = target.nextElementSibling as HTMLElement
                  if (nextElement) {
                    nextElement.style.display = 'flex'
                  }
                }}
              />
              <div 
                className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-lg hidden"
              >
                ⚾
              </div>
            </div>
            <div>
              <div className="text-white font-medium">{pitcher.fullName}</div>
              <div className="text-gray-400 text-xs">#{pitcher.primaryNumber}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Count */}
      <div className="flex justify-center items-center space-x-4 mb-3">
        <div className="text-center">
          <div className="text-gray-400 text-xs">Balls</div>
          <div className="text-white text-lg font-bold">{count.balls}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">Strikes</div>
          <div className="text-white text-lg font-bold">{count.strikes}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">Outs</div>
          <div className="text-white text-lg font-bold">{count.outs}</div>
        </div>
      </div>

      {/* Situation */}
      <div className="text-center text-gray-400 text-sm">
        {about.halfInning === 'top' ? 'Top' : 'Bottom'} of the {about.inning}{getOrdinal(about.inning)}
      </div>
    </div>
  )
}


interface FinalPlayProps {
  game: MLBGame
}

const FinalPlay = ({ game }: FinalPlayProps) => {
  const { liveData } = game
  
  if (!liveData?.plays?.allPlays || liveData.plays.allPlays.length === 0) {
    return null
  }

  // Get the last play
  const lastPlay = liveData.plays.allPlays[liveData.plays.allPlays.length - 1]
  
  if (!lastPlay) {
    return null
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="text-white font-semibold mb-3">Final Play</h4>
      
      <div className="text-gray-300 text-sm">
        <div className="mb-2">
          <span className="font-medium">{lastPlay.matchup.batter.fullName}</span>
          <span className="text-gray-400 ml-2">
            {lastPlay.about.halfInning === 'top' ? 'Top' : 'Bottom'} {lastPlay.about.inning}{getOrdinal(lastPlay.about.inning)}
          </span>
        </div>
        
        <div className="text-white">
          {lastPlay.result.description}
        </div>
        
        {lastPlay.result.rbi > 0 && (
          <div className="text-green-400 mt-1">
            {lastPlay.result.rbi} RBI{lastPlay.result.rbi > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function getOrdinal(num: number): string {
  const j = num % 10
  const k = num % 100
  if (j === 1 && k !== 11) {
    return 'st'
  }
  if (j === 2 && k !== 12) {
    return 'nd'
  }
  if (j === 3 && k !== 13) {
    return 'rd'
  }
  return 'th'
}
