# Pitcher Predictions Feature Implementation

## Overview
This document outlines the implementation of the new pitcher predictions feature for the Mariners prediction app. Users can now predict the starting pitcher's performance line (IP, Hits, ER, BB, K) for each game.

## Database Schema

### New Table: `pitcher_predictions`
```sql
CREATE TABLE pitcher_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    game_pk INTEGER NOT NULL,
    pitcher_id INTEGER NOT NULL,
    pitcher_name TEXT NOT NULL,
    predicted_ip DECIMAL(4,1) NOT NULL, -- e.g., 7.1, 6.2
    predicted_hits INTEGER NOT NULL CHECK (predicted_hits >= 0),
    predicted_earned_runs INTEGER NOT NULL CHECK (predicted_earned_runs >= 0),
    predicted_walks INTEGER NOT NULL CHECK (predicted_walks >= 0),
    predicted_strikeouts INTEGER NOT NULL CHECK (predicted_strikeouts >= 0),
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

### New View: `pitcher_prediction_leaderboard`
A leaderboard view that aggregates pitcher prediction performance across all users.

## API Endpoints

### 1. `/api/game/pitcher-predictions`
- **GET**: Retrieve pitcher predictions for a game
- **POST**: Submit a new pitcher prediction
- **PUT**: Update a pitcher prediction with actual results

### 2. `/api/game/pitcher-info`
- **GET**: Get projected starting pitcher information for a game

## Frontend Components

### 1. `PitcherPredictionForm`
- Form for users to input their pitcher predictions
- Validates input values (IP format, non-negative numbers)
- Shows scoring information
- Prevents duplicate predictions

### 2. `PitcherPredictionResults`
- Displays all pitcher predictions for a game
- Shows prediction accuracy with visual indicators
- Real-time updates via Supabase subscriptions
- Displays actual results when available

### 3. `PitcherPredictions`
- Main component that combines form and results
- Fetches pitcher information from MLB API
- Handles loading states and errors

## Scoring System

The scoring system awards points based on prediction accuracy:

- **Innings Pitched (IP)**:
  - Exact match: 10 points
  - Within 0.1 IP: 5 points
  - Within 0.2 IP: 2 points

- **Hits**:
  - Exact match: 8 points
  - Within 1: 4 points
  - Within 2: 2 points

- **Earned Runs**:
  - Exact match: 10 points
  - Within 1: 5 points

- **Walks**:
  - Exact match: 6 points
  - Within 1: 3 points

- **Strikeouts**:
  - Exact match: 8 points
  - Within 2: 4 points
  - Within 4: 2 points

## Navigation Integration

Added a new "Pitcher Predictions" tab to the main navigation:
- Accessible from the main app interface
- Responsive design for mobile and desktop
- Integrated with existing tab system

## Real-time Features

- Real-time updates when new predictions are submitted
- Live leaderboard updates
- Automatic refresh when predictions are resolved

## Files Created/Modified

### New Files:
1. `add-pitcher-predictions.sql` - Database migration
2. `api/game/pitcher-predictions.ts` - API endpoint for predictions
3. `api/game/pitcher-info.ts` - API endpoint for pitcher info
4. `src/lib/pitcherPredictionService.ts` - Client-side service
5. `src/components/PitcherPredictionForm.tsx` - Prediction form
6. `src/components/PitcherPredictionResults.tsx` - Results display
7. `src/components/PitcherPredictions.tsx` - Main component

### Modified Files:
1. `src/lib/types.ts` - Added pitcher prediction types
2. `src/components/TextWall.tsx` - Added navigation tab

## Usage Instructions

1. **Run Database Migration**: Execute `add-pitcher-predictions.sql` in Supabase
2. **Access Feature**: Navigate to the "Pitcher Predictions" tab
3. **Make Predictions**: Enter predicted stats for the starting pitcher
4. **View Results**: See all predictions and their accuracy
5. **Track Performance**: Monitor your points and leaderboard position

## Technical Considerations

- **MLB API Integration**: Fetches projected starting pitcher from game data
- **Input Validation**: Ensures valid IP format (e.g., 6.1, 7.2)
- **Duplicate Prevention**: One prediction per user per pitcher per game
- **Real-time Updates**: Uses Supabase real-time subscriptions
- **Responsive Design**: Works on mobile and desktop
- **Error Handling**: Comprehensive error states and user feedback

## Future Enhancements

Potential improvements for future versions:
- Historical pitcher performance data
- Advanced statistics (ERA, WHIP predictions)
- Multiple pitcher predictions per game
- Pitcher-specific leaderboards
- Integration with fantasy baseball APIs
- Machine learning predictions based on historical data
