import { GameState as GameStateType, MLBPlay } from '../lib/types'
import { simulationService } from '../lib/simulationService'

interface GameStateProps {
  gameState: GameStateType
}

interface GameStateWithToggleProps extends GameStateProps {
  onToggleLiveMode?: (isLive: boolean) => void
  isLiveMode?: boolean
  isSimulationMode?: boolean
}

export const GameState = ({ gameState, onToggleLiveMode, isLiveMode, isSimulationMode }: GameStateWithToggleProps) => {
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

  const isLive = isLiveMode || isSimulationMode || game.status.abstractGameState === 'Live'
  const isMarinersHome = game.teams.home.team.id === 136
  const marinersTeam = isMarinersHome ? game.teams.home : game.teams.away
  const opponentTeam = isMarinersHome ? game.teams.away : game.teams.home

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">⚾</div>
          <div>
            <h3 className="text-white text-lg font-semibold">
              {marinersTeam.team.name} vs {opponentTeam.team.name}
            </h3>
            <p className="text-gray-400 text-sm">
              {game.venue.name} • {new Date(game.gameDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {game.status.abstractGameState === 'Final' && onToggleLiveMode && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Simulation Mode:</span>
              <button
                onClick={() => onToggleLiveMode(!isSimulationMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                  isSimulationMode ? 'bg-blue-600' : 'bg-gray-600'
                }`}
                title={isSimulationMode ? 'Turn off simulation mode' : 'Turn on simulation mode to test predictions'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isSimulationMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isLive 
              ? 'bg-green-900 text-green-300' 
              : game.status.abstractGameState === 'Final'
              ? 'bg-gray-700 text-gray-300'
              : 'bg-yellow-900 text-yellow-300'
          }`}>
            {isSimulationMode ? 'Live (Simulation Mode)' : game.status.detailedState}
          </div>
        </div>
      </div>

      {/* Score */}
      {game.liveData?.linescore && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="text-center">
              <div className="text-gray-400 text-sm">{opponentTeam.team.abbreviation}</div>
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
              <div className="text-gray-400 text-sm">{marinersTeam.team.abbreviation}</div>
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

      {/* Simulated Current At-Bat for Simulation Mode */}
      {isSimulationMode && !currentAtBat && game.liveData?.plays && (
        <SimulatedCurrentAtBat game={game} />
      )}

      {/* Final Play for Completed Games */}
      {!isLive && game.status.abstractGameState === 'Final' && game.liveData?.plays && (
        <FinalPlay game={game} />
      )}

      {/* Game Status Message */}
      {!isLive && (
        <div className="text-center text-gray-400">
          {game.status.abstractGameState === 'Final' 
            ? 'Game has ended - View predictions from this game' 
            : game.status.abstractGameState === 'Scheduled'
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
          <div className="text-gray-400 text-sm mb-1">Batter</div>
          <div className="text-white font-medium">{batter.fullName}</div>
          <div className="text-gray-400 text-xs">#{batter.primaryNumber}</div>
        </div>

        {/* Pitcher */}
        <div className="text-center">
          <div className="text-gray-400 text-sm mb-1">Pitcher</div>
          <div className="text-white font-medium">{pitcher.fullName}</div>
          <div className="text-gray-400 text-xs">#{pitcher.primaryNumber}</div>
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

interface SimulatedCurrentAtBatProps {
  game: MLBGame
}

const SimulatedCurrentAtBat = ({ game }: SimulatedCurrentAtBatProps) => {
  const { liveData } = game
  
  if (!liveData?.plays?.allPlays || liveData.plays.allPlays.length === 0) {
    return null
  }

  // Get the last play and simulate it as current
  const lastPlay = liveData.plays.allPlays[liveData.plays.allPlays.length - 1]
  
  if (!lastPlay) {
    return null
  }

  // Create a simulated "current" at-bat by modifying the last play
  const simulatedAtBat = {
    ...lastPlay,
    about: {
      ...lastPlay.about,
      atBatIndex: lastPlay.about.atBatIndex + 1 // Make it the "next" at-bat
    },
    count: {
      balls: 0,
      strikes: 0,
      outs: lastPlay.count.outs
    },
    result: {
      type: 'at_bat',
      event: '',
      description: '',
      rbi: 0,
      awayScore: lastPlay.result.awayScore,
      homeScore: lastPlay.result.homeScore
    }
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="text-white font-semibold mb-3">Current At-Bat (Simulated)</h4>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Batter */}
        <div className="text-center">
          <div className="text-gray-400 text-sm mb-1">Batter</div>
          <div className="text-white font-medium">{simulatedAtBat.matchup.batter.fullName}</div>
          <div className="text-gray-400 text-xs">#{simulatedAtBat.matchup.batter.primaryNumber}</div>
          <div className="text-gray-500 text-xs">{simulatedAtBat.matchup.batter.primaryPosition?.name || 'Unknown'}</div>
        </div>

        {/* Pitcher */}
        <div className="text-center">
          <div className="text-gray-400 text-sm mb-1">Pitcher</div>
          <div className="text-white font-medium">{simulatedAtBat.matchup.pitcher.fullName}</div>
          <div className="text-gray-400 text-xs">#{simulatedAtBat.matchup.pitcher.primaryNumber}</div>
          <div className="text-gray-500 text-xs">{simulatedAtBat.matchup.pitcher.primaryPosition?.name || 'Unknown'}</div>
        </div>
      </div>

      {/* Count */}
      <div className="flex justify-center items-center space-x-4 mb-3">
        <div className="text-center">
          <div className="text-gray-400 text-xs">Balls</div>
          <div className="text-white text-lg font-bold">{simulatedAtBat.count.balls}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">Strikes</div>
          <div className="text-white text-lg font-bold">{simulatedAtBat.count.strikes}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">Outs</div>
          <div className="text-white text-lg font-bold">{simulatedAtBat.count.outs}</div>
        </div>
      </div>

      {/* Situation */}
      <div className="text-center text-gray-400 text-sm mb-3">
        {simulatedAtBat.about.halfInning === 'top' ? 'Top' : 'Bottom'} of the {simulatedAtBat.about.inning}{getOrdinal(simulatedAtBat.about.inning)}
      </div>

      {/* Matchup Details */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="text-center">
          <div className="text-gray-500">Batting</div>
          <div className="text-white">{simulatedAtBat.matchup.batSide?.description || 'Unknown'}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Pitching</div>
          <div className="text-white">{simulatedAtBat.matchup.pitchHand?.description || 'Unknown'}</div>
        </div>
      </div>
      
      <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700 rounded text-center">
        <div className="text-blue-300 text-xs mb-1">
          🧪 <strong>Simulation Mode Active</strong>
        </div>
        <div className="text-blue-400 text-xs mb-2">
          Simulating the next at-bat after: {lastPlay.matchup.batter.fullName} ({lastPlay.result.event})
        </div>
        <button
          onClick={() => simulationService.triggerResolution()}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
        >
          🧪 Test Resolution
        </button>
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
