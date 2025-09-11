import { MLBPlay } from '../types'

export interface CountData {
  balls: number
  strikes: number
  outs: number
}

/**
 * Extract count data from an at-bat with consistent fallbacks
 * This ensures all components use the same source of truth for count data
 */
export function getCountData(atBat: MLBPlay | null): CountData {
  if (!atBat?.count) {
    return { balls: 0, strikes: 0, outs: 0 }
  }

  return {
    balls: atBat.count.balls ?? 0,
    strikes: atBat.count.strikes ?? 0,
    outs: atBat.count.outs ?? 0
  }
}

/**
 * Check if the count is too advanced for predictions (2+ balls or 2+ strikes)
 */
export function isCountTooAdvanced(count: CountData): boolean {
  return count.balls >= 2 || count.strikes >= 2
}

/**
 * Check if the inning has ended (3 outs)
 */
export function isInningEnded(count: CountData): boolean {
  return count.outs >= 3
}

/**
 * Format count as a string (e.g., "1-2")
 */
export function formatCount(count: CountData): string {
  return `${count.balls}-${count.strikes}`
}

/**
 * Get count status for display
 */
export function getCountStatus(count: CountData): {
  isTooAdvanced: boolean
  isInningEnded: boolean
  formattedCount: string
} {
  return {
    isTooAdvanced: isCountTooAdvanced(count),
    isInningEnded: isInningEnded(count),
    formattedCount: formatCount(count)
  }
}
