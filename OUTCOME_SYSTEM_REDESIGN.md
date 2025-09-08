# Outcome System Redesign

## Overview

This document describes the complete redesign of the scoring and outcomes system to be based on actual MLB API data instead of forcing it into predefined constraints.

## Problem

The previous system had several issues:
1. **"Other" Type Errors**: Many outcomes were being forced into an "other" category, causing scoring errors
2. **Limited Event Types**: The system only supported a small subset of possible baseball outcomes
3. **Inconsistent Mapping**: The mapping between API data and our outcomes was incomplete and error-prone

## Solution

### 1. Comprehensive Event Type Support

Based on the MLB Stats API event types endpoint (`https://statsapi.mlb.com/api/v1/eventTypes`), we now support **all** possible baseball events:

#### Plate Appearance Events (At-Bat Outcomes)
- **Hits**: `single`, `double`, `triple`, `home_run`
- **Walks**: `walk`, `intent_walk`, `hit_by_pitch`
- **Strikeouts**: `strikeout`, `strike_out`, `strikeout_double_play`, `strikeout_triple_play`
- **Field Outs**: `field_out`, `fielders_choice`, `fielders_choice_out`, `force_out`, `grounded_into_double_play`, `grounded_into_triple_play`, `triple_play`, `double_play`
- **Sacrifice Plays**: `sac_fly`, `sac_bunt`, `sac_fly_double_play`, `sac_bunt_double_play`
- **Errors**: `field_error`, `catcher_interf`, `batter_interference`, `fan_interference`

#### Non-Plate Appearance Events
- **Baserunning**: `stolen_base`, `caught_stealing`, `pickoff_*`, `wild_pitch`, `passed_ball`, `balk`, etc.
- **Administrative**: `batter_timeout`, `mound_visit`, `no_pitch`, `injury`, `ejection`, substitutions, etc.

### 2. Improved Scoring System

#### Base Points (Risk-Based)
- **Home Run**: 20 points (rare, high impact)
- **Triple**: 15 points (very rare)
- **Double**: 10 points (uncommon)
- **Single**: 5 points (common)
- **Walk/Strikeout**: 3-4 points (moderate)
- **Field Outs**: 1 point (common)
- **Non-at-bat events**: 0 points (should not be at-bat outcomes)

#### Risk Multipliers
- **Home Run**: +100% bonus (2.0x multiplier)
- **Triple**: +80% bonus (1.8x multiplier)
- **Double**: +50% bonus (1.5x multiplier)
- **Single**: +20% bonus (1.2x multiplier)
- **Walks/Strikeouts**: +10% bonus (1.1x multiplier)
- **Common outcomes**: No bonus (1.0x multiplier)

### 3. Enhanced Categorization

The new system provides more granular categories:
- `hit`: All types of hits
- `walk`: Walks and intentional walks
- `strikeout`: All strikeout variations
- `out`: All field out variations
- `sacrifice`: Sacrifice plays
- `error`: Fielding errors and interference
- `hit_by_pitch`: Hit by pitch
- `baserunning`: Non-plate appearance baserunning events
- `administrative`: Game management events
- `unknown`: Unmapped events

### 4. Direct API Mapping

Instead of trying to parse descriptions or force events into categories, the system now:
1. **Uses `eventType` field first** (most reliable)
2. **Falls back to `event` field** (standardized)
3. **Uses `type` field** (basic)
4. **Parses description** (last resort)

This eliminates the "other" type errors by having comprehensive mappings for all possible API event types.

## Files Modified

### Core Types (`src/lib/types.ts`)
- Expanded `AtBatOutcome` type to include all MLB API event types
- Updated `getOutcomeCategory()` function with comprehensive categorization
- Redesigned `getOutcomePoints()` function with risk-based scoring

### Prediction Service (`src/lib/predictionService.ts`)
- Updated outcome extraction methods to use direct API mappings
- Improved scoring calculations using centralized point system
- Enhanced category point calculations
- Better error handling for unmapped events

### UI Components
- **PredictionResults.tsx**: Updated emoji and label mappings for all new outcome types
- **PredictionForm.tsx**: Updated prediction options to use new outcome types and scoring

## Benefits

1. **Eliminates "Other" Errors**: No more forcing outcomes into generic categories
2. **Comprehensive Coverage**: Supports all possible baseball events from the MLB API
3. **Accurate Scoring**: Risk-based scoring system rewards rare predictions appropriately
4. **Better User Experience**: More specific and accurate outcome descriptions
5. **Future-Proof**: Easy to add new event types as the MLB API evolves
6. **Consistent Mapping**: Direct mapping from API to our system eliminates parsing errors

## Testing

The new system has been tested with:
- All MLB API event types
- Comprehensive outcome categorization
- Risk-based scoring calculations
- UI component updates

## Migration Notes

- Existing predictions will continue to work
- New predictions will use the enhanced scoring system
- The system gracefully handles both old and new outcome types
- No database migration required

## Future Enhancements

1. **Dynamic Event Type Loading**: Load event types from API at runtime
2. **User Preferences**: Allow users to customize scoring weights
3. **Advanced Analytics**: Track prediction accuracy by outcome type
4. **Seasonal Adjustments**: Adjust scoring based on league-wide statistics

