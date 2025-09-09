export interface PitcherSubstitution {
  pitcherId: number
  pitcherName: string
  substitutionType: 'removed' | 'added'
  inning: number
  timestamp: string
  reason?: string
}

export interface StartingPitcherStatus {
  pitcherId: number
  pitcherName: string
  isStillPitching: boolean
  substitutionEvent?: PitcherSubstitution
  finalStats?: {
    ip: number
    hits: number
    earnedRuns: number
    walks: number
    strikeouts: number
  }
}

export class PitcherSubstitutionService {
  private marinersTeamId: number

  constructor() {
    this.marinersTeamId = parseInt(process.env.VITE_TEAM_ID || '136')
  }

  /**
   * Analyze game plays to detect pitcher substitutions
   */
  analyzePitcherSubstitutions(gameData: any): PitcherSubstitution[] {
    const substitutions: PitcherSubstitution[] = []
    
    if (!gameData?.liveData?.plays?.allPlays) {
      return substitutions
    }

    const plays = gameData.liveData.plays.allPlays

    for (const play of plays) {
      if (play?.playEvents) {
        for (const event of play.playEvents) {
          if (this.isPitcherSubstitutionEvent(event)) {
            const substitution = this.parsePitcherSubstitution(event, play)
            if (substitution && this.isMarinersPitcher(substitution.pitcherId, gameData)) {
              substitutions.push(substitution)
            }
          }
        }
      }
    }

    return substitutions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  /**
   * Check if an event is a pitcher substitution
   */
  private isPitcherSubstitutionEvent(event: any): boolean {
    return event?.type === 'pitching_substitution' || 
           event?.details?.event === 'Pitching Substitution' ||
           event?.details?.event === 'Pitching Change'
  }

  /**
   * Parse pitcher substitution from event data
   */
  private parsePitcherSubstitution(event: any, play: any): PitcherSubstitution | null {
    try {
      const pitcherId = parseInt(event.player?.id || event.person?.id)
      const pitcherName = event.player?.fullName || event.person?.fullName || 'Unknown Pitcher'
      
      if (!pitcherId) {
        return null
      }

      return {
        pitcherId,
        pitcherName,
        substitutionType: 'removed', // We'll determine this based on context
        inning: play?.about?.inning || 0,
        timestamp: play?.about?.startTime || new Date().toISOString(),
        reason: event.details?.description || 'Pitching Change'
      }
    } catch (error) {
      console.error('Error parsing pitcher substitution:', error)
      return null
    }
  }

  /**
   * Check if a pitcher belongs to the Mariners
   */
  private isMarinersPitcher(pitcherId: number, gameData: any): boolean {
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
      player?.person?.id === pitcherId.toString()
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
   * Get the starting pitcher for Mariners
   */
  getMarinersStartingPitcher(gameData: any): { pitcherId: number; pitcherName: string } | null {
    const marinersTeam = this.getMarinersTeam(
      gameData?.liveData?.boxscore?.teams?.home,
      gameData?.liveData?.boxscore?.teams?.away
    )

    if (!marinersTeam?.players) {
      return null
    }

    // Find the pitcher with the most innings pitched (likely the starter)
    let startingPitcher = null
    let maxInnings = 0

    Object.values(marinersTeam.players).forEach((player: any) => {
      if (player?.stats?.pitching) {
        const innings = this.parseInningsPitched(player.stats.pitching.inningsPitched)
        if (innings > maxInnings) {
          maxInnings = innings
          startingPitcher = {
            pitcherId: parseInt(player.person.id),
            pitcherName: player.person.fullName
          }
        }
      }
    })

    return startingPitcher
  }

  /**
   * Parse innings pitched string to decimal number
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
    let decimalFraction = 0
    if (fractionalInnings === 1) {
      decimalFraction = 0.33
    } else if (fractionalInnings === 2) {
      decimalFraction = 0.67
    }

    return wholeInnings + decimalFraction
  }

  /**
   * Determine if the starting pitcher has been removed from the game
   */
  hasStartingPitcherBeenRemoved(gameData: any): StartingPitcherStatus | null {
    const startingPitcher = this.getMarinersStartingPitcher(gameData)
    
    if (!startingPitcher) {
      return null
    }

    const substitutions = this.analyzePitcherSubstitutions(gameData)
    
    // Find substitution events for the starting pitcher
    const startingPitcherSubstitutions = substitutions.filter(sub => 
      sub.pitcherId === startingPitcher.pitcherId
    )

    // Get current pitcher stats
    const currentStats = this.getCurrentPitcherStats(startingPitcher.pitcherId, gameData)

    const status: StartingPitcherStatus = {
      pitcherId: startingPitcher.pitcherId,
      pitcherName: startingPitcher.pitcherName,
      isStillPitching: startingPitcherSubstitutions.length === 0,
      substitutionEvent: startingPitcherSubstitutions.length > 0 ? startingPitcherSubstitutions[0] : undefined,
      finalStats: currentStats
    }

    return status
  }

  /**
   * Get current stats for a specific pitcher
   */
  private getCurrentPitcherStats(pitcherId: number, gameData: any): any {
    const marinersTeam = this.getMarinersTeam(
      gameData?.liveData?.boxscore?.teams?.home,
      gameData?.liveData?.boxscore?.teams?.away
    )

    if (!marinersTeam?.players) {
      return null
    }

    const player = Object.values(marinersTeam.players).find((p: any) => 
      p?.person?.id === pitcherId.toString()
    ) as any

    if (!player?.stats?.pitching) {
      return null
    }

    const stats = player.stats.pitching
    
    return {
      ip: this.parseInningsPitched(stats.inningsPitched),
      hits: stats.hits || 0,
      earnedRuns: stats.earnedRuns || 0,
      walks: stats.baseOnBalls || 0,
      strikeouts: stats.strikeOuts || 0
    }
  }

  /**
   * Check if the game is final and starting pitcher should be considered finished
   */
  isGameFinal(gameData: any): boolean {
    // Check both possible locations for game status
    const gameStatus = gameData?.status?.abstractGameState || gameData?.gameData?.status?.abstractGameState
    console.log('Game status found:', gameStatus)
    return gameStatus === 'Final' || gameStatus === 'Game Over'
  }

  /**
   * Determine if starting pitcher predictions should be resolved
   */
  shouldResolveStartingPitcherPredictions(gameData: any): boolean {
    // Resolve if:
    // 1. Game is final, OR
    // 2. Starting pitcher has been removed from the game
    
    const isFinal = this.isGameFinal(gameData)
    console.log('Game is final:', isFinal)
    
    if (isFinal) {
      console.log('Game is final, should resolve pitcher predictions')
      return true
    }

    const pitcherStatus = this.hasStartingPitcherBeenRemoved(gameData)
    console.log('Pitcher status:', pitcherStatus)
    const shouldResolve = pitcherStatus ? !pitcherStatus.isStillPitching : false
    console.log('Should resolve based on pitcher status:', shouldResolve)
    
    return shouldResolve
  }
}

export const pitcherSubstitutionService = new PitcherSubstitutionService()
