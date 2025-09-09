export class PitcherPredictionService {
  // Calculate points for pitcher predictions
  calculatePoints(
    predictedIp: number,
    predictedHits: number,
    predictedEarnedRuns: number,
    predictedWalks: number,
    predictedStrikeouts: number,
    actualIp: number,
    actualHits: number,
    actualEarnedRuns: number,
    actualWalks: number,
    actualStrikeouts: number
  ): number {
    let points = 0

    // Innings pitched scoring (most important - up to 10 points)
    const ipDiff = Math.abs(predictedIp - actualIp)
    if (ipDiff === 0) {
      points += 10
    } else if (ipDiff <= 0.1) {
      points += 8
    } else if (ipDiff <= 0.2) {
      points += 6
    } else if (ipDiff <= 0.3) {
      points += 4
    } else if (ipDiff <= 0.5) {
      points += 2
    }

    // Hits scoring (up to 5 points)
    const hitsDiff = Math.abs(predictedHits - actualHits)
    if (hitsDiff === 0) {
      points += 5
    } else if (hitsDiff === 1) {
      points += 3
    } else if (hitsDiff === 2) {
      points += 1
    }

    // Earned runs scoring (up to 5 points)
    const earnedRunsDiff = Math.abs(predictedEarnedRuns - actualEarnedRuns)
    if (earnedRunsDiff === 0) {
      points += 5
    } else if (earnedRunsDiff === 1) {
      points += 3
    } else if (earnedRunsDiff === 2) {
      points += 1
    }

    // Walks scoring (up to 3 points)
    const walksDiff = Math.abs(predictedWalks - actualWalks)
    if (walksDiff === 0) {
      points += 3
    } else if (walksDiff === 1) {
      points += 2
    } else if (walksDiff === 2) {
      points += 1
    }

    // Strikeouts scoring (up to 3 points)
    const strikeoutsDiff = Math.abs(predictedStrikeouts - actualStrikeouts)
    if (strikeoutsDiff === 0) {
      points += 3
    } else if (strikeoutsDiff === 1) {
      points += 2
    } else if (strikeoutsDiff === 2) {
      points += 1
    }

    return Math.max(0, points) // Ensure non-negative points
  }
}

// Export singleton instance
export const pitcherPredictionService = new PitcherPredictionService()
