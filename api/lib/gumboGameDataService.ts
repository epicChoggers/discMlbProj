// New GUMBO-based GameDataService for comprehensive at-bat data retrieval
export class GumboGameDataService {
  private apiBaseUrl: string
  private teamId: string

  constructor() {
    this.apiBaseUrl = process.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1.1'
    this.teamId = process.env.VITE_TEAM_ID || '136'
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl
  }

  getTeamId(): string {
    return this.teamId
  }

  // Get today's Mariners game with comprehensive hydration
  async getTodaysMarinersGameWithHydration(): Promise<any | null> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      const url = `${this.apiBaseUrl.replace('/v1.1', '/v1')}/schedule?sportId=1&teamId=${this.teamId}&hydrate=probablePitcher,team&date=${today}`
      console.log('[GumboGameDataService] Requesting schedule URL with hydration:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error('[GumboGameDataService] Non-OK response', { status: response.status, text })
        throw new Error(`HTTP error ${response.status}`)
      }
      
      const data = await response.json().catch((err) => {
        console.error('[GumboGameDataService] JSON parse failed:', err)
        throw new Error('Failed to parse MLB API response')
      })
      
      if (data.dates && data.dates.length > 0 && data.dates[0].games) {
        const games = data.dates[0].games
        if (games.length > 0) {
          return games[0]
        }
      }
      
      return null
    } catch (error) {
      console.error("[GumboGameDataService] Error fetching today's Mariners game with hydration:", error)
      return null
    }
  }

  // Get comprehensive game data using GUMBO v1.1 with hydrations
  async getGameDataWithHydration(gamePk: number): Promise<any | null> {
    try {
      console.log(`[GumboGameDataService] Fetching comprehensive game data for game ${gamePk}`)
      
      // Use GUMBO v1.1 with comprehensive hydrations
      const hydrations = [
        'credits',           // Track pitcher/batter substitutions
        'alignment',         // Defense and offense alignment
        'flags',            // Additional descriptive identifiers
        'officials',        // Umpire alignment
        'preState'          // Pre-play state
      ].join(',')
      
      const url = `${this.apiBaseUrl}/game/${gamePk}/feed/live?hydrate=${hydrations}`
      console.log('[GumboGameDataService] Requesting GUMBO URL:', url)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Structure the data properly - combine gameData and liveData from MLB API response
      const structuredData = {
        ...data.gameData,
        gamePk: gamePk,
        liveData: data.liveData,
        metaData: data.metaData
      }
      
      console.log(`[GumboGameDataService] Successfully fetched comprehensive game data for game ${gamePk}`)
      console.log(`[GumboGameDataService] Live data available:`, !!data.liveData)
      console.log(`[GumboGameDataService] Current play available:`, !!data.liveData?.plays?.currentPlay)
      console.log(`[GumboGameDataService] All plays count:`, data.liveData?.plays?.allPlays?.length || 0)
      console.log(`[GumboGameDataService] Credits available:`, !!data.liveData?.credits)
      console.log(`[GumboGameDataService] Alignment available:`, !!data.liveData?.alignment)
      
      return structuredData
    } catch (error) {
      console.error('Error fetching comprehensive game data:', error)
      return null
    }
  }

  // Get current at-bat with comprehensive data
  getCurrentAtBatWithDetails(game: any): any {
    console.log(`[GumboGameDataService] Getting current at-bat with details from game data`)
    
    if (!game.liveData?.plays) {
      console.log(`[GumboGameDataService] No plays data available`)
      return null
    }

    const { currentPlay, allPlays } = game.liveData.plays
    
    // Get current at-bat
    let currentAtBat = currentPlay
    
    // If no currentPlay, find the most recent incomplete at-bat
    if (!currentAtBat && allPlays && allPlays.length > 0) {
      const lastPlay = allPlays[allPlays.length - 1]
      if (lastPlay && !lastPlay.about?.isComplete && !lastPlay.result?.event) {
        currentAtBat = lastPlay
        console.log(`[GumboGameDataService] Using last play as current at-bat (still in progress)`)
      }
    }

    if (!currentAtBat) {
      console.log(`[GumboGameDataService] No current at-bat found`)
      return null
    }

    // Enhance with additional data
    const enhancedAtBat = this.enhanceAtBatWithDetails(currentAtBat, game)
    
    console.log(`[GumboGameDataService] Current at-bat atBatIndex:`, enhancedAtBat.about?.atBatIndex)
    console.log(`[GumboGameDataService] Current pitcher:`, enhancedAtBat.matchup?.pitcher?.fullName)
    console.log(`[GumboGameDataService] Current batter:`, enhancedAtBat.matchup?.batter?.fullName)
    
    return enhancedAtBat
  }

  // Get previous at-bat using atBatIndex
  getPreviousAtBat(game: any, currentAtBatIndex: number): any {
    console.log(`[GumboGameDataService] Getting previous at-bat for atBatIndex: ${currentAtBatIndex}`)
    
    if (!game.liveData?.plays?.allPlays) {
      console.log(`[GumboGameDataService] No allPlays data available`)
      return null
    }

    const allPlays = game.liveData.plays.allPlays
    
    // Find the previous completed at-bat
    const previousAtBat = allPlays.find((play: any) => 
      play.about?.atBatIndex === currentAtBatIndex - 1 && 
      play.about?.isComplete && 
      play.result?.event
    )

    if (!previousAtBat) {
      console.log(`[GumboGameDataService] No previous at-bat found for atBatIndex: ${currentAtBatIndex}`)
      return null
    }

    // Enhance with additional data
    const enhancedPreviousAtBat = this.enhanceAtBatWithDetails(previousAtBat, game)
    
    console.log(`[GumboGameDataService] Previous at-bat atBatIndex:`, enhancedPreviousAtBat.about?.atBatIndex)
    console.log(`[GumboGameDataService] Previous pitcher:`, enhancedPreviousAtBat.matchup?.pitcher?.fullName)
    console.log(`[GumboGameDataService] Previous batter:`, enhancedPreviousAtBat.matchup?.batter?.fullName)
    
    return enhancedPreviousAtBat
  }

  // Get at-bat by specific atBatIndex
  getAtBatByIndex(game: any, atBatIndex: number): any {
    console.log(`[GumboGameDataService] Getting at-bat by index: ${atBatIndex}`)
    
    if (!game.liveData?.plays?.allPlays) {
      console.log(`[GumboGameDataService] No allPlays data available`)
      return null
    }

    const allPlays = game.liveData.plays.allPlays
    
    const atBat = allPlays.find((play: any) => 
      play.about?.atBatIndex === atBatIndex
    )

    if (!atBat) {
      console.log(`[GumboGameDataService] No at-bat found for index: ${atBatIndex}`)
      return null
    }

    return this.enhanceAtBatWithDetails(atBat, game)
  }

  // Enhance at-bat with additional details from game data
  private enhanceAtBatWithDetails(atBat: any, game: any): any {
    const enhanced = { ...atBat }
    
    // Add pitcher details if available
    if (atBat.matchup?.pitcher?.id && game.liveData?.boxscore?.teams) {
      const pitcherId = atBat.matchup.pitcher.id
      const pitcherDetails = this.findPlayerDetails(game.liveData.boxscore.teams, pitcherId)
      if (pitcherDetails) {
        enhanced.pitcherDetails = pitcherDetails
      }
    }
    
    // Add batter details if available
    if (atBat.matchup?.batter?.id && game.liveData?.boxscore?.teams) {
      const batterId = atBat.matchup.batter.id
      const batterDetails = this.findPlayerDetails(game.liveData.boxscore.teams, batterId)
      if (batterDetails) {
        enhanced.batterDetails = batterDetails
      }
    }
    
    // Add credits information if available
    if (game.liveData?.credits) {
      enhanced.credits = game.liveData.credits
    }
    
    // Add alignment information if available
    if (game.liveData?.alignment) {
      enhanced.alignment = game.liveData.alignment
    }
    
    return enhanced
  }

  // Find player details in boxscore teams
  private findPlayerDetails(teams: any, playerId: number): any {
    for (const teamKey of Object.keys(teams)) {
      const team = teams[teamKey]
      if (team.players) {
        for (const playerKey of Object.keys(team.players)) {
          const player = team.players[playerKey]
          if (player.person?.id === playerId) {
            return player
          }
        }
      }
    }
    return null
  }

  // Get comprehensive game state for at-bat prediction game
  async getComprehensiveGameState(gamePk?: number): Promise<any> {
    try {
      let game: any = null
      
      if (gamePk) {
        // Get specific game
        game = await this.getGameDataWithHydration(gamePk)
      } else {
        // Get today's Mariners game
        const scheduleGame = await this.getTodaysMarinersGameWithHydration()
        if (scheduleGame?.gamePk) {
          game = await this.getGameDataWithHydration(scheduleGame.gamePk)
        }
      }

      if (!game) {
        return {
          success: false,
          error: 'No game data available',
          game: null,
          currentAtBat: null,
          previousAtBat: null,
          lastUpdated: new Date().toISOString()
        }
      }

      // Get current at-bat with details
      const currentAtBat = this.getCurrentAtBatWithDetails(game)
      
      // Get previous at-bat if current at-bat exists
      let previousAtBat = null
      if (currentAtBat?.about?.atBatIndex) {
        previousAtBat = this.getPreviousAtBat(game, currentAtBat.about.atBatIndex)
      }

      return {
        success: true,
        game,
        currentAtBat,
        previousAtBat,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting comprehensive game state:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get game state',
        game: null,
        currentAtBat: null,
        previousAtBat: null,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Check if game is live (consistent with frontend)
  isGameLive(game: any): boolean {
    const isLive = game.status?.abstractGameState === 'Live'
    console.log(`[GumboGameDataService] isGameLive check:`, {
      status: game.status,
      detailedState: game.status?.detailedState,
      abstractGameState: game.status?.abstractGameState,
      result: isLive
    })
    return isLive
  }

  // Get cache statistics (placeholder)
  getCacheStats(): any {
    return {
      hits: 0,
      misses: 0,
      size: 0
    }
  }
}

export const gumboGameDataService = new GumboGameDataService()
