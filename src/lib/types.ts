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

// Recent Games Types
export interface RecentGame {
  gamePk: number
  date: string
  opponent: string
  opponentAbbreviation: string
  marinersScore: number
  opponentScore: number
  marinersWon: boolean
  isMarinersHome: boolean
  venue: string
  gameType: string
  status: string
}

export interface RecentGamesResponse {
  success: boolean
  recentGames: RecentGame[]
  totalGames: number
  lastUpdated: string
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
    isComplete?: boolean
    startTime?: string
    endTime?: string
    isScoringPlay?: boolean
    hasOut?: boolean
    captivatingIndex?: number
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
  isPartialCredit?: boolean // True when prediction got category right but not exact outcome
  pointsEarned?: number // Points earned for this prediction (1 or 3)
  batter?: {
    id: number
    name: string
    position: string
    batSide: string
  } | null
  pitcher?: {
    id: number
    name: string
    hand: string
  } | null
  user?: {
    id: string
    email: string
    avatar_url?: string
    raw_user_meta_data?: {
      full_name?: string
      preferred_username?: string
      avatar_url?: string
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
  
  // Unknown outcome (when resolution fails)
  | 'unknown'

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
    
    // Strikeouts (all outs)
    case 'strikeout':
    case 'strike_out':
    case 'strikeout_double_play':
    case 'strikeout_triple_play':
      return 'out'
    
    // Field Outs (all outs)
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
    
    case 'unknown':
      return 'unknown'
    
    default:
      return 'unknown'
  }
}

// NEW UNIFIED PARTIAL CREDIT SCORING SYSTEM
// Simple, clear, and balanced point values based on rarity and difficulty

export const getOutcomePoints = (outcome: AtBatOutcome): { exact: number; category: number; description: string } => {
  switch (outcome) {
    // RARE OUTCOMES (4-6 points) - Hard to predict, high reward
    case 'home_run': return { exact: 6, category: 3, description: 'Home Run - Most exciting outcome!' }
    case 'triple': return { exact: 5, category: 3, description: 'Triple - Very rare hit!' }
    
    // MODERATE OUTCOMES (2-4 points) - Balanced risk/reward
    case 'double': return { exact: 4, category: 3, description: 'Double - Extra base hit' }
    case 'single': return { exact: 3, category: 3, description: 'Single - Base hit' }
    case 'walk': return { exact: 3, category: 2, description: 'Walk - Reaches base safely' }
    case 'intent_walk': return { exact: 3, category: 2, description: 'Intentional Walk' }
    case 'hit_by_pitch': return { exact: 3, category: 2, description: 'Hit by Pitch' }
    case 'strikeout': return { exact: 3, category: 2, description: 'Strikeout - Three strikes' }
    case 'strike_out': return { exact: 3, category: 2, description: 'Strikeout' }
    
    // COMMON OUTCOMES (1-2 points) - Easy to predict, lower reward
    case 'field_out': return { exact: 2, category: 2, description: 'Field Out - Most common outcome' }
    case 'fielders_choice': return { exact: 2, category: 2, description: 'Fielders Choice' }
    case 'fielders_choice_out': return { exact: 2, category: 2, description: 'Fielders Choice Out' }
    case 'force_out': return { exact: 2, category: 2, description: 'Force Out' }
    case 'sac_fly': return { exact: 2, category: 2, description: 'Sacrifice Fly' }
    case 'sac_bunt': return { exact: 2, category: 2, description: 'Sacrifice Bunt' }
    case 'catcher_interf': return { exact: 2, category: 2, description: 'Catcher Interference' }
    
    // SPECIAL OUTCOMES (1-3 points) - Situational
    case 'strikeout_double_play': return { exact: 2, category: 2, description: 'Strikeout Double Play' }
    case 'strikeout_triple_play': return { exact: 3, category: 2, description: 'Strikeout Triple Play' }
    case 'grounded_into_double_play': return { exact: 1, category: 2, description: 'Grounded into Double Play' }
    case 'grounded_into_triple_play': return { exact: 2, category: 2, description: 'Grounded into Triple Play' }
    case 'triple_play': return { exact: 3, category: 2, description: 'Triple Play' }
    case 'double_play': return { exact: 1, category: 2, description: 'Double Play' }
    case 'sac_fly_double_play': return { exact: 1, category: 2, description: 'Sacrifice Fly Double Play' }
    case 'sac_bunt_double_play': return { exact: 1, category: 2, description: 'Sacrifice Bunt Double Play' }
    
    // ERROR OUTCOMES (1-2 points) - Uncommon but not rare
    case 'field_error': return { exact: 2, category: 2, description: 'Field Error' }
    case 'batter_interference': return { exact: 2, category: 2, description: 'Batter Interference' }
    case 'fan_interference': return { exact: 2, category: 2, description: 'Fan Interference' }
    
    // NON-PLATE APPEARANCE EVENTS (0 points) - Should not be at-bat outcomes
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
      return { exact: 0, category: 0, description: 'Non-plate appearance event' }
    
    // ADMINISTRATIVE EVENTS (0 points) - Should not be at-bat outcomes
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
      return { exact: 0, category: 0, description: 'Administrative event' }
    
    case 'unknown':
      return { exact: 0, category: 0, description: 'Unknown outcome' }
    
    default:
      return { exact: 1, category: 1, description: 'Generic outcome' }
  }
}

// Helper function to get category points for partial credit
export const getCategoryPoints = (category: string): number => {
  switch (category) {
    case 'hit': return 2      // Hit category (single, double, triple, home run)
    case 'out': return 1       // Out category (strikeout, field_out, etc.)
    case 'walk': return 2      // Walk category
    case 'sacrifice': return 1 // Sacrifice category
    case 'error': return 1     // Error category
    case 'hit_by_pitch': return 2 // Hit by pitch category
    case 'baserunning': return 0 // Baserunning events (should not be at-bat outcomes)
    case 'administrative': return 0 // Administrative events (should not be at-bat outcomes)
    case 'unknown': return 0   // Unknown events
    default: return 1
  }
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

// Pitcher Prediction Types
export interface PitcherPrediction {
  id: string
  userId: string
  gamePk: number
  pitcherId: number
  pitcherName: string
  predictedIp: number // e.g., 7.1, 6.2
  predictedHits: number
  predictedEarnedRuns: number
  predictedWalks: number
  predictedStrikeouts: number
  actualIp?: number
  actualHits?: number
  actualEarnedRuns?: number
  actualWalks?: number
  actualStrikeouts?: number
  pointsEarned?: number
  createdAt: string
  resolvedAt?: string
  user?: {
    id: string
    username: string
    avatar_url?: string
  }
}

export interface PitcherPredictionLeaderboardEntry {
  user_id: string
  username: string
  avatar_url: string | null
  total_predictions: number
  resolved_predictions: number
  total_points: number
  avg_points_per_prediction: number
  rank: number
}

export interface PitcherPredictionLeaderboard {
  entries: PitcherPredictionLeaderboardEntry[]
  total_users: number
  last_updated: string
}

// MLB Pitcher Data Types
export interface MLBPitcher {
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
  headshotUrl?: string // MLB player headshot URL from spots API
}

export interface MLBPitcherStats {
  pitcherId: number
  pitcherName: string
  ip: number
  hits: number
  earnedRuns: number
  walks: number
  strikeouts: number
  era?: number
  whip?: number
}