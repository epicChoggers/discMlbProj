# Pitcher Prediction Resolution System

## Overview

The pitcher prediction resolution system automatically detects when a starting pitcher has finished their outing and resolves all user predictions against the actual pitcher statistics. This system eliminates the need for manual intervention and ensures predictions are resolved accurately and timely.

## How It Works

### 1. Automatic Detection

The system monitors MLB game data in real-time and automatically detects when:

- **Game is Final**: The game has ended (status = 'Final' or 'Game Over')
- **Pitcher Substitution**: The starting pitcher has been removed from the game

### 2. Statistics Extraction

When resolution is triggered, the system:

1. **Extracts Pitcher Stats** from the MLB game feed data
2. **Identifies Starting Pitcher** (pitcher with most innings pitched)
3. **Parses Statistics** including IP, Hits, ER, BB, K
4. **Handles Innings Format** (converts "7.1" to 7.33 decimal)

### 3. Prediction Resolution

The system then:

1. **Fetches Unresolved Predictions** for the specific pitcher and game
2. **Calculates Points** using the existing scoring algorithm
3. **Updates Database** with actual results and points earned
4. **Logs Resolution** for audit and debugging purposes

## Key Components

### PitcherStatsService

**Location**: `src/lib/services/PitcherStatsService.ts`

**Responsibilities**:
- Extract pitcher statistics from MLB game feed data
- Parse innings pitched format (e.g., "7.1" → 7.33)
- Identify Mariners starting pitcher
- Determine if pitcher has finished their outing

**Key Methods**:
- `extractPitcherStats(gameData)` - Extract all pitcher stats from game
- `getMarinersStartingPitcherStats(gameData)` - Get Mariners starter stats
- `parseInningsPitched(ipString)` - Convert IP format to decimal

### PitcherSubstitutionService

**Location**: `src/lib/services/PitcherSubstitutionService.ts`

**Responsibilities**:
- Analyze game plays for pitcher substitution events
- Detect when starting pitcher has been removed
- Determine if predictions should be resolved

**Key Methods**:
- `analyzePitcherSubstitutions(gameData)` - Find all pitcher changes
- `hasStartingPitcherBeenRemoved(gameData)` - Check if starter was removed
- `shouldResolveStartingPitcherPredictions(gameData)` - Main decision logic

### DataSyncService Integration

**Location**: `src/lib/services/DataSyncService.ts`

**Integration**:
- Added `resolvePitcherPredictions()` method to existing resolution flow
- Automatically called during game state sync
- Uses existing cron job infrastructure

## API Response Requirements

The system requires the MLB Stats API to provide the following data structure:

### Game Status
```json
{
  "gameData": {
    "status": {
      "abstractGameState": "Final", // or "Live", "Preview"
      "codedGameState": "F", // F=Final, L=Live, P=Preview
      "detailedState": "Final"
    }
  }
}
```

### Pitcher Statistics
```json
{
  "liveData": {
    "boxscore": {
      "teams": {
        "home": {
          "team": { "id": 136, "name": "Seattle Mariners" },
          "players": {
            "ID123456": {
              "person": {
                "id": 123456,
                "fullName": "Logan Gilbert"
              },
              "stats": {
                "pitching": {
                  "inningsPitched": "7.1",
                  "hits": 5,
                  "earnedRuns": 2,
                  "baseOnBalls": 1,
                  "strikeOuts": 8
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Pitcher Substitution Events
```json
{
  "liveData": {
    "plays": {
      "allPlays": [
        {
          "about": {
            "inning": 8,
            "startTime": "2024-01-15T20:30:00Z"
          },
          "playEvents": [
            {
              "type": "pitching_substitution",
              "player": {
                "id": 123456,
                "fullName": "Logan Gilbert"
              },
              "details": {
                "event": "Pitching Substitution",
                "description": "Paul Sewald replaces Logan Gilbert"
              }
            }
          ]
        }
      ]
    }
  }
}
```

## Database Schema

### Pitcher Predictions Table
```sql
CREATE TABLE pitcher_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    game_pk INTEGER NOT NULL,
    pitcher_id INTEGER NOT NULL,
    pitcher_name TEXT NOT NULL,
    predicted_ip DECIMAL(4,1) NOT NULL,
    predicted_hits INTEGER NOT NULL,
    predicted_earned_runs INTEGER NOT NULL,
    predicted_walks INTEGER NOT NULL,
    predicted_strikeouts INTEGER NOT NULL,
    actual_ip DECIMAL(4,1),
    actual_hits INTEGER,
    actual_earned_runs INTEGER,
    actual_walks INTEGER,
    actual_strikeouts INTEGER,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, game_pk, pitcher_id)
);
```

### Resolution Logs Table
```sql
CREATE TABLE pitcher_prediction_resolution_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    pitcher_id INTEGER NOT NULL,
    pitcher_name TEXT,
    resolution_type TEXT NOT NULL DEFAULT 'pitcher_predictions',
    predictions_resolved INTEGER DEFAULT 0,
    points_awarded INTEGER DEFAULT 0,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Scoring System

The existing pitcher prediction scoring system awards points based on accuracy:

- **IP**: Exact match = 10 pts, within 0.1 = 5 pts, within 0.2 = 2 pts
- **Hits**: Exact match = 8 pts, within 1 = 4 pts, within 2 = 2 pts
- **ER**: Exact match = 10 pts, within 1 = 5 pts
- **BB**: Exact match = 6 pts, within 1 = 3 pts
- **K**: Exact match = 8 pts, within 2 = 4 pts, within 4 = 2 pts

## Error Handling

The system includes comprehensive error handling:

1. **Graceful Degradation**: If pitcher stats can't be extracted, resolution is skipped
2. **Individual Prediction Errors**: Failed predictions don't affect others
3. **Logging**: All resolution attempts are logged for debugging
4. **Retry Logic**: Failed resolutions can be retried on next sync

## Testing

A test script is provided (`test-pitcher-resolution.js`) that validates:

- Pitcher statistics extraction
- Substitution detection
- Resolution decision logic
- Points calculation

## Deployment

1. **Run Database Migration**: Execute `add-pitcher-resolution-logging.sql`
2. **Deploy Code**: The system integrates with existing cron jobs
3. **Monitor Logs**: Check resolution logs for successful operation
4. **Test**: Use the test script to validate functionality

## Monitoring

Monitor the system through:

- **Resolution Logs**: Check `pitcher_prediction_resolution_logs` table
- **Console Logs**: Watch for resolution messages in server logs
- **User Feedback**: Users will see resolved predictions in real-time

## Future Enhancements

Potential improvements:

1. **Real-time Notifications**: Notify users when predictions are resolved
2. **Advanced Substitution Detection**: Better handling of complex pitching changes
3. **Performance Optimization**: Cache pitcher stats to reduce API calls
4. **Analytics**: Track resolution accuracy and timing
