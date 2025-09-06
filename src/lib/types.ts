export interface Message {
  id: string
  created_at: string
  author?: string
  text: string
}

export interface PendingMessage {
  id: string
  text: string
  author?: string
  isPending: true
}

export type MessageOrPending = Message | PendingMessage

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error?: string
}

export interface RealtimeStatus {
  isConnected: boolean
  isConnecting: boolean
  error?: string
}

// MLB Game Data Types
export interface MLBGame {
  gamePk: number
  gameDate: string
  status: {
    abstractGameState: string
    detailedState: string
    codedGameState: string
  }
  teams: {
    away: MLBTeam
    home: MLBTeam
  }
  venue: {
    name: string
  }
  gameData?: {
    game: {
      pk: number
      type: string
      season: string
    }
    teams: {
      away: MLBTeam
      home: MLBTeam
    }
    players: Record<string, MLBPlayer>
  }
  liveData?: {
    plays: {
      allPlays: MLBPlay[]
      currentPlay?: MLBPlay
    }
    linescore: {
      currentInning: number
      currentInningOrdinal: string
      inningState: string
      teams: {
        away: {
          runs: number
          hits: number
          errors: number
        }
        home: {
          runs: number
          hits: number
          errors: number
        }
      }
    }
    boxscore: {
      teams: {
        away: MLBTeamBoxscore
        home: MLBTeamBoxscore
      }
    }
  }
}

export interface MLBTeam {
  team: {
    id: number
    name: string
    abbreviation: string
  }
  score?: number
}

export interface MLBPlayer {
  id: number
  fullName: string
  firstName: string
  lastName: string
  primaryNumber: string
  currentTeam: {
    id: number
    name: string
  }
  primaryPosition: {
    code: string
    name: string
    type: string
  }
}

export interface MLBPlay {
  about: {
    atBatIndex: number
    halfInning: string
    inning: number
    isTopInning: boolean
  }
  count: {
    balls: number
    strikes: number
    outs: number
  }
  matchup: {
    batter: MLBPlayer
    pitcher: MLBPlayer
    batSide: {
      code: string
      description: string
    }
    pitchHand: {
      code: string
      description: string
    }
  }
  result: {
    type: string
    event: string
    description: string
    rbi: number
    awayScore: number
    homeScore: number
  }
  playEvents: MLBPlayEvent[]
}

export interface MLBPlayEvent {
  details: {
    type: {
      code: string
      description: string
    }
    description: string
    call?: {
      code: string
      description: string
    }
  }
  count: {
    balls: number
    strikes: number
    outs: number
  }
  pitchData?: {
    startSpeed: number
    endSpeed: number
    strikeZoneTop: number
    strikeZoneBottom: number
    coordinates: {
      x: number
      y: number
    }
  }
}

export interface MLBTeamBoxscore {
  team: {
    id: number
    name: string
  }
  teamStats: {
    batting: {
      atBats: number
      runs: number
      hits: number
      doubles: number
      triples: number
      homeRuns: number
      rbi: number
      walks: number
      strikeOuts: number
    }
  }
}

// Prediction Types
export interface AtBatPrediction {
  id: string
  userId: string
  gamePk: number
  atBatIndex: number
  prediction: AtBatOutcome
  predictionCategory?: string // The initial category selected (hit, out, other, etc.)
  createdAt: string
  resolvedAt?: string
  actualOutcome?: AtBatOutcome
  actualCategory?: string // The category of the actual outcome
  isCorrect?: boolean
  pointsEarned?: number // Points earned for this prediction (1 or 3)
}

export type AtBatOutcome = 
  | 'single'
  | 'double' 
  | 'triple'
  | 'home_run'
  | 'walk'
  | 'strikeout'
  | 'groundout'
  | 'flyout'
  | 'popout'
  | 'lineout'
  | 'fielders_choice'
  | 'error'
  | 'hit_by_pitch'
  | 'sacrifice'
  | 'other'

export interface PredictionStats {
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  streak: number
  bestStreak: number
  totalPoints: number
  exactPredictions: number
  categoryPredictions: number
}

// Helper function to determine the category of an outcome
export const getOutcomeCategory = (outcome: AtBatOutcome): string => {
  switch (outcome) {
    case 'strikeout':
      return 'strikeout'
    case 'walk':
      return 'walk'
    case 'home_run':
      return 'home_run'
    case 'single':
    case 'double':
    case 'triple':
      return 'hit'
    case 'groundout':
    case 'flyout':
    case 'popout':
    case 'lineout':
    case 'fielders_choice':
      return 'out'
    case 'hit_by_pitch':
    case 'error':
    case 'sacrifice':
    case 'other':
      return 'other'
    default:
      return 'other'
  }
}

// Helper function to get point values for outcomes (for UI display)
export const getOutcomePoints = (outcome: AtBatOutcome): { base: number; withBonus: number; bonusPercent: number } => {
  const basePoints: Record<AtBatOutcome, number> = {
    'home_run': 15,
    'triple': 12,
    'double': 8,
    'single': 4,
    'walk': 3,
    'strikeout': 2,
    'groundout': 1,
    'flyout': 1,
    'popout': 1,
    'lineout': 1,
    'fielders_choice': 1,
    'hit_by_pitch': 2,
    'error': 1,
    'sacrifice': 1,
    'other': 1
  }

  const multipliers: Record<AtBatOutcome, number> = {
    'home_run': 1.5,
    'triple': 1.5,
    'double': 1.25,
    'single': 1.0,
    'walk': 1.0,
    'strikeout': 1.0,
    'groundout': 1.0,
    'flyout': 1.0,
    'popout': 1.0,
    'lineout': 1.0,
    'fielders_choice': 1.0,
    'hit_by_pitch': 1.0,
    'error': 1.0,
    'sacrifice': 1.0,
    'other': 1.0
  }

  const base = basePoints[outcome] || 1
  const multiplier = multipliers[outcome] || 1.0
  const withBonus = Math.round(base * multiplier)
  const bonusPercent = Math.round((multiplier - 1) * 100)

  return { base, withBonus, bonusPercent }
}

export interface GameState {
  game: MLBGame | null
  currentAtBat: MLBPlay | null
  isLoading: boolean
  error?: string
  lastUpdated: string
  predictionWindowOpen?: boolean
  predictionWindowExpires?: string
  lastAtBatIndex?: number
}

// User and Authentication Types
export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  global_name?: string
  display_name?: string
}

export interface UserProfile {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// Leaderboard Types
export interface LeaderboardEntry {
  user_id: string
  username: string
  avatar_url: string | null
  total_predictions: number
  correct_predictions: number
  accuracy: number
  streak: number
  best_streak: number
  rank: number
  total_outcomes: number
  correct_outcomes: number
  total_exact_outcomes: number
  correct_exact_outcomes: number
  total_points: number
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  total_users: number
  last_updated: string
}