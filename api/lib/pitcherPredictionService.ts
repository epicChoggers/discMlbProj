export class PitcherPredictionService {
  // Calculate points for pitcher predictions using new unified system
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

    // Innings pitched scoring (most important - up to 6 points)
    const ipDiff = Math.abs(predictedIp - actualIp)
    if (ipDiff === 0) {
      points += 6  // Exact match
    } else if (ipDiff <= 0.1) {
      points += 4  // Very close
    } else if (ipDiff <= 0.2) {
      points += 2  // Close
    } else if (ipDiff <= 0.5) {
      points += 1  // Partial credit
    }

    // Hits scoring (up to 4 points)
    const hitsDiff = Math.abs(predictedHits - actualHits)
    if (hitsDiff === 0) {
      points += 4  // Exact match
    } else if (hitsDiff === 1) {
      points += 2  // Close
    } else if (hitsDiff === 2) {
      points += 1  // Partial credit
    }

    // Earned runs scoring (up to 4 points)
    const earnedRunsDiff = Math.abs(predictedEarnedRuns - actualEarnedRuns)
    if (earnedRunsDiff === 0) {
      points += 4  // Exact match
    } else if (earnedRunsDiff === 1) {
      points += 2  // Close
    } else if (earnedRunsDiff === 2) {
      points += 1  // Partial credit
    }

    // Walks scoring (up to 3 points)
    const walksDiff = Math.abs(predictedWalks - actualWalks)
    if (walksDiff === 0) {
      points += 3  // Exact match
    } else if (walksDiff === 1) {
      points += 1  // Close
    }

    // Strikeouts scoring (up to 3 points)
    const strikeoutsDiff = Math.abs(predictedStrikeouts - actualStrikeouts)
    if (strikeoutsDiff === 0) {
      points += 3  // Exact match
    } else if (strikeoutsDiff === 1) {
      points += 1  // Close
    }

    return Math.max(0, points) // Ensure non-negative points
  }
}

// Export singleton instance
export const pitcherPredictionService = new PitcherPredictionService()
