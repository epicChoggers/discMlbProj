export class PitcherSubstitutionService {
  // Check if starting pitcher predictions should be resolved
  shouldResolveStartingPitcherPredictions(gameData: any): boolean {
    try {
      // Check if game is final
      const gameStatus = gameData?.status?.abstractGameState || gameData?.gameData?.status?.abstractGameState
      if (gameStatus === 'Final') {
        console.log('Game is final - resolving pitcher predictions')
        return true
      }

      // Check if game is in progress but starting pitcher has been substituted
      if (gameStatus === 'Live' || gameStatus === 'In Progress') {
        const hasPitcherSubstitution = this.hasStartingPitcherBeenSubstituted(gameData)
        if (hasPitcherSubstitution) {
          console.log('Starting pitcher has been substituted - resolving pitcher predictions')
          return true
        }
      }

      console.log('Starting pitcher still pitching or game not final - not resolving pitcher predictions')
      return false
    } catch (error) {
      console.error('Error checking pitcher substitution status:', error)
      return false
    }
  }

  // Check if the starting pitcher has been substituted
  private hasStartingPitcherBeenSubstituted(gameData: any): boolean {
    try {
      if (!gameData?.liveData?.boxscore?.teams?.away || !gameData?.liveData?.boxscore?.teams?.home) {
        return false
      }

      const { away, home } = gameData.liveData.boxscore.teams
      
      // Check if Mariners are home or away
      const marinersTeam = home.team.id === 136 ? home : away
      
      if (!marinersTeam) {
        return false
      }

      // Get starting pitcher
      const startingPitcher = marinersTeam.pitchers?.find((p: any) => p.note?.includes('Starting Pitcher'))
      
      if (!startingPitcher) {
        return false
      }

      // Check if there are any other pitchers who have pitched
      const otherPitchers = marinersTeam.pitchers?.filter((p: any) => 
        p.person.id !== startingPitcher.person.id && 
        p.stats && 
        (p.stats.inningsPitched !== '0.0' || p.stats.hits > 0 || p.stats.strikeOuts > 0)
      )

      return otherPitchers && otherPitchers.length > 0
    } catch (error) {
      console.error('Error checking pitcher substitution:', error)
      return false
    }
  }
}

// Export singleton instance
export const pitcherSubstitutionService = new PitcherSubstitutionService()
