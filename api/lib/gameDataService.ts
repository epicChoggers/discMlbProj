import { mlbCacheService } from './MLBCacheService'

// Server-side GameDataService for API functions with caching
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
  // Vercel runs in UTC, so we need to explicitly convert to Pacific Time
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

  // Get today's Mariners game with probable pitcher (with caching)
  async getTodaysMarinersGameWithPitcher(): Promise<any | null> {
    try {
      // Use Pacific Time to avoid timezone issues
      const today = this.getPacificDateString()
      
      // Check cache first
      const cachedData = await mlbCacheService.getCachedScheduleData(this.teamId, today)
      if (cachedData) {
        console.log('[GameDataService] Using cached schedule data for today')
        if (cachedData.dates && cachedData.dates.length > 0 && cachedData.dates[0].games) {
          const games = cachedData.dates[0].games
          if (games.length > 0) {
            return games[0]
          }
        }
        return null
      }

      // If not cached, fetch from MLB API
      const url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${this.teamId}&hydrate=probablePitcher&date=${today}`
      console.log('[GameDataService] Fetching fresh schedule data from MLB API:', url)
      const response = await fetch(url)
      
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error('[GameDataService] Non-OK response', { status: response.status, text })
        throw new Error(`HTTP error ${response.status}`)
      }
      
      const data = await response.json().catch((err) => {
        console.error('[GameDataService] JSON parse failed:', err)
        throw new Error('Failed to parse MLB API response')
      })
      
      // Cache the response
      await mlbCacheService.cacheScheduleData(this.teamId, today, data)
      
      if (data.dates && data.dates.length > 0 && data.dates[0].games) {
        const games = data.dates[0].games
        // Return the first Mariners game found (there should only be one per day)
        if (games.length > 0) {
          return games[0]
        }
      }
      
      return null
    } catch (error) {
      console.error("[GameDataService] Error fetching today's Mariners game with pitcher:", error)
      return null
    }
  }

  // Get today's Mariners game (legacy method for backward compatibility)
  async getTodaysMarinersGame(): Promise<any | null> {
    return this.getTodaysMarinersGameWithPitcher()
  }

  // Check if game is live (consistent with frontend)
  isGameLive(game: any): boolean {
    const isLive = game.status?.abstractGameState === 'Live'
    console.log(`[GameDataService] isGameLive check:`, {
      status: game.status,
      detailedState: game.status?.detailedState,
      abstractGameState: game.status?.abstractGameState,
      result: isLive
    })
    return isLive
  }

  // Get current at-bat from game using at-bat index approach
  getCurrentAtBat(game: any): any {
    console.log(`[GameDataService] Getting current at-bat using at-bat index approach`)
    console.log(`[GameDataService] Game has liveData:`, !!game.liveData)
    console.log(`[GameDataService] Game has plays:`, !!game.liveData?.plays)
    
    if (!game.liveData?.plays?.allPlays || game.liveData.plays.allPlays.length === 0) {
      console.log(`[GameDataService] No plays available`)
      return null
    }
    
    const allPlays = game.liveData.plays.allPlays
    console.log(`[GameDataService] Total plays available: ${allPlays.length}`)
    
    // Find all plays with valid at-bat indexes
    const playsWithIndexes = allPlays.filter((play: any) => 
      play.about?.atBatIndex !== undefined
    )
    
    if (playsWithIndexes.length === 0) {
      console.log(`[GameDataService] No plays with at-bat indexes found`)
      return null
    }
    
    // Sort by at-bat index to ensure chronological order
    playsWithIndexes.sort((a: any, b: any) => a.about.atBatIndex - b.about.atBatIndex)
    
    // Find the highest at-bat index
    const highestAtBatIndex = playsWithIndexes[playsWithIndexes.length - 1].about.atBatIndex
    console.log(`[GameDataService] Highest at-bat index found: ${highestAtBatIndex}`)
    
    // Check if the highest indexed play is complete
    const highestPlay = playsWithIndexes[playsWithIndexes.length - 1]
    const isHighestComplete = highestPlay.about?.isComplete === true && 
                             highestPlay.result && 
                             highestPlay.result.event
    
    console.log(`[GameDataService] Highest play (index ${highestAtBatIndex}) is complete: ${isHighestComplete}`)
    
    if (isHighestComplete) {
      // The highest indexed play is complete, so the current at-bat is the next one
      if (game.status?.abstractGameState === 'Live') {
        const currentAtBatIndex = highestAtBatIndex + 1
        console.log(`[GameDataService] Game is live, current at-bat index: ${currentAtBatIndex}`)
        
        // Create a simulated current at-bat based on the most recent completed at-bat
        const simulatedAtBat = {
          ...highestPlay,
          about: {
            ...highestPlay.about,
            atBatIndex: currentAtBatIndex,
            isComplete: false // Explicitly mark as not complete
          },
          result: {
            type: 'at_bat',
            event: 'at_bat', 
            description: 'At-bat in progress',
            rbi: 0,
            awayScore: highestPlay.result.awayScore,
            homeScore: highestPlay.result.homeScore
          }
        }
        
        console.log(`[GameDataService] Created simulated current at-bat ${currentAtBatIndex}`)
        return simulatedAtBat
      } else {
        console.log(`[GameDataService] Game is not live, no current at-bat`)
        return null
      }
    } else {
      // The highest indexed play is not complete, so it's the current at-bat
      console.log(`[GameDataService] Using highest play (index ${highestAtBatIndex}) as current at-bat`)
      return highestPlay
    }
  }

  // Get all plays from a game
  getGamePlays(game: any): any[] {
    if (!game?.liveData?.plays?.allPlays) {
      console.log(`[GameDataService] No plays found in game data`)
      return []
    }
    
    const plays = game.liveData.plays.allPlays
    console.log(`[GameDataService] Found ${plays.length} plays in game data`)
    return plays
  }

  // Get game details by gamePk
  async getGameDetails(gamePk: number): Promise<any | null> {
    try {
      console.log(`[GameDataService] Fetching detailed game data for game ${gamePk}`)
      const response = await fetch(`${this.apiBaseUrl.replace('/v1', '/v1.1')}/game/${gamePk}/feed/live`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      
      // Structure the data properly - combine gameData and liveData from MLB API response
      const structuredData = {
        ...data.gameData,
        gamePk: gamePk,
        liveData: data.liveData
      }
      
      console.log(`[GameDataService] Successfully fetched detailed game data for game ${gamePk}`)
      console.log(`[GameDataService] Live data available:`, !!data.liveData)
      console.log(`[GameDataService] Current play available:`, !!data.liveData?.plays?.currentPlay)
      console.log(`[GameDataService] All plays count:`, data.liveData?.plays?.allPlays?.length || 0)
      
      return structuredData
    } catch (error) {
      console.error('Error fetching game details:', error)
      return null
    }
  }

  // Get game with probable pitcher info using schedule endpoint (with caching)
  async getGameWithProbablePitcher(gamePk: number): Promise<any | null> {
    try {
      // First get the game date from the game feed (this is usually small and fast)
      const gameResponse = await fetch(`${this.apiBaseUrl.replace('/v1', '/v1.1')}/game/${gamePk}/feed/live`)
      if (!gameResponse.ok) {
        throw new Error(`HTTP error! status: ${gameResponse.status}`)
      }
      const gameData = await gameResponse.json()
      
      if (!gameData.gameData?.datetime?.originalDate) {
        throw new Error('Game date not found')
      }

      // Extract the date from the game and convert to Pacific Time
      const gameDateTime = new Date(gameData.gameData.datetime.originalDate)
      const pacificYear = gameDateTime.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", year: "numeric"})
      const pacificMonth = gameDateTime.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", month: "2-digit"})
      const pacificDay = gameDateTime.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", day: "2-digit"})
      const gameDate = `${pacificYear}-${pacificMonth}-${pacificDay}`
      
      console.log(`[GameDataService] Game original date: ${gameData.gameData.datetime.originalDate}`)
      console.log(`[GameDataService] Game Pacific date: ${gameDate}`)
      
      // Check cache first for schedule data
      const cachedScheduleData = await mlbCacheService.getCachedScheduleData('all', gameDate)
      let scheduleData
      
      if (cachedScheduleData) {
        console.log('[GameDataService] Using cached schedule data for game date')
        scheduleData = cachedScheduleData
      } else {
        // If not cached, fetch from MLB API
        const scheduleUrl = `${this.apiBaseUrl}/schedule?sportId=1&hydrate=probablePitcher&startDate=${gameDate}&endDate=${gameDate}`
        console.log('[GameDataService] Fetching fresh schedule data from MLB API:', scheduleUrl)
        
        const scheduleResponse = await fetch(scheduleUrl)
        if (!scheduleResponse.ok) {
          throw new Error(`HTTP error! status: ${scheduleResponse.status}`)
        }
        
        scheduleData = await scheduleResponse.json()
        
        // Cache the response
        await mlbCacheService.cacheScheduleData('all', gameDate, scheduleData)
      }
      
      // Find the specific game in the schedule
      if (scheduleData.dates && scheduleData.dates.length > 0) {
        for (const date of scheduleData.dates) {
          if (date.games) {
            console.log(`[GameDataService] Checking ${date.games.length} games on ${date.date}`)
            const game = date.games.find((g: any) => g.gamePk === gamePk)
            if (game) {
              console.log(`[GameDataService] Found game ${gamePk} in schedule`)
              console.log(`[GameDataService] Game status: ${game.status?.abstractGameState}`)
              console.log(`[GameDataService] Has probable pitcher: ${!!game.teams?.home?.probablePitcher || !!game.teams?.away?.probablePitcher}`)
              return game
            }
          }
        }
      }
      
      console.log(`[GameDataService] Game ${gamePk} not found in schedule for date ${gameDate}`)
      return null
    } catch (error) {
      console.error('Error fetching game with probable pitcher:', error)
      return null
    }
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

export const gameDataService = new GameDataService()
