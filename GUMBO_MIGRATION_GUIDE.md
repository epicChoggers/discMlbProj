# GUMBO Migration Guide

## Overview

This guide documents the complete migration from the legacy MLB API system to the new GUMBO-based at-bat data retrieval system. The new system provides comprehensive at-bat tracking using MLB's GUMBO (Grand Unified Master Baseball Object) feed with hydrations.

## What Changed

### Before (Legacy System)
- **API**: Basic `/api/v1/game/{gamePk}/feed/live`
- **Data**: Limited at-bat information
- **Tracking**: Basic current play detection
- **Hydration**: None
- **At-bat Index**: Not consistently used

### After (GUMBO System)
- **API**: GUMBO v1.1 with comprehensive hydrations
- **Data**: Complete at-bat details with pitcher/batter info
- **Tracking**: Index-based at-bat tracking
- **Hydration**: `credits`, `alignment`, `flags`, `officials`, `preState`
- **At-bat Index**: Primary key for at-bat tracking

## New API Endpoints

### 1. GUMBO State Endpoint
```
GET /api/game/gumbo-state?gamePk={gamePk}&forceRefresh=true
```

**Response:**
```json
{
  "success": true,
  "game": { /* Complete game data */ },
  "currentAtBat": { /* Current at-bat with details */ },
  "previousAtBat": { /* Previous at-bat with details */ },
  "isGameLive": true,
  "lastUpdated": "2024-12-20T...",
  "metaData": {
    "apiVersion": "gumbo-v1.1",
    "hydrations": ["credits", "alignment", "flags", "officials", "preState"],
    "atBatTracking": "index-based",
    "dataSource": "MLB Stats API GUMBO"
  }
}
```

### 2. At-Bat Data Endpoint
```
GET /api/game/at-bat-data?gamePk={gamePk}&type={current|previous|specific}&atBatIndex={index}
```

**Response:**
```json
{
  "success": true,
  "gamePk": 775345,
  "atBatType": "current",
  "atBatData": { /* Comprehensive at-bat data */ },
  "gameInfo": { /* Game context */ },
  "lastUpdated": "2024-12-20T...",
  "metaData": { /* API metadata */ }
}
```

### 3. Enhanced Legacy State Endpoint
```
GET /api/game/state?useGumbo=true
```

The existing `/api/game/state` endpoint now supports a `useGumbo=true` parameter to enable GUMBO mode while maintaining backward compatibility.

## New Data Structures

### GUMBO At-Bat Data
```typescript
interface GumboAtBatData {
  about: {
    atBatIndex: number        // Primary key for tracking
    inning: number
    halfInning: string
    isComplete: boolean
    isScoringPlay: boolean
    hasReview: boolean
    hasOut: boolean
    captivatingIndex: number
  }
  matchup: {
    batter: {
      id: number
      fullName: string
      link: string
    }
    pitcher: {
      id: number
      fullName: string
      link: string
    }
    batSide: { code: string, description: string }
    pitchHand: { code: string, description: string }
  }
  result: {
    type: string
    event: string
    eventType: string
    description: string
    rbi: number
    awayScore: number
    homeScore: number
  }
  pitcherDetails?: any      // Enhanced pitcher stats
  batterDetails?: any       // Enhanced batter stats
  credits?: any             // Substitution tracking
  alignment?: any           // Defense/offense alignment
}
```

## Migration Steps

### 1. Frontend Service Migration

**Old Service:**
```typescript
import { mlbServiceNew } from './mlbService'
const gameState = await mlbServiceNew.getGameState()
```

**New Service:**
```typescript
import { gumboMlbService } from './gumboMlbService'
const gumboState = await gumboMlbService.getGumboGameState()
```

### 2. At-Bat Data Access

**Old Way:**
```typescript
const currentAtBat = gameState.currentAtBat
// Limited data, no previous at-bat
```

**New Way:**
```typescript
const { currentAtBat, previousAtBat } = gumboState
// Comprehensive data with pitcher/batter details
const pitcher = currentAtBat?.pitcherDetails || currentAtBat?.matchup?.pitcher
const batter = currentAtBat?.batterDetails || currentAtBat?.matchup?.batter
```

### 3. At-Bat Index Tracking

**Old Way:**
```typescript
// No consistent at-bat tracking
```

**New Way:**
```typescript
const currentIndex = currentAtBat?.about?.atBatIndex
const previousIndex = previousAtBat?.about?.atBatIndex

// Get specific at-bat by index
const specificAtBat = await gumboMlbService.getAtBatByIndex(gamePk, atBatIndex)
```

## Testing the New System

### 1. Test GUMBO APIs
```bash
node test-gumbo-api.js
```

### 2. Test New Endpoints
```bash
# Test GUMBO state endpoint
curl "https://your-domain.vercel.app/api/game/gumbo-state"

# Test at-bat data endpoint
curl "https://your-domain.vercel.app/api/game/at-bat-data?gamePk=775345&type=current"

# Test enhanced legacy endpoint
curl "https://your-domain.vercel.app/api/game/state?useGumbo=true"
```

### 3. Frontend Integration Test
```typescript
// Test the new GUMBO service
const gumboService = new GumboMLBService()
const predictionData = await gumboService.getAtBatPredictionData()
console.log('Current at-bat:', predictionData.currentAtBat)
console.log('Previous at-bat:', predictionData.previousAtBat)
console.log('Pitcher:', predictionData.pitcher)
console.log('Batter:', predictionData.batter)
```

## Benefits of the New System

### 1. Comprehensive Data
- **Pitcher Details**: Complete stats, season performance, game performance
- **Batter Details**: Complete stats, season performance, game performance
- **At-Bat Context**: Previous at-bats, game situation, substitutions

### 2. Reliable Tracking
- **At-Bat Index**: Consistent primary key for tracking at-bats
- **Previous At-Bat**: Easy access to previous at-bat data
- **Substitution Tracking**: Credits hydration tracks mid-at-bat changes

### 3. Enhanced Hydrations
- **Credits**: Track pitcher/batter substitutions during at-bats
- **Alignment**: Defense and offense positioning
- **Flags**: Additional descriptive identifiers
- **Officials**: Umpire alignment
- **PreState**: Pre-play state information

### 4. Better Performance
- **Single Request**: Get all needed data in one API call
- **Efficient Hydration**: Only request needed data
- **Caching**: Better caching strategies possible

## Backward Compatibility

The new system maintains full backward compatibility:

1. **Legacy Endpoints**: All existing endpoints continue to work
2. **Legacy Services**: Old services remain functional
3. **Gradual Migration**: Can migrate components one at a time
4. **Fallback Support**: New services fall back to legacy if needed

## Rollout Strategy

### Phase 1: Infrastructure (Complete)
- ✅ GUMBO service implementation
- ✅ New API endpoints
- ✅ Test suite
- ✅ Documentation

### Phase 2: Frontend Integration (Complete)
- ✅ Update prediction components to use GUMBO data
- ✅ Implement at-bat index tracking
- ✅ Add previous at-bat display
- ✅ Enhanced pitcher/batter stats

### Phase 3: Optimization (Future)
- [ ] Implement caching strategies
- [ ] Add real-time updates
- [ ] Performance monitoring
- [ ] Error handling improvements

## Configuration

### Environment Variables
```bash
# Existing variables (unchanged)
VITE_MLB_API_BASE_URL=https://statsapi.mlb.com/api/v1
VITE_TEAM_ID=136

# New GUMBO configuration
VITE_GUMBO_ENABLED=true
VITE_GUMBO_HYDRATIONS=credits,alignment,flags,officials,preState
```

### Feature Flags
```typescript
// Enable GUMBO in frontend
const useGumbo = import.meta.env.VITE_GUMBO_ENABLED === 'true'

// Use appropriate service
const service = useGumbo ? gumboMlbService : mlbServiceNew
```

## Troubleshooting

### Common Issues

1. **Hydration Failures**
   - Check MLB API status
   - Verify game is live
   - Fall back to legacy service

2. **At-Bat Index Issues**
   - Ensure game has started
   - Check for data consistency
   - Use fallback detection methods

3. **Performance Issues**
   - Monitor API response times
   - Implement caching
   - Use appropriate hydration levels

### Debug Mode
```bash
# Enable debug logging
curl "https://your-domain.vercel.app/api/game/gumbo-state?debug=true"
```

## Support

For issues or questions about the GUMBO migration:

1. Check the test suite: `node test-gumbo-api.js`
2. Review API responses with debug mode
3. Check server logs for detailed error information
4. Verify MLB API status and game availability

## Conclusion

The GUMBO migration provides a robust, comprehensive at-bat data system that significantly improves the prediction game experience. The new system offers better data quality, reliable tracking, and enhanced features while maintaining full backward compatibility.

The migration can be done gradually, allowing for thorough testing and validation at each step.
