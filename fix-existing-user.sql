-- Fix Existing User Profile
-- Run this to manually create a profile for the existing user

-- First, let's see what Discord data is available for this user
SELECT 
    id,
    email,
    raw_user_meta_data->>'sub' as discord_id,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'preferred_username' as preferred_username,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'avatar_url' as avatar_url,
    raw_user_meta_data->>'provider' as provider
FROM auth.users 
WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b';

-- If the above query shows Discord data, run this to create the profile:
INSERT INTO user_profiles (id, discord_id, username, avatar_url)
SELECT 
    'bf30a59c-92b4-42bc-ad4a-574770bc730b',
    raw_user_meta_data->>'sub',
    COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'preferred_username', 
        raw_user_meta_data->>'name',
        'Unknown User'
    ),
    raw_user_meta_data->>'avatar_url'
FROM auth.users 
WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b'
AND raw_user_meta_data->>'provider' = 'discord'
ON CONFLICT (id) DO UPDATE SET
    discord_id = EXCLUDED.discord_id,
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

-- If the user is NOT a Discord user (provider != 'discord'), create a basic profile:
INSERT INTO user_profiles (id, discord_id, username, avatar_url)
SELECT 
    'bf30a59c-92b4-42bc-ad4a-574770bc730b',
    NULL,
    COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'preferred_username', 
        raw_user_meta_data->>'name',
        email,
        'Unknown User'
    ),
    raw_user_meta_data->>'avatar_url'
FROM auth.users 
WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b'
AND raw_user_meta_data->>'provider' != 'discord'
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
