# Mariners Predictions App Setup

This app allows users to make live predictions on Seattle Mariners at-bat outcomes using Discord authentication and displays a leaderboard of top predictors.

## Features

- **Discord Authentication**: Users can log in with their Discord account
- **Live Game Data**: Real-time Mariners game information from MLB API
- **At-Bat Predictions**: Users can predict the outcome of each at-bat
- **Leaderboard**: Shows top predictors with accuracy and streak stats
- **Real-time Updates**: Live updates for game state and prediction results
- **Chat System**: Users can chat while watching the game

## Setup Instructions

### 1. Supabase Configuration

#### Enable Discord OAuth Provider
1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers
3. Enable Discord provider
4. Add your Discord application credentials:
   - Client ID
   - Client Secret
5. Set redirect URL to: `https://your-domain.com/auth/callback`

#### Database Schema
Create the following tables in your Supabase database:

```sql
-- User profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- At-bat predictions table
CREATE TABLE at_bat_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  game_pk INTEGER NOT NULL,
  at_bat_index INTEGER NOT NULL,
  prediction TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 1 AND confidence <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  actual_outcome TEXT,
  is_correct BOOLEAN,
  UNIQUE(user_id, game_pk, at_bat_index)
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE at_bat_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for at_bat_predictions
CREATE POLICY "Users can view all predictions" ON at_bat_predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own predictions" ON at_bat_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own predictions" ON at_bat_predictions FOR UPDATE USING (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, discord_id, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'sub',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'preferred_username', 'Unknown'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### 2. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 settings
4. Add redirect URI: `https://your-supabase-project.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret to Supabase

### 3. Environment Variables

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SHARED_EMAIL=your_shared_email_for_password_auth
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

## Usage

1. **Authentication**: Users can either:
   - Use the shared password (existing functionality)
   - Log in with Discord (new feature)

2. **Making Predictions**: 
   - Only available during live Mariners games
   - Users select an outcome (single, double, home run, etc.)
   - Set confidence level (1-10)
   - Submit prediction

3. **Leaderboard**:
   - Shows top predictors by accuracy
   - Displays current streak and best streak
   - Updates in real-time

4. **Chat**: 
   - Users can chat while watching the game
   - Real-time messaging with Supabase

## API Endpoints

The app uses the MLB Stats API:
- Base URL: `https://statsapi.mlb.com/api/v1`
- Mariners Team ID: `112`
- Updates every 10 seconds during live games

## Real-time Features

- Game state updates every 10 seconds
- Prediction results update immediately
- Leaderboard updates when new predictions are made
- Chat messages appear instantly

## Styling

The app uses Tailwind CSS with a dark theme:
- Gray-900 background
- Blue accent colors
- Discord brand colors for Discord login
- Responsive design for mobile and desktop

