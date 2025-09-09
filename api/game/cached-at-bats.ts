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
    const { gamePk, atBatIndex, context } = req.query
    
    if (!gamePk) {
      res.status(400).json({ error: 'gamePk is required' })
      return
    }

    const targetGamePk = parseInt(gamePk as string)
    const targetAtBatIndex = atBatIndex ? parseInt(atBatIndex as string) : undefined
    const includeContext = context === 'true'

    console.log(`Getting cached at-bat: gamePk=${targetGamePk}, atBatIndex=${targetAtBatIndex}, context=${includeContext}`)

    let query = supabase
      .from('cached_at_bats')
      .select('*')
      .eq('game_pk', targetGamePk)

    if (targetAtBatIndex !== undefined) {
      query = query.eq('at_bat_index', targetAtBatIndex)
    }

    query = query.order('at_bat_index', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching cached at-bats:', error)
      throw error
    }

    // Check if cache is still valid (1 minute TTL)
    const now = new Date().getTime()
    const AT_BAT_TTL = 60000 // 1 minute

    const validData = (data || []).filter(item => {
      const createdAt = new Date(item.created_at).getTime()
      return (now - createdAt) <= AT_BAT_TTL
    })

    if (includeContext) {
      // Process the cached data to extract batter/pitcher information
      const processedData = validData.map(item => {
        const atBatData = item.at_bat_data
        let batter = null
        let pitcher = null

        // Extract batter and pitcher data from various possible structures
        if (atBatData?.matchup) {
          batter = atBatData.matchup.batter
          pitcher = atBatData.matchup.pitcher
        } else if (atBatData?.batter || atBatData?.pitcher) {
          batter = atBatData.batter
          pitcher = atBatData.pitcher
        }

        return {
          atBatIndex: item.at_bat_index,
          gamePk: item.game_pk,
          outcome: item.outcome,
          isResolved: item.is_resolved,
          batter: batter ? {
            id: (batter as any)?.id,
            name: (batter as any)?.fullName || (batter as any)?.name,
            position: (batter as any)?.primaryPosition?.abbreviation || 'Unknown',
            batSide: (batter as any)?.batSide?.code || 'Unknown'
          } : null,
          pitcher: pitcher ? {
            id: (pitcher as any)?.id,
            name: (pitcher as any)?.fullName || (pitcher as any)?.name,
            hand: (pitcher as any)?.pitchHand?.code || 'Unknown'
          } : null,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }
      })

      if (targetAtBatIndex !== undefined) {
        // Return single at-bat if specific index requested
        const atBat = processedData.find(item => item.atBatIndex === targetAtBatIndex)
        res.status(200).json({
          success: true,
          atBat: atBat || null,
          gamePk: targetGamePk,
          atBatIndex: targetAtBatIndex
        })
      } else {
        // Return all at-bats for the game
        res.status(200).json({
          success: true,
          atBats: processedData,
          gamePk: targetGamePk,
          count: processedData.length
        })
      }
    } else {
      // Return raw data
      if (targetAtBatIndex !== undefined) {
        // Return single at-bat if specific index requested
        const atBat = validData.find(item => item.at_bat_index === targetAtBatIndex)
        res.status(200).json({
          success: true,
          atBat: atBat || null,
          gamePk: targetGamePk,
          atBatIndex: targetAtBatIndex
        })
      } else {
        // Return all at-bats for the game
        res.status(200).json({
          success: true,
          atBats: validData,
          gamePk: targetGamePk,
          count: validData.length
        })
      }
    }

  } catch (error) {
    console.error('Error in cached-at-bats API:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}


