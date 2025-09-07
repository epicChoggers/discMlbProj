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
  streakCount?: number // Current streak count when this prediction was made
  streakBonus?: number // Bonus points earned from streak
  user?: {
    id: string
    email: string
    raw_user_meta_data?: {
      full_name?: string
      preferred_username?: string
      [key: string]: any
    }
  }
}

// MLB API Event Types - Based on actual API data
export type AtBatOutcome = 
  // Hits (plateAppearance: true, hit: true)
  | 'single'
  | 'double' 
  | 'triple'
  | 'home_run'
  
  // Walks and Hit by Pitch (plateAppearance: true, hit: false)
  | 'walk'
  | 'intent_walk'
  | 'hit_by_pitch'
  
  // Strikeouts (plateAppearance: true, hit: false)
  | 'strikeout'
  | 'strike_out'
  | 'strikeout_double_play'
  | 'strikeout_triple_play'
  
  // Field Outs (plateAppearance: true, hit: false)
  | 'field_out'
  | 'fielders_choice'
  | 'fielders_choice_out'
  | 'force_out'
  | 'grounded_into_double_play'
  | 'grounded_into_triple_play'
  | 'triple_play'
  
  // Sacrifice Plays (plateAppearance: true, hit: false)
  | 'sac_fly'
  | 'sac_bunt'
  | 'sac_fly_double_play'
  | 'sac_bunt_double_play'
  
  // Errors and Interference (plateAppearance: true, hit: false)
  | 'field_error'
  | 'catcher_interf'
  | 'batter_interference'
  | 'fan_interference'
  
  // Double Plays (plateAppearance: true, hit: false)
  | 'double_play'
  
  // Non-plate appearance events (plateAppearance: false) - these should not be at-bat outcomes
  // but we include them for completeness in case they appear in play data
  | 'pickoff_1b'
  | 'pickoff_2b'
  | 'pickoff_3b'
  | 'pickoff_error_1b'
  | 'pickoff_error_2b'
  | 'pickoff_error_3b'
  | 'stolen_base'
  | 'stolen_base_2b'
  | 'stolen_base_3b'
  | 'stolen_base_home'
  | 'caught_stealing'
  | 'caught_stealing_2b'
  | 'caught_stealing_3b'
  | 'caught_stealing_home'
  | 'wild_pitch'
  | 'passed_ball'
  | 'balk'
  | 'forced_balk'
  | 'other_advance'
  | 'runner_double_play'
  | 'cs_double_play'
  | 'defensive_indiff'
  | 'other_out'
  
  // Administrative events
  | 'batter_timeout'
  | 'mound_visit'
  | 'no_pitch'
  | 'pitcher_step_off'
  | 'injury'
  | 'ejection'
  | 'game_advisory'
  | 'os_ruling_pending_prior'
  | 'os_ruling_pending_primary'
  | 'at_bat_start'
  | 'batter_turn'
  | 'fielder_interference'
  | 'runner_interference'
  | 'runner_placed'
  | 'pitching_substitution'
  | 'offensive_substitution'
  | 'defensive_substitution'
  | 'defensive_switch'
  | 'umpire_substitution'
  | 'pitcher_switch'
  | 'pickoff_caught_stealing_2b'
  | 'pickoff_caught_stealing_3b'
  | 'pickoff_caught_stealing_home'

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
    // Hits
    case 'single':
    case 'double':
    case 'triple':
    case 'home_run':
      return 'hit'
    
    // Walks
    case 'walk':
    case 'intent_walk':
      return 'walk'
    
    // Strikeouts
    case 'strikeout':
    case 'strike_out':
    case 'strikeout_double_play':
    case 'strikeout_triple_play':
      return 'strikeout'
    
    // Field Outs
    case 'field_out':
    case 'fielders_choice':
    case 'fielders_choice_out':
    case 'force_out':
    case 'grounded_into_double_play':
    case 'grounded_into_triple_play':
    case 'triple_play':
    case 'double_play':
      return 'out'
    
    // Sacrifice Plays
    case 'sac_fly':
    case 'sac_bunt':
    case 'sac_fly_double_play':
    case 'sac_bunt_double_play':
      return 'sacrifice'
    
    // Errors and Interference
    case 'field_error':
    case 'catcher_interf':
    case 'batter_interference':
    case 'fan_interference':
      return 'error'
    
    // Hit by Pitch
    case 'hit_by_pitch':
      return 'hit_by_pitch'
    
    // Non-plate appearance events (should not be at-bat outcomes)
    case 'pickoff_1b':
    case 'pickoff_2b':
    case 'pickoff_3b':
    case 'pickoff_error_1b':
    case 'pickoff_error_2b':
    case 'pickoff_error_3b':
    case 'stolen_base':
    case 'stolen_base_2b':
    case 'stolen_base_3b':
    case 'stolen_base_home':
    case 'caught_stealing':
    case 'caught_stealing_2b':
    case 'caught_stealing_3b':
    case 'caught_stealing_home':
    case 'wild_pitch':
    case 'passed_ball':
    case 'balk':
    case 'forced_balk':
    case 'other_advance':
    case 'runner_double_play':
    case 'cs_double_play':
    case 'defensive_indiff':
    case 'other_out':
      return 'baserunning'
    
    // Administrative events
    case 'batter_timeout':
    case 'mound_visit':
    case 'no_pitch':
    case 'pitcher_step_off':
    case 'injury':
    case 'ejection':
    case 'game_advisory':
    case 'os_ruling_pending_prior':
    case 'os_ruling_pending_primary':
    case 'at_bat_start':
    case 'batter_turn':
    case 'fielder_interference':
    case 'runner_interference':
    case 'runner_placed':
    case 'pitching_substitution':
    case 'offensive_substitution':
    case 'defensive_substitution':
    case 'defensive_switch':
    case 'umpire_substitution':
    case 'pitcher_switch':
    case 'pickoff_caught_stealing_2b':
    case 'pickoff_caught_stealing_3b':
    case 'pickoff_caught_stealing_home':
      return 'administrative'
    
    default:
      return 'unknown'
  }
}

// Helper function to get point values for outcomes (for UI display)
export const getOutcomePoints = (outcome: AtBatOutcome): { base: number; withBonus: number; bonusPercent: number } => {
  // Define base points for each outcome type
  const getBasePoints = (outcome: AtBatOutcome): number => {
    switch (outcome) {
      // Hits - High value for rare outcomes
      case 'home_run': return 20
      case 'triple': return 15
      case 'double': return 10
      case 'single': return 5
      
      // Walks - Moderate value
      case 'walk': return 4
      case 'intent_walk': return 4
      case 'hit_by_pitch': return 3
      
      // Strikeouts - Moderate value
      case 'strikeout': return 3
      case 'strike_out': return 3
      case 'strikeout_double_play': return 2
      case 'strikeout_triple_play': return 1
      
      // Field Outs - Low value
      case 'field_out': return 1
      case 'fielders_choice': return 1
      case 'fielders_choice_out': return 1
      case 'force_out': return 1
      case 'grounded_into_double_play': return 1
      case 'grounded_into_triple_play': return 1
      case 'triple_play': return 1
      case 'double_play': return 1
      
      // Sacrifice Plays - Moderate value
      case 'sac_fly': return 3
      case 'sac_bunt': return 2
      case 'sac_fly_double_play': return 2
      case 'sac_bunt_double_play': return 1
      
      // Errors and Interference - Low value
      case 'field_error': return 1
      case 'catcher_interf': return 2
      case 'batter_interference': return 1
      case 'fan_interference': return 1
      
      // Non-plate appearance events - Should not be at-bat outcomes
      case 'pickoff_1b':
      case 'pickoff_2b':
      case 'pickoff_3b':
      case 'pickoff_error_1b':
      case 'pickoff_error_2b':
      case 'pickoff_error_3b':
      case 'stolen_base':
      case 'stolen_base_2b':
      case 'stolen_base_3b':
      case 'stolen_base_home':
      case 'caught_stealing':
      case 'caught_stealing_2b':
      case 'caught_stealing_3b':
      case 'caught_stealing_home':
      case 'wild_pitch':
      case 'passed_ball':
      case 'balk':
      case 'forced_balk':
      case 'other_advance':
      case 'runner_double_play':
      case 'cs_double_play':
      case 'defensive_indiff':
      case 'other_out':
        return 0 // These should not be at-bat outcomes
      
      // Administrative events - Should not be at-bat outcomes
      case 'batter_timeout':
      case 'mound_visit':
      case 'no_pitch':
      case 'pitcher_step_off':
      case 'injury':
      case 'ejection':
      case 'game_advisory':
      case 'os_ruling_pending_prior':
      case 'os_ruling_pending_primary':
      case 'at_bat_start':
      case 'batter_turn':
      case 'fielder_interference':
      case 'runner_interference':
      case 'runner_placed':
      case 'pitching_substitution':
      case 'offensive_substitution':
      case 'defensive_substitution':
      case 'defensive_switch':
      case 'umpire_substitution':
      case 'pitcher_switch':
      case 'pickoff_caught_stealing_2b':
      case 'pickoff_caught_stealing_3b':
      case 'pickoff_caught_stealing_home':
        return 0 // These should not be at-bat outcomes
      
      default:
        return 1
    }
  }

  // Define risk multipliers for outcomes (higher risk = higher reward)
  const getMultiplier = (outcome: AtBatOutcome): number => {
    switch (outcome) {
      // Rare outcomes get higher multipliers
      case 'home_run': return 2.0  // +100% bonus
      case 'triple': return 1.8   // +80% bonus
      case 'double': return 1.5   // +50% bonus
      case 'single': return 1.2   // +20% bonus
      
      // Moderate outcomes get small bonuses
      case 'walk': return 1.1     // +10% bonus
      case 'intent_walk': return 1.1
      case 'hit_by_pitch': return 1.1
      case 'strikeout': return 1.1
      case 'strike_out': return 1.1
      case 'sac_fly': return 1.1
      
      // Common outcomes get no bonus
      case 'field_out':
      case 'fielders_choice':
      case 'fielders_choice_out':
      case 'force_out':
      case 'sac_bunt':
      case 'field_error':
      case 'catcher_interf':
      case 'batter_interference':
      case 'fan_interference':
      case 'strikeout_double_play':
      case 'strikeout_triple_play':
      case 'grounded_into_double_play':
      case 'grounded_into_triple_play':
      case 'triple_play':
      case 'double_play':
      case 'sac_fly_double_play':
      case 'sac_bunt_double_play':
        return 1.0
      
      // Non-at-bat events get no points
      default:
        return 1.0
    }
  }

  const base = getBasePoints(outcome)
  const multiplier = getMultiplier(outcome)
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