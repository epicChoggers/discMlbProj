/**
 * MLB Player Headshot Utilities
 * 
 * This module provides utilities for generating MLB player headshot URLs
 * using the MLB Stats API spots endpoint.
 * 
 * The spots endpoint provides player headshots in various resolutions:
 * - 120px: Small thumbnails
 * - 240px: Medium thumbnails  
 * - 360px: Large thumbnails
 * - 720px: High resolution images
 */

export interface HeadshotOptions {
  /** Resolution in pixels (120, 240, 360, 720) */
  resolution?: number
  /** Fallback URL if player headshot is not available */
  fallbackUrl?: string
}

/**
 * Generates a MLB player headshot URL using the spots API
 * 
 * @param personId - The MLB player ID (e.g., 545361 for Mike Trout)
 * @param options - Optional configuration for resolution and fallback
 * @returns The headshot URL or fallback URL
 * 
 * @example
 * ```typescript
 * // Basic usage with default 120px resolution
 * const headshotUrl = getPlayerHeadshot(545361) // Mike Trout
 * 
 * // With custom resolution
 * const headshotUrl = getPlayerHeadshot(545361, { resolution: 240 })
 * 
 * // With fallback URL
 * const headshotUrl = getPlayerHeadshot(545361, { 
 *   resolution: 360, 
 *   fallbackUrl: '/default-player.png' 
 * })
 * ```
 */
export function getPlayerHeadshot(
  personId: number, 
  options: HeadshotOptions = {}
): string {
  const { resolution = 120, fallbackUrl } = options
  
  // Validate resolution
  const validResolutions = [120, 240, 360, 720]
  if (!validResolutions.includes(resolution)) {
    console.warn(`Invalid resolution ${resolution}. Using default 120px.`)
  }
  
  const finalResolution = validResolutions.includes(resolution) ? resolution : 120
  
  // Generate the spots URL
  const headshotUrl = `https://midfield.mlbstatic.com/v1/people/${personId}/spots/${finalResolution}`
  
  return headshotUrl
}

/**
 * Generates multiple headshot URLs for different resolutions
 * Useful for responsive images or when you need multiple sizes
 * 
 * @param personId - The MLB player ID
 * @returns Object with different resolution URLs
 * 
 * @example
 * ```typescript
 * const headshots = getPlayerHeadshots(545361)
 * // Returns: { small: '...120', medium: '...240', large: '...360', xlarge: '...720' }
 * ```
 */
export function getPlayerHeadshots(personId: number): {
  small: string
  medium: string
  large: string
  xlarge: string
} {
  return {
    small: getPlayerHeadshot(personId, { resolution: 120 }),
    medium: getPlayerHeadshot(personId, { resolution: 240 }),
    large: getPlayerHeadshot(personId, { resolution: 360 }),
    xlarge: getPlayerHeadshot(personId, { resolution: 720 })
  }
}

/**
 * React hook for handling player headshot loading states and fallbacks
 * 
 * @param personId - The MLB player ID
 * @param options - Configuration options
 * @returns Object with headshot URL, loading state, and error handling
 * 
 * @example
 * ```typescript
 * const { headshotUrl, isLoading, hasError } = usePlayerHeadshot(545361, {
 *   resolution: 240,
 *   fallbackUrl: '/default-player.png'
 * })
 * ```
 */
export function usePlayerHeadshot(
  personId: number | null | undefined,
  options: HeadshotOptions = {}
) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  
  const headshotUrl = personId ? getPlayerHeadshot(personId, options) : null
  
  useEffect(() => {
    if (!personId) {
      setIsLoading(false)
      setHasError(true)
      return
    }
    
    setIsLoading(true)
    setHasError(false)
    
    // Test if the image loads successfully
    const img = new Image()
    img.onload = () => {
      setIsLoading(false)
      setHasError(false)
    }
    img.onerror = () => {
      setIsLoading(false)
      setHasError(true)
    }
    img.src = headshotUrl!
  }, [personId, headshotUrl])
  
  return {
    headshotUrl: hasError && options.fallbackUrl ? options.fallbackUrl : headshotUrl,
    isLoading,
    hasError
  }
}

// Import React hooks for the hook function
import { useState, useEffect } from 'react'
