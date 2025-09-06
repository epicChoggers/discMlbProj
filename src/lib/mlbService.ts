import { MLBGame, MLBPlay, GameState } from './types'

const MARINERS_TEAM_ID = 147 // Seattle Mariners team ID in MLB API

class MLBService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1'
  private apiBaseUrl = import.meta.env.VITE_MLB_API_BASE_URL || '/api/mlb'
  private corsProxyUrl = import.meta.env.VITE_MLB_CORS_PROXY_URL || 'https://api.allorigins.win/raw?url='
  private updateInterval: NodeJS.Timeout | null = null
  private listeners: ((gameState: GameState) => void)[] = []
  private useMockData = import.meta.env.VITE_MLB_USE_MOCK_DATA === 'true'
  private debugMode = import.meta.env.VITE_DEBUG_MLB_SERVICE === 'true'

  // Helper method to make API requests with fallback
  private async makeApiRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    if (this.useMockData) {
      if (this.debugMode) console.log('Using mock data mode')
      return null
    }

    const queryString = new URLSearchParams(params).toString()
    const url = `${this.apiBaseUrl}/${endpoint}${queryString ? `?${queryString}` : ''}`
    
    try {
      if (this.debugMode) console.log('Making API request to:', url)
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      if (this.debugMode) console.log('API request successful:', data)
      return data
    } catch (error) {
      if (this.debugMode) console.warn('Primary API failed, trying CORS proxy:', error)
      
      // Fallback to CORS proxy
      const mlbUrl = `${this.baseUrl}/${endpoint}${queryString ? `?${queryString}` : ''}`
      const proxyUrl = this.corsProxyUrl + encodeURIComponent(mlbUrl)
      
      try {
        const proxyResponse = await fetch(proxyUrl)
        if (!proxyResponse.ok) {
          throw new Error(`CORS proxy also failed: ${proxyResponse.status}`)
        }
        
        const data = await proxyResponse.json()
        if (this.debugMode) console.log('CORS proxy request successful:', data)
        return data
      } catch (proxyError) {
        if (this.debugMode) console.error('Both API and CORS proxy failed:', proxyError)
        throw proxyError
      }
    }
  }

  // Get current games
  async getCurrentGames(): Promise<any[]> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await this.makeApiRequest('schedule', {
        startDate: today,
        endDate: today,
        hydrate: 'game(content(editorial(recap))),decisions,person,stats,team,linescore(matchup)'
      })
      
      if (!data || !data.dates || data.dates.length === 0) {
        console.log('No games found for today, returning mock data')
        return this.getMockGames()
      }
      
      return data.dates.flatMap((date: any) => date.games || [])
    } catch (error) {
      console.error('Error fetching current games:', error)
      console.log('Falling back to mock data')
      return this.getMockGames()
    }
  }

  // Mock data fallback
  private getMockGames(): any[] {
    return [
      {
        gamePk: 776460,
        gameDate: '2025-01-05T23:15:00Z',
        status: {
          abstractGameState: 'Final',
          detailedState: 'Final',
          codedGameState: 'F'
        },
        teams: {
          away: {
            team: {
              id: 147,
              name: 'Seattle Mariners',
              abbreviation: 'SEA'
            },
            score: 4
          },
          home: {
            team: {
              id: 144,
              name: 'Atlanta Braves',
              abbreviation: 'ATL'
            },
            score: 6
          }
        },
        venue: {
          name: 'Truist Park'
        }
      }
    ]
  }

  // Get today's Mariners game or most recent game
  async getTodaysMarinersGame(): Promise<MLBGame | null> {
    try {
      console.log('Fetching current games...')
      const currentGames = await this.getCurrentGames()
      console.log('Total games found:', currentGames.length)
      
      // Find Mariners games
      const marinersGames = currentGames.filter((game: any) => 
        game.teams.away.team.id === MARINERS_TEAM_ID || 
        game.teams.home.team.id === MARINERS_TEAM_ID
      )

      console.log('Mariners games found:', marinersGames.length)
      marinersGames.forEach((game: any, index: number) => {
        console.log(`Game ${index + 1}:`, {
          gamePk: game.gamePk,
          date: game.gameDate,
          status: game.status.abstractGameState,
          home: game.teams.home.team.name,
          away: game.teams.away.team.name
        })
      })

      if (marinersGames.length === 0) {
        console.log('No Mariners games found')
        return null
      }

      // Sort by date (most recent first)
      marinersGames.sort((a: any, b: any) => 
        new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
      )

      const marinersGame = marinersGames[0]
      console.log('Selected game:', {
        gamePk: marinersGame.gamePk,
        status: marinersGame.status.abstractGameState,
        date: marinersGame.gameDate
      })

      // Get detailed game data if game is live or completed
      if (marinersGame.status.abstractGameState === 'Live' || 
          marinersGame.status.abstractGameState === 'Final') {
        console.log('Fetching detailed game data...')
        const detailedGame = await this.getGameDetails(marinersGame.gamePk)
        console.log('Detailed game data:', detailedGame ? 'Success' : 'Failed')
        return detailedGame
      }

      return marinersGame
    } catch (error) {
      console.error('Error fetching Mariners game:', error)
      return null
    }
  }

  // Get the most recent Mariners game
  async getMostRecentMarinersGame(): Promise<MLBGame | null> {
    try {
      // Get games from the last 7 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      const data = await this.makeApiRequest('schedule', {
        teamId: MARINERS_TEAM_ID.toString(),
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        hydrate: 'game(content(editorial(recap))),decisions,person,stats,team,linescore(matchup)'
      })
      
      if (!data || !data.dates) {
        console.log('No recent games found, returning mock data')
        return this.getMockMarinersGame()
      }

      const allGames = data.dates.flatMap((date: any) => date.games || [])
      
      // Find Mariners games and sort by date (most recent first)
      const marinersGames = allGames
        .filter((game: any) => 
          game.teams.away.team.id === MARINERS_TEAM_ID || 
          game.teams.home.team.id === MARINERS_TEAM_ID
        )
        .sort((a: any, b: any) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())

      return marinersGames.length > 0 ? marinersGames[0] : this.getMockMarinersGame()
    } catch (error) {
      console.error('Error fetching most recent Mariners game:', error)
      console.log('Falling back to mock data')
      return this.getMockMarinersGame()
    }
  }

  // Get detailed game data including live data
  async getGameDetails(gamePk: number): Promise<MLBGame | null> {
    try {
      const data = await this.makeApiRequest('game', {
        gamePk: gamePk.toString(),
        hydrate: 'live,decisions,person,stats,team,linescore(matchup),boxscore'
      })
      
      if (!data || !data.gameData) {
        console.log('No detailed game data found, returning mock data')
        return this.getMockDetailedGame(gamePk)
      }
      
      return data
    } catch (error) {
      console.error('Error fetching game details:', error)
      console.log('Falling back to mock data')
      return this.getMockDetailedGame(gamePk)
    }
  }

  // Mock detailed game data fallback
  private getMockDetailedGame(gamePk: number): MLBGame {
    return {
      gamePk: gamePk,
      gameDate: '2025-01-05T23:15:00Z',
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final',
        codedGameState: 'F'
      },
      teams: {
        away: {
          team: {
            id: 147,
            name: 'Seattle Mariners',
            abbreviation: 'SEA'
          },
          score: 4
        },
        home: {
          team: {
            id: 144,
            name: 'Atlanta Braves',
            abbreviation: 'ATL'
          },
          score: 6
        }
      },
      venue: {
        name: 'Truist Park'
      },
      liveData: {
        linescore: {
          currentInning: 9,
          currentInningOrdinal: '9th',
          inningState: 'Final',
          teams: {
            away: {
              runs: 4,
              hits: 8,
              errors: 1
            },
            home: {
              runs: 6,
              hits: 10,
              errors: 0
            }
          }
        },
        plays: {
          allPlays: [
            {
              about: {
                atBatIndex: 45,
                halfInning: 'bottom',
                inning: 9,
                isTopInning: false
              },
              count: {
                balls: 2,
                strikes: 2,
                outs: 2
              },
              matchup: {
                batter: {
                  id: 12345,
                  fullName: 'Ronald Acuña Jr.',
                  firstName: 'Ronald',
                  lastName: 'Acuña Jr.',
                  primaryNumber: '13',
                  currentTeam: {
                    id: 144,
                    name: 'Atlanta Braves'
                  },
                  primaryPosition: {
                    code: 'OF',
                    name: 'Outfielder',
                    type: 'Outfielder'
                  }
                },
                pitcher: {
                  id: 67890,
                  fullName: 'Andrés Muñoz',
                  firstName: 'Andrés',
                  lastName: 'Muñoz',
                  primaryNumber: '75',
                  currentTeam: {
                    id: 147,
                    name: 'Seattle Mariners'
                  },
                  primaryPosition: {
                    code: 'P',
                    name: 'Pitcher',
                    type: 'Pitcher'
                  }
                },
                batSide: {
                  code: 'R',
                  description: 'Right'
                },
                pitchHand: {
                  code: 'R',
                  description: 'Right'
                }
              },
              result: {
                type: 'at_bat',
                event: 'single',
                description: 'Ronald Acuña Jr. singles on a line drive to center field. Ozzie Albies scores.',
                rbi: 1,
                awayScore: 4,
                homeScore: 6
              },
              playEvents: []
            }
          ]
        },
        boxscore: {
          teams: {
            away: {
              team: {
                id: 147,
                name: 'Seattle Mariners'
              },
              teamStats: {
                batting: {
                  atBats: 35,
                  runs: 4,
                  hits: 8,
                  doubles: 2,
                  triples: 0,
                  homeRuns: 1,
                  rbi: 4,
                  walks: 3,
                  strikeOuts: 8
                }
              }
            },
            home: {
              team: {
                id: 144,
                name: 'Atlanta Braves'
              },
              teamStats: {
                batting: {
                  atBats: 38,
                  runs: 6,
                  hits: 10,
                  doubles: 3,
                  triples: 1,
                  homeRuns: 2,
                  rbi: 6,
                  walks: 4,
                  strikeOuts: 6
                }
              }
            }
          }
        }
      }
    }
  }

  // Mock Mariners game fallback
  private getMockMarinersGame(): MLBGame {
    return {
      gamePk: 776460,
      gameDate: '2025-01-05T23:15:00Z',
      status: {
        abstractGameState: 'Final',
        detailedState: 'Final',
        codedGameState: 'F'
      },
      teams: {
        away: {
          team: {
            id: 147,
            name: 'Seattle Mariners',
            abbreviation: 'SEA'
          },
          score: 4
        },
        home: {
          team: {
            id: 144,
            name: 'Atlanta Braves',
            abbreviation: 'ATL'
          },
          score: 6
        }
      },
      venue: {
        name: 'Truist Park'
      }
    }
  }

  // Get current at-bat from game data
  getCurrentAtBat(game: MLBGame): MLBPlay | null {
    if (!game.liveData?.plays) {
      return null
    }

    const { allPlays, currentPlay } = game.liveData.plays
    
    // If there's a current play, use it
    if (currentPlay) {
      return currentPlay
    }

    // Otherwise, find the most recent at-bat
    const completedPlays = allPlays.filter(play => 
      play.result.type && play.result.type !== 'at_bat'
    )
    
    return completedPlays.length > 0 ? completedPlays[completedPlays.length - 1] : null
  }

  // Check if game is currently live
  isGameLive(game: MLBGame): boolean {
    return game.status.abstractGameState === 'Live'
  }

  // Get game state for the current Mariners game
  async getGameState(): Promise<GameState> {
    try {
      const game = await this.getTodaysMarinersGame()
      
      if (!game) {
        return {
          game: null,
          currentAtBat: null,
          isLoading: false,
          error: 'No Mariners game found for today',
          lastUpdated: new Date().toISOString()
        }
      }

      const currentAtBat = this.getCurrentAtBat(game)
      const isLive = this.isGameLive(game)

      return {
        game,
        currentAtBat,
        isLoading: false,
        error: isLive ? undefined : 'Game is not currently live',
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch game data',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Start real-time updates for live games
  startLiveUpdates(callback: (gameState: GameState) => void) {
    this.listeners.push(callback)
    
    if (this.updateInterval) {
      return // Already running
    }

    // Update every 10 seconds for live games
    this.updateInterval = setInterval(async () => {
      const gameState = await this.getGameState()
      
      // Only send updates if game is live
      if (gameState.game && this.isGameLive(gameState.game)) {
        this.listeners.forEach(listener => listener(gameState))
      }
    }, 10000)

    // Initial update
    this.getGameState().then(gameState => {
      if (gameState.game && this.isGameLive(gameState.game)) {
        this.listeners.forEach(listener => listener(gameState))
      }
    })
  }

  // Stop real-time updates
  stopLiveUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.listeners = []
  }

  // Remove a specific listener
  removeListener(callback: (gameState: GameState) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback)
  }

  // Enable/disable mock data mode (useful for development/testing)
  setMockDataMode(enabled: boolean) {
    this.useMockData = enabled
    console.log(`Mock data mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  // Check if currently using mock data
  isUsingMockData(): boolean {
    return this.useMockData
  }

  // Get service status for debugging
  getServiceStatus() {
    return {
      useMockData: this.useMockData,
      hasActiveListeners: this.listeners.length > 0,
      isUpdating: this.updateInterval !== null,
      apiBaseUrl: this.apiBaseUrl,
      corsProxyUrl: this.corsProxyUrl
    }
  }
}

export const mlbService = new MLBService()
