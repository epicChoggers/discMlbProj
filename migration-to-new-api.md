# Migration Guide: Old API to New Unified API

This guide will help you transition from the old proxy-based API to the new unified game API architecture.

## Overview

The new API architecture provides:
- **Unified endpoints** that serve cached data instead of proxying MLB API
- **Persistent caching** with database-backed storage
- **Automatic prediction resolution** via background services
- **Real-time updates** through server-side synchronization
- **Better performance** with reduced API calls and faster response times

## Migration Steps

### Step 1: Database Setup

1. **Run the new database schema**:
   ```sql
   -- Execute the contents of api-overhaul-database-schema.sql in your Supabase SQL Editor
   ```

2. **Verify tables are created**:
   - `cached_game_states`
   - `cached_at_bats`
   - `game_sync_log`
   - `prediction_resolution_log`
   - `system_health`

### Step 2: Deploy New API Endpoints

The new API endpoints are already created in the `api/` directory:

- **Game State**: `/api/game/state` (replaces `/api/mlb/game-state`)
- **Predictions**: `/api/game/predictions` (new unified endpoint)
- **Leaderboard**: `/api/game/leaderboard` (new unified endpoint)
- **System Health**: `/api/system/health` (new monitoring endpoint)
- **System Stats**: `/api/system/stats` (new analytics endpoint)
- **Cron Management**: `/api/system/cron` (new cron management endpoint)

### Step 3: Update Frontend Services

#### 3.1 Use the New Services

The new services have been created and are ready to use:

- `src/lib/mlbServiceNew.ts` - New MLB service using unified API
- `src/lib/predictionServiceNew.ts` - New prediction service using unified API  
- `src/lib/leaderboardServiceNew.ts` - New leaderboard service using unified API
- `src/lib/useGameStateNew.ts` - New game state hook using new services
- `src/lib/useRealtimePredictionsNew.ts` - New predictions hook using new services

#### 3.2 Automated Migration

Run the migration script to automatically update your imports:

```bash
node migrate-to-new-services.js
```

This script will:
- Update all imports from old services to new services
- Create backup files of your existing code
- Show you what changes were made

#### 3.3 Manual Updates

If you prefer to update manually, replace your imports:

```typescript
// Old imports
import { mlbService } from './mlbService'
import { predictionService } from './predictionService'
import { leaderboardService } from './leaderboardService'
import { useGameState } from './useGameState'
import { useRealtimePredictions } from './useRealtimePredictions'

// New imports
import { mlbServiceNew as mlbService } from './mlbServiceNew'
import { predictionServiceNew as predictionService } from './predictionServiceNew'
import { leaderboardServiceNew as leaderboardService } from './leaderboardServiceNew'
import { useGameStateNew as useGameState } from './useGameStateNew'
import { useRealtimePredictionsNew as useRealtimePredictions } from './useRealtimePredictionsNew'
```

#### 3.2 Update Prediction Service

Update the prediction service to use the new unified API:

```typescript
// In src/lib/predictionService.ts
class PredictionService {
  private apiBaseUrl = '/api/game'

  async submitPrediction(
    gamePk: number,
    atBatIndex: number,
    prediction: AtBatOutcome,
    predictionCategory?: string
  ): Promise<AtBatPrediction | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const response = await fetch(`${this.apiBaseUrl}/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          gamePk,
          atBatIndex,
          prediction,
          predictionCategory
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit prediction')
      }

      const data = await response.json()
      return data.prediction
    } catch (error) {
      console.error('Error submitting prediction:', error)
      throw error
    }
  }

  async getAtBatPredictions(gamePk: number, atBatIndex: number): Promise<AtBatPrediction[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/predictions?gamePk=${gamePk}&atBatIndex=${atBatIndex}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.predictions || []
    } catch (error) {
      console.error('Error fetching at-bat predictions:', error)
      return []
    }
  }

  // Keep other methods for backward compatibility
}
```

#### 3.3 Update Leaderboard Service

Update the leaderboard service to use the new unified API:

```typescript
// In src/lib/leaderboardService.ts
class LeaderboardService {
  private apiBaseUrl = '/api/game'

  async getLeaderboard(gamePk?: number, limit: number = 10): Promise<LeaderboardType> {
    try {
      let url = `${this.apiBaseUrl}/leaderboard?limit=${limit}`
      if (gamePk) {
        url += `&gamePk=${gamePk}`
      }

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.leaderboard
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      return {
        entries: [],
        total_users: 0,
        last_updated: new Date().toISOString()
      }
    }
  }
}
```

### Step 4: Test the New System

1. **Run the automated test suite**:
   ```bash
   # Test all new API endpoints
   node test-new-api.js
   
   # Test with verbose output
   node test-new-api.js --verbose
   
   # Test against production URL
   node test-new-api.js --url https://your-app.vercel.app
   ```

2. **Manual API testing**:
   ```bash
   # Test game state
   curl https://your-app.vercel.app/api/game/state
   
   # Test predictions
   curl https://your-app.vercel.app/api/game/predictions?gamePk=123
   
   # Test leaderboard
   curl https://your-app.vercel.app/api/game/leaderboard
   
   # Test system health
   curl https://your-app.vercel.app/api/system/health
   ```

3. **Monitor system health**:
   - Check `/api/system/health` for service status
   - Check `/api/system/stats` for performance metrics
   - Check `/api/system/cron` for cron job status

### Step 5: Gradual Rollout

1. **Enable new API alongside old API**:
   - Both systems can run simultaneously
   - Use feature flags to gradually migrate users

2. **Monitor performance**:
   - Compare response times between old and new APIs
   - Monitor error rates and cache hit rates
   - Check database performance

3. **Switch traffic gradually**:
   - Start with 10% of users
   - Increase to 50% if no issues
   - Complete migration to 100%

### Step 6: Cleanup

Once the new system is stable and all users are migrated:

1. **Remove old API endpoints**:
   - Delete `/api/mlb/` directory
   - Remove old cron jobs from `vercel.json`

2. **Update documentation**:
   - Update API documentation
   - Update deployment guides

3. **Clean up old code**:
   - Remove unused imports and functions
   - Clean up old configuration files

## Rollback Plan

If issues arise during migration:

1. **Immediate rollback**:
   - Revert frontend services to use old API endpoints
   - Disable new cron jobs
   - Keep old API endpoints running

2. **Database rollback**:
   - New tables can remain (they don't affect old system)
   - Or drop new tables if needed

3. **Investigate issues**:
   - Check logs for errors
   - Monitor system health endpoints
   - Fix issues before retrying migration

## Benefits After Migration

- **Faster response times**: Cached data served instantly
- **Reduced API calls**: Single endpoint for all game data
- **Better reliability**: Fallback mechanisms and error handling
- **Real-time updates**: Server-side synchronization
- **Better monitoring**: Comprehensive health checks and metrics
- **Scalability**: Database-backed system handles more users
- **Maintainability**: Centralized logic easier to maintain

## Support

If you encounter issues during migration:

1. Check the system health endpoint: `/api/system/health`
2. Review logs in Vercel dashboard
3. Check database performance in Supabase
4. Use the monitoring endpoints to identify bottlenecks

The new system is designed to be more robust and performant than the old proxy-based approach.
