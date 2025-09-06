# Vercel Deployment Guide for MLB Service

## ✅ What You Need to Do on Vercel

### 1. **Deploy Your Project**
- Push your code to GitHub/GitLab
- Connect your repository to Vercel
- Vercel will automatically detect the Vite framework

### 2. **Environment Variables**
Set these in your Vercel dashboard under Project Settings → Environment Variables:

```bash
# Supabase (if not already set)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# MLB Service Configuration
VITE_MLB_USE_MOCK_DATA=false
VITE_MLB_API_BASE_URL=/api/mlb
VITE_MLB_CORS_PROXY_URL=https://api.allorigins.win/raw?url=
VITE_DEBUG_MLB_SERVICE=false
```

### 3. **Verify API Routes**
After deployment, test these endpoints:
- `https://your-app.vercel.app/api/mlb/schedule?startDate=2025-01-06&endDate=2025-01-06`
- `https://your-app.vercel.app/api/mlb/game?gamePk=12345`

### 4. **No Additional Configuration Needed**
The following are already configured:
- ✅ `vercel.json` with API function runtime
- ✅ `@vercel/node` dependency moved to production dependencies
- ✅ API routes properly structured
- ✅ CORS headers configured
- ✅ Error handling implemented

## 🚀 Deployment Steps

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Add MLB service with Vercel API routes"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Set environment variables
   - Deploy!

3. **Test the deployment:**
   - Check that your app loads
   - Open browser dev tools
   - Look for API calls to `/api/mlb/`
   - Verify no CORS errors

## 🔧 Troubleshooting

### If API routes don't work:
- Check Vercel function logs in dashboard
- Verify `@vercel/node` is in dependencies (not devDependencies)
- Ensure `vercel.json` has correct function configuration

### If you get CORS errors:
- The API routes include CORS headers
- Fallback to CORS proxy should work automatically
- Check browser network tab for actual requests

### If you want to test locally:
- Set `VITE_MLB_USE_MOCK_DATA=true` in `.env.local`
- Run `npm run dev`
- The service will use mock data instead of real API calls

## 📋 What's Already Done

- ✅ API routes created (`/api/mlb/schedule.ts`, `/api/mlb/game.ts`)
- ✅ MLB service updated with real API integration
- ✅ Fallback system (Vercel API → CORS proxy → Mock data)
- ✅ Environment configuration
- ✅ Error handling and logging
- ✅ Vercel configuration (`vercel.json`)
- ✅ Dependencies properly configured

**You're ready to deploy!** 🎉
