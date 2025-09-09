// import { MLBPitcherStats } from '../types' // Not currently used

export interface PitcherGameStats {
  pitcherId: number
  pitcherName: string
  ip: number
  hits: number
  earnedRuns: number
  walks: number
  strikeouts: number
  isStartingPitcher: boolean
  isFinished: boolean
}

export class PitcherStatsService {
  private marinersTeamId: number

  constructor() {
    this.marinersTeamId = parseInt(process.env.VITE_TEAM_ID || '136')
  }

  /**
   * Extract pitcher statistics from MLB game feed data
   */
  extractPitcherStats(gameData: any): PitcherGameStats[] {
    const pitcherStats: PitcherGameStats[] = []
    
    if (!gameData?.liveData?.boxscore?.teams) {
      return pitcherStats
    }

    const { home, away } = gameData.liveData.boxscore.teams
    
    // Extract stats from both teams
    this.extractTeamPitcherStats(home, pitcherStats)
    this.extractTeamPitcherStats(away, pitcherStats)
    
    return pitcherStats
  }

  /**
   * Extract pitcher statistics for a specific team
   */
  private extractTeamPitcherStats(team: any, pitcherStats: PitcherGameStats[]): void {
    if (!team?.players) {
      return
    }

    // Find the starting pitcher for this team
    const startingPitcher = this.findStartingPitcher(team)
    
    Object.values(team.players).forEach((player: any) => {
      if (player?.stats?.pitching) {
        const stats = player.stats.pitching
        const pitcherId = parseInt(player.person.id)
        const pitcherName = player.person.fullName
        
        // Skip if no meaningful stats
        if (stats.inningsPitched === '0.0' && stats.hits === 0 && stats.earnedRuns === 0 && 
            stats.baseOnBalls === 0 && stats.strikeOuts === 0) {
          return
        }

        const pitcherStat: PitcherGameStats = {
          pitcherId,
          pitcherName,
          ip: this.parseInningsPitched(stats.inningsPitched),
          hits: stats.hits || 0,
          earnedRuns: stats.earnedRuns || 0,
          walks: stats.baseOnBalls || 0,
          strikeouts: stats.strikeOuts || 0,
          isStartingPitcher: startingPitcher?.person?.id === player.person.id,
          isFinished: this.isPitcherFinished(player)
        }

        pitcherStats.push(pitcherStat)
      }
    })
  }

  /**
   * Find the starting pitcher for a team
   */
  private findStartingPitcher(team: any): any {
    if (!team?.players) {
      return null
    }

    // Look for the pitcher with the most innings pitched (likely the starter)
    let startingPitcher = null
    let maxInnings = 0

    Object.values(team.players).forEach((player: any) => {
      if (player?.stats?.pitching) {
        const innings = this.parseInningsPitched(player.stats.pitching.inningsPitched)
        if (innings > maxInnings) {
          maxInnings = innings
          startingPitcher = player
        }
      }
    })

    return startingPitcher
  }

  /**
   * Check if a pitcher has finished their outing
   */
  private isPitcherFinished(player: any): boolean {
    // A pitcher is considered finished if:
    // 1. They have stats but are no longer the current pitcher
    // 2. The game is final
    // 3. They have been substituted out (we'd need to check play events for this)
    
    // For now, we'll use a simple heuristic: if they have stats and the game is not live,
    // or if they're not the current pitcher, they're finished
    const hasStats = player?.stats?.pitching && 
      (player.stats.pitching.inningsPitched !== '0.0' || 
       player.stats.pitching.hits > 0 || 
       player.stats.pitching.earnedRuns > 0 ||
       player.stats.pitching.baseOnBalls > 0 || 
       player.stats.pitching.strikeOuts > 0)
    
    return hasStats
  }

  /**
   * Parse innings pitched string to decimal number
   * Examples: "7.1" -> 7.1, "6.2" -> 6.2, "5.0" -> 5.0
   */
  private parseInningsPitched(ipString: string): number {
    if (!ipString || ipString === '0.0') {
      return 0
    }

    const parts = ipString.split('.')
    if (parts.length !== 2) {
      return parseFloat(ipString) || 0
    }

    const wholeInnings = parseInt(parts[0]) || 0
    const fractionalInnings = parseInt(parts[1]) || 0

    // Convert fractional innings to decimal
    // 1 out = 0.33, 2 outs = 0.67
    let decimalFraction = 0
    if (fractionalInnings === 1) {
      decimalFraction = 0.33
    } else if (fractionalInnings === 2) {
      decimalFraction = 0.67
    }

    return wholeInnings + decimalFraction
  }

  /**
   * Get Mariners starting pitcher stats from game data
   */
  getMarinersStartingPitcherStats(gameData: any): PitcherGameStats | null {
    console.log('Extracting pitcher stats from game data...')
    const allPitcherStats = this.extractPitcherStats(gameData)
    console.log(`Found ${allPitcherStats.length} pitcher stats:`, allPitcherStats.map(p => ({ 
      name: p.pitcherName, 
      id: p.pitcherId, 
      isStarting: p.isStartingPitcher,
      ip: p.ip 
    })))
    
    // Find Mariners starting pitcher
    const marinersStartingPitcher = allPitcherStats.find(pitcher => 
      pitcher.isStartingPitcher && this.isMarinersPitcher(pitcher, gameData)
    )

    console.log('Mariners starting pitcher found:', marinersStartingPitcher ? {
      name: marinersStartingPitcher.pitcherName,
      id: marinersStartingPitcher.pitcherId,
      stats: {
        ip: marinersStartingPitcher.ip,
        hits: marinersStartingPitcher.hits,
        earnedRuns: marinersStartingPitcher.earnedRuns,
        walks: marinersStartingPitcher.walks,
        strikeouts: marinersStartingPitcher.strikeouts
      }
    } : null)

    return marinersStartingPitcher || null
  }

  /**
   * Check if a pitcher belongs to the Mariners
   */
  private isMarinersPitcher(pitcher: PitcherGameStats, gameData: any): boolean {
    if (!gameData?.liveData?.boxscore?.teams) {
      return false
    }

    const { home, away } = gameData.liveData.boxscore.teams
    
    // Check if pitcher is in Mariners team
    const marinersTeam = this.getMarinersTeam(home, away)
    if (!marinersTeam?.players) {
      return false
    }

    return Object.values(marinersTeam.players).some((player: any) => 
      player?.person?.id === pitcher.pitcherId.toString()
    )
  }

  /**
   * Get the Mariners team from game data
   */
  private getMarinersTeam(home: any, away: any): any {
    const homeTeamId = home?.team?.id || home?.id
    const awayTeamId = away?.team?.id || away?.id

    if (homeTeamId === this.marinersTeamId) {
      return home
    } else if (awayTeamId === this.marinersTeamId) {
      return away
    }

    return null
  }

  /**
   * Check if the starting pitcher has been substituted out
   */
  hasStartingPitcherBeenSubstituted(gameData: any): boolean {
    const startingPitcherStats = this.getMarinersStartingPitcherStats(gameData)
    
    if (!startingPitcherStats) {
      return false
    }

    // Check if there are any pitching substitution events
    const plays = gameData?.liveData?.plays?.allPlays || []
    
    for (const play of plays) {
      if (play?.playEvents) {
        for (const event of play.playEvents) {
          if (event?.type === 'pitching_substitution' && 
              event?.player?.id === startingPitcherStats.pitcherId.toString()) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Get the current pitcher for Mariners
   */
  getCurrentMarinersPitcher(gameData: any): any {
    const marinersTeam = this.getMarinersTeam(
      gameData?.liveData?.boxscore?.teams?.home,
      gameData?.liveData?.boxscore?.teams?.away
    )

    if (!marinersTeam?.players) {
      return null
    }

    // Find the pitcher with the most recent activity
    // This is a simplified approach - in reality, you'd need to track the current pitcher
    // through play events
    let currentPitcher = null
    let maxInnings = 0

    Object.values(marinersTeam.players).forEach((player: any) => {
      if (player?.stats?.pitching) {
        const innings = this.parseInningsPitched(player.stats.pitching.inningsPitched)
        if (innings > maxInnings) {
          maxInnings = innings
          currentPitcher = player
        }
      }
    })

    return currentPitcher
  }
}

export const pitcherStatsService = new PitcherStatsService()
