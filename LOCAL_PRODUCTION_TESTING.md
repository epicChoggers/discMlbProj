# Local Production Simulation Guide

## Quick Setup

### Method 1: Environment Variable (Recommended)

1. **Create/Update `.env` file:**
   ```bash
   # Add this line to your .env file
   VITE_FORCE_PRODUCTION_MODE=true
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Test the caching:**
   - Open browser dev tools (F12)
   - Go to Network tab
   - Refresh the page multiple times
   - Notice faster response times on subsequent requests

### Method 2: Automated Script

1. **Run the simulation script:**
   ```bash
   node test-production-local.js
   ```

2. **This will:**
   - Automatically enable production mode
   - Start the dev server
   - Show testing instructions
   - Restore settings when you stop it

## What You'll See

### Development Mode (Default)
```
MLB Service initialized in development mode
Fetching current games from MLB API...
Successfully fetched 1 games
```

### Production Mode (Simulated)
```
🚀 Production mode forced locally for testing
MLB Service initialized in production mode
Fetching cached game state from server...
Successfully fetched cached game state
```

## Testing the Caching

### 1. Network Tab Testing
- **First load**: ~200-500ms (API call)
- **Subsequent loads**: ~50-100ms (cached)
- **Cache refresh**: Background job updates every 30 seconds

### 2. Console Testing
```javascript
// Test in browser console
fetch('/api/mlb/game-state')
  .then(r => r.json())
  .then(data => console.log('Response time:', performance.now(), data))
```

### 3. Manual Cache Refresh
```bash
# Test cache refresh endpoint
curl -X POST http://localhost:3000/api/mlb/refresh-cache
```

## Expected Behavior

### ✅ Production Mode Simulation
- Uses `/api/mlb/game-state` endpoint
- Cached responses are much faster
- Background cache refresh every 30 seconds
- Fallback to stale data on API errors

### ❌ Development Mode (Default)
- Direct MLB API calls
- Slower response times
- No caching
- Individual API calls per user

## Troubleshooting

### Cache Not Working?
1. Check `.env` file has `VITE_FORCE_PRODUCTION_MODE=true`
2. Restart development server
3. Check browser console for production mode message

### API Errors?
1. Check if MLB API is accessible
2. Check network tab for failed requests
3. Cache should fallback to stale data

### Slow Responses?
1. First request is always slow (API call)
2. Subsequent requests should be fast (cached)
3. Check if caching is actually enabled

## Reverting to Development Mode

1. **Remove or change the environment variable:**
   ```bash
   # In .env file, change to:
   VITE_FORCE_PRODUCTION_MODE=false
   ```

2. **Restart development server:**
   ```bash
   npm run dev
   ```

## Performance Comparison

| Mode | First Load | Subsequent Loads | API Calls |
|------|------------|------------------|-----------|
| Development | ~500ms | ~500ms | Per user |
| Production (Simulated) | ~500ms | ~50ms | Shared cache |

The production simulation gives you the exact same behavior as production, but running locally for testing!
