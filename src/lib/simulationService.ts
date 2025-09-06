import { MLBGame, MLBPlay, AtBatOutcome, getOutcomeCategory } from './types'
import { predictionService } from './predictionService'
import { supabase } from '../supabaseClient'

interface SimulationState {
  isRunning: boolean
  currentAtBatIndex: number
  gamePk: number
  intervalId: NodeJS.Timeout | null
}

class SimulationService {
  private state: SimulationState = {
    isRunning: false,
    currentAtBatIndex: 0,
    gamePk: 999999, // Use a special game ID for simulation
    intervalId: null
  }

  private listeners: ((gameState: any) => void)[] = []

  // Possible outcomes with realistic probabilities
  private outcomes: { outcome: AtBatOutcome; probability: number }[] = [
    { outcome: 'single', probability: 0.15 },
    { outcome: 'double', probability: 0.05 },
    { outcome: 'triple', probability: 0.01 },
    { outcome: 'home_run', probability: 0.03 },
    { outcome: 'walk', probability: 0.08 },
    { outcome: 'strikeout', probability: 0.22 },
    { outcome: 'groundout', probability: 0.20 },
    { outcome: 'flyout', probability: 0.15 },
    { outcome: 'popout', probability: 0.05 },
    { outcome: 'lineout', probability: 0.03 },
    { outcome: 'fielders_choice', probability: 0.02 },
    { outcome: 'error', probability: 0.01 },
    { outcome: 'hit_by_pitch', probability: 0.01 },
    { outcome: 'sacrifice', probability: 0.01 },
    { outcome: 'other', probability: 0.01 }
  ]

  // Mock players for simulation
  private batters = [
    { id: 1001, fullName: 'Mike Trout', primaryNumber: '27' },
    { id: 1002, fullName: 'Aaron Judge', primaryNumber: '99' },
    { id: 1003, fullName: 'Mookie Betts', primaryNumber: '50' },
    { id: 1004, fullName: 'Ronald Acuña Jr.', primaryNumber: '13' },
    { id: 1005, fullName: 'Vladimir Guerrero Jr.', primaryNumber: '27' },
    { id: 1006, fullName: 'Fernando Tatis Jr.', primaryNumber: '23' },
    { id: 1007, fullName: 'Juan Soto', primaryNumber: '22' },
    { id: 1008, fullName: 'Jose Altuve', primaryNumber: '27' },
    { id: 1009, fullName: 'Freddie Freeman', primaryNumber: '5' },
    { id: 1010, fullName: 'Manny Machado', primaryNumber: '13' }
  ]

  private pitchers = [
    { id: 2001, fullName: 'Gerrit Cole', primaryNumber: '45' },
    { id: 2002, fullName: 'Jacob deGrom', primaryNumber: '48' },
    { id: 2003, fullName: 'Shane Bieber', primaryNumber: '57' },
    { id: 2004, fullName: 'Max Scherzer', primaryNumber: '21' },
    { id: 2005, fullName: 'Walker Buehler', primaryNumber: '21' },
    { id: 2006, fullName: 'Lucas Giolito', primaryNumber: '27' },
    { id: 2007, fullName: 'Tyler Glasnow', primaryNumber: '20' },
    { id: 2008, fullName: 'Zac Gallen', primaryNumber: '23' },
    { id: 2009, fullName: 'Corbin Burnes', primaryNumber: '39' },
    { id: 2010, fullName: 'Brandon Woodruff', primaryNumber: '53' }
  ]

  // Generate a random outcome based on probabilities
  private generateRandomOutcome(): AtBatOutcome {
    const random = Math.random()
    let cumulativeProbability = 0

    for (const { outcome, probability } of this.outcomes) {
      cumulativeProbability += probability
      if (random <= cumulativeProbability) {
        return outcome
      }
    }

    // Fallback to single if something goes wrong
    return 'single'
  }

  // Generate a random count
  private generateRandomCount() {
    const balls = Math.floor(Math.random() * 4)
    const strikes = Math.floor(Math.random() * 3)
    const outs = Math.floor(Math.random() * 3)
    
    return { balls, strikes, outs }
  }

  // Generate a random at-bat
  private generateAtBat(): MLBPlay {
    const outcome = this.generateRandomOutcome()
    const count = this.generateRandomCount()
    const batter = this.batters[Math.floor(Math.random() * this.batters.length)]
    const pitcher = this.pitchers[Math.floor(Math.random() * this.pitchers.length)]

    const descriptions: Record<AtBatOutcome, string> = {
      single: `${batter.fullName} singles on a line drive to center field.`,
      double: `${batter.fullName} doubles on a line drive to left field.`,
      triple: `${batter.fullName} triples on a line drive to right field.`,
      home_run: `${batter.fullName} homers to center field.`,
      walk: `${batter.fullName} walks.`,
      strikeout: `${batter.fullName} strikes out swinging.`,
      groundout: `${batter.fullName} grounds out to shortstop.`,
      flyout: `${batter.fullName} flies out to center field.`,
      popout: `${batter.fullName} pops out to second baseman.`,
      lineout: `${batter.fullName} lines out to third baseman.`,
      fielders_choice: `${batter.fullName} reaches on fielder's choice.`,
      error: `${batter.fullName} reaches on an error by the shortstop.`,
      hit_by_pitch: `${batter.fullName} hit by pitch.`,
      sacrifice: `${batter.fullName} sacrifice fly to right field.`,
      other: `${batter.fullName} reaches base.`
    }

    return {
      about: {
        atBatIndex: this.state.currentAtBatIndex,
        halfInning: Math.random() > 0.5 ? 'top' : 'bottom',
        inning: Math.floor(Math.random() * 9) + 1,
        isTopInning: Math.random() > 0.5
      },
      count,
      matchup: {
        batter: {
          id: batter.id,
          fullName: batter.fullName,
          firstName: batter.fullName.split(' ')[0],
          lastName: batter.fullName.split(' ')[1] || '',
          primaryNumber: batter.primaryNumber,
          currentTeam: {
            id: 136,
            name: 'Seattle Mariners'
          },
          primaryPosition: {
            code: 'OF',
            name: 'Outfielder',
            type: 'Outfielder'
          }
        },
        pitcher: {
          id: pitcher.id,
          fullName: pitcher.fullName,
          firstName: pitcher.fullName.split(' ')[0],
          lastName: pitcher.fullName.split(' ')[1] || '',
          primaryNumber: pitcher.primaryNumber,
          currentTeam: {
            id: 144,
            name: 'Atlanta Braves'
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
        event: outcome,
        description: descriptions[outcome],
        rbi: outcome === 'home_run' ? 1 : 0,
        awayScore: 0,
        homeScore: 0
      },
      playEvents: []
    }
  }

  // Create a simulated game
  private createSimulatedGame(): MLBGame {
    return {
      gamePk: this.state.gamePk,
      gameDate: new Date().toISOString(),
      status: {
        abstractGameState: 'Live',
        detailedState: 'In Progress',
        codedGameState: 'I'
      },
      teams: {
        away: {
          team: {
            id: 136,
            name: 'Seattle Mariners',
            abbreviation: 'SEA'
          },
          score: Math.floor(Math.random() * 5)
        },
        home: {
          team: {
            id: 144,
            name: 'Atlanta Braves',
            abbreviation: 'ATL'
          },
          score: Math.floor(Math.random() * 5)
        }
      },
      venue: {
        name: 'T-Mobile Park'
      },
      liveData: {
        linescore: {
          currentInning: Math.floor(Math.random() * 9) + 1,
          currentInningOrdinal: '1st',
          inningState: 'Middle',
          teams: {
            away: {
              runs: Math.floor(Math.random() * 5),
              hits: Math.floor(Math.random() * 10),
              errors: Math.floor(Math.random() * 3)
            },
            home: {
              runs: Math.floor(Math.random() * 5),
              hits: Math.floor(Math.random() * 10),
              errors: Math.floor(Math.random() * 3)
            }
          }
        },
        plays: {
          allPlays: [],
          currentPlay: null
        }
      }
    }
  }

  // Start the simulation
  startSimulation(): void {
    if (this.state.isRunning) {
      console.log('⚠️ Simulation already running')
      return
    }

    console.log('🚀 Starting simulation with gamePk:', this.state.gamePk)
    this.state.isRunning = true
    this.state.currentAtBatIndex = 0

    // Generate initial game state
    const game = this.createSimulatedGame()
    const currentAtBat = this.generateAtBat()

    // Notify listeners of initial state
    this.listeners.forEach(listener => {
      listener({
        game,
        currentAtBat,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
        predictionWindowOpen: true,
        predictionWindowExpires: new Date(Date.now() + 20000).toISOString()
      })
    })

    // Start the interval for new at-bats
    this.state.intervalId = setInterval(async () => {
      console.log('⏰ Simulation interval triggered - resolving predictions...')
      
      // Generate the outcome for the current at-bat
      const currentAtBat = this.generateAtBat()
      const outcome = currentAtBat.result.event as AtBatOutcome
      
      console.log('🎲 Generated outcome:', outcome)
      
      // For simulation mode, resolve all unresolved predictions for this game
      // since we're using timestamp-based at-bat indices
      await this.resolveAllUnresolvedPredictions(outcome)

      this.state.currentAtBatIndex++
      const newAtBat = this.generateAtBat()

      console.log('🔄 Notifying listeners of new at-bat...')

      // Notify listeners of new at-bat
      this.listeners.forEach(listener => {
        listener({
          game,
          currentAtBat: newAtBat,
          isLoading: false,
          lastUpdated: new Date().toISOString(),
          predictionWindowOpen: true,
          predictionWindowExpires: new Date(Date.now() + 20000).toISOString()
        })
      })
    }, 20000) // Every 20 seconds
  }

  // Stop the simulation
  stopSimulation(): void {
    if (!this.state.isRunning) {
      return
    }

    this.state.isRunning = false
    
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId)
      this.state.intervalId = null
    }
  }

  // Check if simulation is running
  isSimulationRunning(): boolean {
    return this.state.isRunning
  }

  // Get the simulation game ID
  getSimulationGameId(): number {
    return this.state.gamePk
  }

  // Add a listener for game state updates
  addListener(callback: (gameState: any) => void): void {
    this.listeners.push(callback)
  }

  // Remove a listener
  removeListener(callback: (gameState: any) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback)
  }

  // Resolve all unresolved predictions for simulation mode
  private async resolveAllUnresolvedPredictions(outcome: AtBatOutcome): Promise<void> {
    try {
      console.log('🔍 Resolving predictions for simulation game:', this.state.gamePk, 'with outcome:', outcome)
      
      // Get all unresolved predictions for the simulation game
      const { data: predictions, error } = await supabase
        .from('at_bat_predictions')
        .select('*')
        .eq('game_pk', this.state.gamePk)
        .is('resolved_at', null)

      if (error) {
        console.error('Error fetching unresolved predictions:', error)
        return
      }

      console.log('📊 Found', predictions?.length || 0, 'unresolved predictions')

      if (!predictions || predictions.length === 0) {
        console.log('ℹ️ No unresolved predictions to resolve')
        return
      }

      // Resolve each prediction
      for (const prediction of predictions) {
        const { points, isExact, isCategoryCorrect } = predictionService.calculatePoints(
          prediction.prediction,
          prediction.prediction_category,
          outcome
        )

        console.log(`🎯 Resolving prediction ${prediction.id}: ${prediction.prediction} -> ${outcome} (${points} points)`)

        const { error: updateError } = await supabase
          .from('at_bat_predictions')
          .update({
            actual_outcome: outcome,
            actual_category: getOutcomeCategory(outcome),
            is_correct: isExact || isCategoryCorrect,
            points_earned: points,
            resolved_at: new Date().toISOString()
          })
          .eq('id', prediction.id)

        if (updateError) {
          console.error('Error resolving prediction:', updateError)
        } else {
          console.log('✅ Successfully resolved prediction:', prediction.id)
        }
      }
    } catch (error) {
      console.error('Error resolving predictions:', error)
    }
  }

  // Manual trigger for testing (remove in production)
  async triggerResolution(): Promise<void> {
    console.log('🧪 Manual resolution trigger')
    const outcome = this.generateAtBat().result.event as AtBatOutcome
    await this.resolveAllUnresolvedPredictions(outcome)
  }

  // Clean up all listeners
  cleanup(): void {
    this.stopSimulation()
    this.listeners = []
  }
}

export const simulationService = new SimulationService()
