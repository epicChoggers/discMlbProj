export interface PitcherStats {
  pitcherId: number
  ip: number
  hits: number
  earnedRuns: number
  walks: number
  strikeouts: number
}

export class PitcherStatsService {
  // Get Mariners starting pitcher stats from game data
  getMarinersStartingPitcherStats(gameData: any): PitcherStats | null {
    try {
      if (!gameData?.liveData?.boxscore?.teams?.away || !gameData?.liveData?.boxscore?.teams?.home) {
        console.log('No boxscore data available')
        return null
      }

      const { away, home } = gameData.liveData.boxscore.teams
      
      // Check if Mariners are home or away
      const marinersTeam = home.team.id === 136 ? home : away
      
      if (!marinersTeam) {
        console.log('Mariners team not found in boxscore')
        return null
      }

      // Get starting pitcher from the pitchers array
      const startingPitcher = marinersTeam.pitchers?.find((p: any) => p.note?.includes('Starting Pitcher'))
      
      if (!startingPitcher) {
        console.log('No starting pitcher found for Mariners')
        return null
      }

      // Get pitcher stats
      const stats = startingPitcher.stats
      if (!stats) {
        console.log('No stats found for starting pitcher')
        return null
      }

      return {
        pitcherId: startingPitcher.person.id,
        ip: this.parseInningsPitched(stats.inningsPitched || '0.0'),
        hits: stats.hits || 0,
        earnedRuns: stats.earnedRuns || 0,
        walks: stats.baseOnBalls || 0,
        strikeouts: stats.strikeOuts || 0
      }
    } catch (error) {
      console.error('Error getting Mariners starting pitcher stats:', error)
      return null
    }
  }

  // Parse innings pitched string (e.g., "6.1" -> 6.333)
  private parseInningsPitched(ipString: string): number {
    try {
      if (!ipString || ipString === '0.0') return 0
      
      const parts = ipString.split('.')
      const fullInnings = parseInt(parts[0]) || 0
      const fractionalInnings = parts[1] ? parseInt(parts[1]) / 3 : 0
      
      return fullInnings + fractionalInnings
    } catch (error) {
      console.error('Error parsing innings pitched:', error)
      return 0
    }
  }
}

// Export singleton instance
export const pitcherStatsService = new PitcherStatsService()
