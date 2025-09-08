# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Ensure your Supabase project is set up and running
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)

## Environment Variables Setup

### Required Environment Variables

You need to set these environment variables in your Vercel project:

1. **VITE_SUPABASE_URL**
   - Your Supabase project URL
   - Format: `https://your-project-id.supabase.co`

2. **VITE_SUPABASE_ANON_KEY**
   - Your Supabase anonymous/public key
   - Found in your Supabase project settings under "API"

3. **VITE_SHARED_EMAIL** (if used)
   - The shared email for authentication
   - Format: `site@yourdomain.com`

4. **VITE_TEAM_ID** (optional)
   - The MLB team ID to track (defaults to 136 for Seattle Mariners)
   - Find team IDs at: https://statsapi.mlb.com/api/v1/teams
   - Examples: 136 (Seattle Mariners), 147 (New York Yankees), 119 (Los Angeles Dodgers)

### How to Set Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add each variable:
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: Your Supabase URL
   - **Environment**: Production (and Preview if needed)
5. Repeat for all required variables

## Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from your project directory:
   ```bash
   vercel
   ```

4. Follow the prompts to link your project

### Method 2: Git Integration

1. Connect your Git repository to Vercel
2. Vercel will automatically deploy on every push to your main branch
3. Set up environment variables in the Vercel dashboard

## Team Configuration

### Changing the Team ID

To track a different MLB team:

1. **Find the Team ID**:
   - Visit: https://statsapi.mlb.com/api/v1/teams
   - Look for your team's `id` field
   - Common team IDs:
     - 136: Seattle Mariners (default)
     - 147: New York Yankees
     - 119: Los Angeles Dodgers
     - 121: New York Mets
     - 111: Boston Red Sox

2. **Set the Environment Variable**:
   - In Vercel: Set `VITE_TEAM_ID` to your desired team ID
   - For local development: Create `.env.local` with `VITE_TEAM_ID=your_team_id`

3. **Redeploy**:
   - If using Git integration: Push your changes
   - If using CLI: Run `vercel --prod`

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] Supabase URL and keys are valid
- [ ] Team ID is configured (if different from default)
- [ ] Authentication flow works
- [ ] All features are functional
- [ ] Custom domain is configured (if needed)

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compilation passes locally

2. **Environment Variables Not Working**
   - Verify variable names start with `VITE_`
   - Check that variables are set for the correct environment (Production)

3. **Supabase Connection Issues**
   - Verify Supabase URL and keys are correct
   - Check Supabase project is active and accessible

4. **Routing Issues**
   - The `vercel.json` file includes rewrites for SPA routing
   - Ensure all routes redirect to `index.html`

### Local Testing

Test your build locally before deploying:

```bash
npm run build
npm run preview
```

This will build your project and serve it locally to test the production build.

## Domain Configuration

To use a custom domain:

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Performance Optimization

The Vercel configuration includes:
- Optimized build settings
- Minification enabled
- Source maps disabled for production
- Proper output directory configuration

## Security Notes

- Never commit `.env` files with real credentials
- Use Vercel's environment variables for sensitive data
- Ensure Supabase RLS (Row Level Security) is properly configured
