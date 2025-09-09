import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/supabase.js'

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
    const { gamePk } = req.query
    
    if (!gamePk) {
      res.status(400).json({ error: 'gamePk is required' })
      return
    }

    const targetGamePk = parseInt(gamePk as string)

    console.log(`Debugging cache for game ${targetGamePk}...`)

    // Get all cached at-bats for this game
    const { data: cachedAtBats, error: atBatError } = await supabase
      .from('cached_at_bats')
      .select('*')
      .eq('game_pk', targetGamePk)
      .order('at_bat_index', { ascending: true })

    if (atBatError) {
      throw atBatError
    }

    // Get all predictions for this game
    const { data: predictions, error: predError } = await supabase
      .from('at_bat_predictions')
      .select('*')
      .eq('game_pk', targetGamePk)
      .order('at_bat_index', { ascending: true })

    if (predError) {
      throw predError
    }

    // Analyze the data structure
    const analysis = {
      gamePk: targetGamePk,
      cachedAtBats: {
        count: cachedAtBats?.length || 0,
        atBatIndices: cachedAtBats?.map(ab => ab.at_bat_index) || [],
        sampleData: cachedAtBats?.[0] ? {
          atBatIndex: cachedAtBats[0].at_bat_index,
          hasAtBatData: !!cachedAtBats[0].at_bat_data,
          atBatDataKeys: cachedAtBats[0].at_bat_data ? Object.keys(cachedAtBats[0].at_bat_data) : [],
          hasMatchup: !!(cachedAtBats[0].at_bat_data?.matchup),
          matchupKeys: cachedAtBats[0].at_bat_data?.matchup ? Object.keys(cachedAtBats[0].at_bat_data.matchup) : [],
          hasBatter: !!(cachedAtBats[0].at_bat_data?.matchup?.batter),
          hasPitcher: !!(cachedAtBats[0].at_bat_data?.matchup?.pitcher),
          batterName: cachedAtBats[0].at_bat_data?.matchup?.batter?.fullName || 'N/A',
          pitcherName: cachedAtBats[0].at_bat_data?.matchup?.pitcher?.fullName || 'N/A'
        } : null
      },
      predictions: {
        count: predictions?.length || 0,
        atBatIndices: predictions?.map(p => p.at_bat_index) || [],
        sampleData: predictions?.[0] ? {
          atBatIndex: predictions[0].at_bat_index,
          hasBatterData: !!(predictions[0].batter_name),
          hasPitcherData: !!(predictions[0].pitcher_name),
          batterName: predictions[0].batter_name || 'N/A',
          pitcherName: predictions[0].pitcher_name || 'N/A'
        } : null
      }
    }

    res.status(200).json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('Error debugging cache:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
