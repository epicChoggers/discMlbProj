import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { gamePk, limit } = req.query
    const targetGamePk = gamePk ? parseInt(gamePk as string) : undefined
    const targetLimit = limit ? parseInt(limit as string) : 10

    console.log(`Getting leaderboard: gamePk=${targetGamePk}, limit=${targetLimit}`)

    // Get predictions data
    let predictionsQuery = supabase
      .from('at_bat_predictions')
      .select('user_id, prediction, prediction_category, actual_outcome, actual_category, is_correct, points_earned')
      .not('is_correct', 'is', null)

    if (targetGamePk) {
      predictionsQuery = predictionsQuery.eq('game_pk', targetGamePk)
    }

    const { data: predictionsData, error: predictionsError } = await predictionsQuery

    if (predictionsError) {
      throw predictionsError
    }

    if (!predictionsData || predictionsData.length === 0) {
      res.status(200).json({
        success: true,
        leaderboard: {
          entries: [],
          total_users: 0,
          last_updated: new Date().toISOString()
        }
      })
      return
    }

    // Process the data to calculate stats per user
    const userStats = new Map<string, {
      user_id: string
      total_predictions: number
      correct_predictions: number
      total_outcomes: number
      correct_outcomes: number
      total_exact_outcomes: number
      correct_exact_outcomes: number
      total_points: number
    }>()

    predictionsData.forEach(prediction => {
      const userId = prediction.user_id

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user_id: userId,
          total_predictions: 0,
          correct_predictions: 0,
          total_outcomes: 0,
          correct_outcomes: 0,
          total_exact_outcomes: 0,
          correct_exact_outcomes: 0,
          total_points: 0
        })
      }

      const stats = userStats.get(userId)!
      stats.total_predictions++
      
      // Count outcomes (category-based predictions)
      if (prediction.prediction_category && prediction.actual_category) {
        stats.total_outcomes++
        if (prediction.prediction_category === prediction.actual_category) {
          stats.correct_outcomes++
        }
      }
      
      // Count exact outcomes (specific prediction matches)
      if (prediction.prediction && prediction.actual_outcome) {
        stats.total_exact_outcomes++
        if (prediction.prediction === prediction.actual_outcome) {
          stats.correct_exact_outcomes++
        }
      }
      
      // Count correct predictions and points
      if (prediction.is_correct) {
        stats.correct_predictions++
      }
      
      // Add points earned
      if (prediction.points_earned) {
        stats.total_points += prediction.points_earned
      }
    })

    // Get user profiles for the users with predictions
    const userIds = Array.from(userStats.keys())
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError)
    }

    // Create a map of user profiles
    const profileMap = new Map()
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // Convert to leaderboard entries
    const entries = Array.from(userStats.values())
      .map((stats, index) => {
        const profile = profileMap.get(stats.user_id)
        return {
          user_id: stats.user_id,
          username: profile?.username || 'Unknown User',
          avatar_url: profile?.avatar_url || null,
          total_predictions: stats.total_predictions,
          correct_predictions: stats.correct_predictions,
          accuracy: stats.total_predictions > 0 ? (stats.correct_predictions / stats.total_predictions) * 100 : 0,
          streak: 0, // TODO: Calculate streak
          best_streak: 0, // TODO: Calculate best streak
          rank: index + 1,
          total_outcomes: stats.total_outcomes,
          correct_outcomes: stats.correct_outcomes,
          total_exact_outcomes: stats.total_exact_outcomes,
          correct_exact_outcomes: stats.correct_exact_outcomes,
          total_points: stats.total_points
        }
      })
      .sort((a, b) => b.total_points - a.total_points || b.accuracy - a.accuracy)
      .slice(0, targetLimit)

    const leaderboard = {
      entries,
      total_users: entries.length,
      last_updated: new Date().toISOString()
    }

    res.status(200).json({
      success: true,
      leaderboard,
      gamePk: targetGamePk,
      limit: targetLimit
    })

  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      leaderboard: {
        entries: [],
        total_users: 0,
        last_updated: new Date().toISOString()
      }
    })
  }
}
