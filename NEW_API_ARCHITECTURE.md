# New API Architecture Documentation

## Overview

The new API architecture transforms the application from a simple MLB API proxy to a comprehensive game data management system. This architecture provides better performance, reliability, and scalability while maintaining real-time capabilities.

## Architecture Principles

### 1. **Data Ownership**
- The application owns and manages game data
- MLB API is treated as a data source, not the primary interface
- All data is cached and served from our own endpoints

### 2. **Performance First**
- Database-backed caching for instant responses
- Intelligent cache invalidation based on game state
- Fallback mechanisms for API failures

### 3. **Real-Time Capabilities**
- Server-side data synchronization
- Automatic prediction resolution
- Real-time updates through Supabase subscriptions

### 4. **Monitoring & Observability**
- Comprehensive health checks
- Performance metrics and analytics
- Error tracking and logging

## Core Components

### 1. GameDataService (`src/lib/services/GameDataService.ts`)

**Purpose**: Centralized service for all MLB API interactions

**Key Features**:
- Retry logic with exponential backoff
- Request caching with TTL
- Pacific Timezone handling
- Outcome extraction from play data
- Error handling and recovery

**Methods**:
- `getTodaysMarinersGame()`: Get current Mariners game
- `getGameDetails(gamePk)`: Get detailed game data
- `getCurrentAtBat(game)`: Extract current at-bat
- `extractOutcomeFromPlay(play)`: Parse play outcomes
- `isGameLive(game)`: Check if game is live

### 2. GameCacheService (`src/lib/services/GameCacheService.ts`)

**Purpose**: Persistent caching system using Supabase

**Key Features**:
- Database-backed caching
- TTL-based cache invalidation
- Cache statistics and monitoring
- Automatic cleanup of stale data

**Methods**:
- `cacheGameState(gameState)`: Cache game state
- `getCachedGameState(gamePk?)`: Retrieve cached state
- `cacheAtBat(gamePk, atBatIndex, atBatData)`: Cache at-bat data
- `cleanupStaleCache()`: Remove expired entries
- `getCacheStats()`: Get cache statistics

### 3. CronService (`src/lib/services/CronService.ts`)

**Purpose**: Background job management and scheduling

**Key Features**:
- Configurable job schedules
- Health monitoring
- Error tracking and recovery
- System health reporting

**Jobs**:
- **Game State Sync**: Every 10 seconds during live games
- **Prediction Resolution**: Every 5 seconds during live games
- **Cache Cleanup**: Every 10 minutes
- **Health Check**: Every 5 minutes

## API Endpoints

### Game Endpoints

#### `GET /api/game/state`
**Purpose**: Get current game state (replaces `/api/mlb/game-state`)

**Query Parameters**:
- `gamePk` (optional): Specific game ID
- `forceRefresh` (optional): Force fresh data from MLB API

**Response**:
```json
{
  "success": true,
  "game": { /* MLB game data */ },
  "currentAtBat": { /* Current at-bat data */ },
  "isLoading": false,
  "error": null,
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "source": "cache" // or "api" or "stale_cache"
}
```

#### `GET /api/game/predictions`
**Purpose**: Get predictions for a game or specific at-bat

**Query Parameters**:
- `gamePk` (required): Game ID
- `atBatIndex` (optional): Specific at-bat index
- `userId` (optional): Filter by user ID

**Response**:
```json
{
  "success": true,
  "predictions": [/* AtBatPrediction array */],
  "count": 10,
  "gamePk": 123,
  "atBatIndex": 5
}
```

#### `POST /api/game/predictions`
**Purpose**: Create a new prediction

**Headers**:
- `Authorization: Bearer <token>`

**Body**:
```json
{
  "gamePk": 123,
  "atBatIndex": 5,
  "prediction": "single",
  "predictionCategory": "hit"
}
```

#### `GET /api/game/leaderboard`
**Purpose**: Get leaderboard data

**Query Parameters**:
- `gamePk` (optional): Filter by specific game
- `limit` (optional): Number of entries (default: 10)

**Response**:
```json
{
  "success": true,
  "leaderboard": {
    "entries": [/* LeaderboardEntry array */],
    "total_users": 25,
    "last_updated": "2024-01-01T00:00:00.000Z"
  }
}
```

### System Endpoints

#### `GET /api/system/health`
**Purpose**: System health check

**Query Parameters**:
- `detailed` (optional): Include detailed service information

**Response**:
```json
{
  "success": true,
  "status": "healthy", // or "degraded" or "error"
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "healthy": 4,
    "total": 4,
    "details": [/* Service details if detailed=true */]
  },
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### `GET /api/system/stats`
**Purpose**: System performance statistics

**Query Parameters**:
- `timeframe` (optional): Time range (1h, 6h, 12h, 24h, 7d, 30d)

**Response**:
```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "timeframe": "24h",
  "stats": {
    "cache": { /* Cache statistics */ },
    "predictions": { /* Prediction statistics */ },
    "sync": { /* Sync statistics */ },
    "systemHealth": { /* Health statistics */ },
    "gameDataService": { /* Service statistics */ }
  }
}
```

#### `GET /api/system/cron`
**Purpose**: Cron job status and management

**Response**:
```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "jobs": {
    "game_state_sync": {
      "name": "Game State Sync",
      "schedule": "*/10 * * * * *",
      "enabled": true,
      "running": true
    }
  },
  "systemHealth": {
    "total_services": 4,
    "healthy_services": 4,
    "error_services": 0
  }
}
```

#### `POST /api/system/cron`
**Purpose**: Manage cron jobs

**Body**:
```json
{
  "jobId": "game_state_sync",
  "action": "enable" // or "disable", "start", "stop", "status"
}
```

## Database Schema

### Core Tables

#### `cached_game_states`
Stores cached game state data
```sql
CREATE TABLE cached_game_states (
    id UUID PRIMARY KEY,
    game_pk INTEGER UNIQUE NOT NULL,
    game_data JSONB NOT NULL,
    current_at_bat JSONB,
    is_live BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `cached_at_bats`
Stores cached at-bat data
```sql
CREATE TABLE cached_at_bats (
    id UUID PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    at_bat_data JSONB NOT NULL,
    outcome TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_pk, at_bat_index)
);
```

#### `game_sync_log`
Tracks data synchronization events
```sql
CREATE TABLE game_sync_log (
    id UUID PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    data_size INTEGER,
    sync_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `prediction_resolution_log`
Tracks prediction resolution events
```sql
CREATE TABLE prediction_resolution_log (
    id UUID PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    predictions_resolved INTEGER NOT NULL DEFAULT 0,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    resolution_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `system_health`
Tracks system health and performance
```sql
CREATE TABLE system_health (
    id UUID PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,
    response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    last_success TIMESTAMP WITH TIME ZONE,
    last_error TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Caching Strategy

### Cache TTL (Time To Live)
- **Live Games**: 10 seconds
- **Non-Live Games**: 5 minutes
- **At-Bat Data**: 1 minute
- **Static Data**: 1 hour

### Cache Invalidation
- **Automatic**: Based on TTL expiration
- **Manual**: When game state changes significantly
- **Cleanup**: Background job removes stale entries

### Fallback Strategy
1. **Primary**: Serve cached data
2. **Secondary**: Fetch fresh data from MLB API
3. **Tertiary**: Serve stale cached data if API fails
4. **Fallback**: Return error with graceful degradation

## Real-Time Updates

### Server-Side Synchronization
- Cron jobs update cached data every 10 seconds during live games
- Automatic prediction resolution every 5 seconds
- Cache invalidation when game state changes

### Client-Side Updates
- Supabase real-time subscriptions for prediction updates
- Game state updates through polling (can be upgraded to WebSockets)
- Automatic UI updates when data changes

## Error Handling

### API Errors
- Retry logic with exponential backoff
- Graceful degradation to cached data
- Comprehensive error logging

### Database Errors
- Connection pooling and retry logic
- Fallback to in-memory cache
- Error tracking and alerting

### MLB API Errors
- Multiple retry attempts
- Fallback to stale cached data
- Error reporting and monitoring

## Performance Optimizations

### Database Optimizations
- Indexed queries for fast lookups
- Connection pooling
- Query optimization

### Caching Optimizations
- Multi-level caching (memory + database)
- Intelligent cache invalidation
- Background cache warming

### API Optimizations
- Response compression
- Efficient data serialization
- Minimal data transfer

## Monitoring & Observability

### Health Checks
- Service availability monitoring
- Response time tracking
- Error rate monitoring

### Metrics
- Cache hit/miss rates
- API response times
- Database performance
- User activity metrics

### Logging
- Structured logging with context
- Error tracking and alerting
- Performance metrics collection

## Deployment

### Vercel Configuration
```json
{
  "crons": [
    {
      "path": "/api/system/cron",
      "schedule": "*/10 * * * * *"
    }
  ]
}
```

### Environment Variables
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `MLB_API_BASE_URL`: MLB API base URL (optional)

### Database Setup
1. Run `api-overhaul-database-schema.sql` in Supabase
2. Verify all tables and indexes are created
3. Test RLS policies and permissions

## Testing

### Unit Tests
- Service layer testing
- API endpoint testing
- Database operation testing

### Integration Tests
- End-to-end API testing
- Database integration testing
- External API integration testing

### Performance Tests
- Load testing
- Cache performance testing
- Database performance testing

## Security

### Authentication
- Supabase JWT tokens
- Row Level Security (RLS)
- API key validation

### Data Protection
- Encrypted data transmission
- Secure database connections
- Input validation and sanitization

### Access Control
- User-based permissions
- Service-level access control
- Audit logging

## Troubleshooting

### Common Issues

#### Cache Misses
- Check TTL configuration
- Verify cache cleanup jobs
- Monitor cache statistics

#### API Errors
- Check MLB API status
- Verify retry logic
- Review error logs

#### Database Issues
- Check connection pool
- Monitor query performance
- Review RLS policies

### Debugging Tools
- System health endpoint
- Cache statistics endpoint
- Performance metrics endpoint
- Error logging and tracking

## Future Enhancements

### Planned Features
- WebSocket support for real-time updates
- Advanced caching strategies
- Machine learning for prediction accuracy
- Enhanced analytics and reporting

### Scalability Improvements
- Horizontal scaling support
- Advanced load balancing
- Microservices architecture
- Event-driven architecture

This architecture provides a solid foundation for a scalable, performant, and maintainable game prediction system.
