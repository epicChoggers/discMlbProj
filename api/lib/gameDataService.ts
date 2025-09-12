// Server-side GameDataService for API functions
export class GameDataService {
  private apiBaseUrl: string
  private teamId: string

  constructor() {
    this.apiBaseUrl = process.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1'
    this.teamId = process.env.VITE_TEAM_ID || '136'
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl
  }

  getTeamId(): string {
    return this.teamId
  }

  // Helper method to get Pacific Time date string to avoid timezone issues
  private getPacificDateString(): string {
    const now = new Date()
    // Get Pacific Time components directly - this works correctly even on Vercel UTC
    const pacificYear = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", year: "numeric"})
    const pacificMonth = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", month: "2-digit"})
    const pacificDay = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", day: "2-digit"})
    
    const pacificDate = `${pacificYear}-${pacificMonth}-${pacificDay}`
    console.log(`[GameDataService] Pacific date: ${pacificDate} (UTC time: ${now.toISOString()})`)
    return pacificDate
  }

  // Helper method to get current Pacific Time for debugging
  private getCurrentPacificTime(): string {
    const now = new Date()
    return now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})
  }

  // Get today's Mariners game with probable pitcher
  async getTodaysMarinersGameWithPitcher(): Promise<any | null> {
    try {
      const today = this.getPacificDateString() // Use Pacific Time to avoid timezone issues
      const currentTime = this.getCurrentPacificTime()
      const url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${this.teamId}&hydrate=probablePitcher&date=${today}`
      
      console.log(`[GameDataService] Fetching Mariners game for date: ${today} (Pacific time: ${currentTime})`)
      console.log(`[GameDataService] API URL: ${url}`)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }
      const data = await response.json()
      
      console.log(`[GameDataService] API response:`, {
        totalDates: data.dates?.length || 0,
        totalGames: data.dates?.[0]?.games?.length || 0,
        gameDate: data.dates?.[0]?.date,
        games: data.dates?.[0]?.games?.map((g: any) => ({
          gamePk: g.gamePk,
          gameDate: g.gameDate,
          status: g.status?.abstractGameState,
          detailedState: g.status?.detailedState
        })) || []
      })
      
      if (data.dates && data.dates.length > 0 && data.dates[0].games && data.dates[0].games.length > 0) {
        const game = data.dates[0].games[0]
        console.log(`[GameDataService] Found game:`, {
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          status: game.status?.abstractGameState,
          detailedState: game.status?.detailedState,
          teams: {
            home: game.teams?.home?.team?.name,
            away: game.teams?.away?.team?.name
          }
        })
        return game
      }
      
      console.log(`[GameDataService] No games found for date ${today}`)
      
      // Try to find the most recent Mariners game if no game found for today
      console.log(`[GameDataService] Attempting to find most recent Mariners game...`)
      return await this.findMostRecentMarinersGame()
    } catch (error) {
      console.error("[GameDataService] Error fetching today's Mariners game with pitcher:", error)
      return null
    }
  }

  // Backward compatibility
  async getTodaysMarinersGame(): Promise<any | null> {
    return this.getTodaysMarinersGameWithPitcher()
  }

  // Check if game is live
  isGameLive(game: any): boolean {
    const abstractState = game.status?.abstractGameState
    const detailedState = game.status?.detailedState
    const codedState = game.status?.codedGameState
    
    // Log the game status for debugging
    console.log(`[GameDataService] Checking if game is live:`, {
      gamePk: game.gamePk,
      abstractState,
      detailedState,
      codedState,
      gameDate: game.gameDate
    })
    
    // Game is live if it's in progress or in warmup
    const isLive = abstractState === 'Live' || 
                   detailedState === 'In Progress' || 
                   detailedState === 'Warmup' ||
                   codedState === 'I' // In Progress
                   
    console.log(`[GameDataService] Game live status: ${isLive}`)
    return isLive
  }

  // Get current at-bat from game
  getCurrentAtBat(game: any): any {
    console.log(`[GameDataService] Getting current at-bat from game:`, {
      hasLiveData: !!game.liveData,
      hasPlays: !!game.liveData?.plays,
      hasCurrentPlay: !!game.liveData?.plays?.currentPlay,
      hasAllPlays: !!game.liveData?.plays?.allPlays,
      allPlaysCount: game.liveData?.plays?.allPlays?.length || 0
    })
    
    // Try to get current play
    let currentPlay = game.liveData?.plays?.currentPlay
    
    // If no current play, try to get the last play from allPlays
    if (!currentPlay && game.liveData?.plays?.allPlays?.length > 0) {
      const allPlays = game.liveData.plays.allPlays
      const lastPlay = allPlays[allPlays.length - 1]
      
      // Check if the last play is incomplete (current at-bat)
      if (lastPlay && lastPlay.about && !lastPlay.about.isComplete) {
        console.log(`[GameDataService] Using last incomplete play as current at-bat:`, {
          atBatIndex: lastPlay.about.atBatIndex,
          isComplete: lastPlay.about.isComplete,
          batter: lastPlay.matchup?.batter?.fullName
        })
        currentPlay = lastPlay
      }
    }
    
    if (currentPlay) {
      console.log(`[GameDataService] Found current at-bat:`, {
        atBatIndex: currentPlay.about?.atBatIndex,
        isComplete: currentPlay.about?.isComplete,
        batter: currentPlay.matchup?.batter?.fullName,
        pitcher: currentPlay.matchup?.pitcher?.fullName,
        count: currentPlay.count
      })
    } else {
      console.log(`[GameDataService] No current at-bat found`)
    }
    
    return currentPlay || null
  }

  // Get full game feed (includes gameData and liveData) by gamePk
  async getGameDetails(gamePk: number): Promise<any | null> {
    try {
      // Use v1.1 endpoint for live games as per memory
      const v11Url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
      console.log(`[GameDataService] Fetching detailed game data from: ${v11Url}`)
      
      const response = await fetch(v11Url)
      if (!response.ok) {
        console.error(`[GameDataService] HTTP error! status: ${response.status}, statusText: ${response.statusText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`[GameDataService] Successfully fetched detailed game data:`, {
        hasGameData: !!data.gameData,
        hasLiveData: !!data.liveData,
        hasPlays: !!data.liveData?.plays,
        hasCurrentPlay: !!data.liveData?.plays?.currentPlay,
        allPlaysCount: data.liveData?.plays?.allPlays?.length || 0
      })
      
      return data || null
    } catch (error) {
      console.error('[GameDataService] Error fetching game details:', error)
      return null
    }
  }

  // Find the most recent Mariners game (within the last 7 days)
  async findMostRecentMarinersGame(): Promise<any | null> {
    try {
      const today = new Date()
      const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000))
      
      const startDate = sevenDaysAgo.toISOString().split('T')[0]
      const endDate = today.toISOString().split('T')[0]
      
      const url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${this.teamId}&hydrate=probablePitcher&startDate=${startDate}&endDate=${endDate}&sortBy=gameDate&sortOrder=desc`
      
      console.log(`[GameDataService] Searching for recent Mariners games from ${startDate} to ${endDate}`)
      console.log(`[GameDataService] URL: ${url}`)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }
      
      const data = await response.json()
      
      // Find the most recent game
      for (const date of data.dates || []) {
        if (date.games && date.games.length > 0) {
          for (const game of date.games) {
            if (game.teams?.home?.team?.id === parseInt(this.teamId) || 
                game.teams?.away?.team?.id === parseInt(this.teamId)) {
              console.log(`[GameDataService] Found recent Mariners game:`, {
                gamePk: game.gamePk,
                gameDate: game.gameDate,
                status: game.status?.abstractGameState,
                detailedState: game.status?.detailedState,
                teams: {
                  home: game.teams?.home?.team?.name,
                  away: game.teams?.away?.team?.name
                }
              })
              return game
            }
          }
        }
      }
      
      console.log(`[GameDataService] No recent Mariners games found`)
      return null
    } catch (error) {
      console.error("[GameDataService] Error finding recent Mariners game:", error)
      return null
    }
  }

  async getGameWithProbablePitcher(gamePk: number): Promise<any | null> {
    try {
      // get date from game feed
      const feed = await this.getGameDetails(gamePk)
      const date = feed?.gameData?.datetime?.originalDate?.split('T')[0]
      const scheduleUrl = `${this.apiBaseUrl}/schedule?sportId=1&hydrate=probablePitcher&startDate=${date}&endDate=${date}`
      const response = await fetch(scheduleUrl)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const schedule = await response.json()
      for (const d of schedule.dates || []) {
        const g = (d.games || []).find((g: any) => g.gamePk === gamePk)
        if (g) return g
      }
      return null
    } catch (error) {
      console.error('Error fetching game with probable pitcher:', error)
      return null
    }
  }
}

export const gameDataService = new GameDataService()


