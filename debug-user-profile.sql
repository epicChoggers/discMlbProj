-- Debug User Profile Issues
-- Run these queries in Supabase SQL Editor to diagnose the problem

-- 1. Check if the user exists in auth.users
SELECT 
    id,
    email,
    raw_user_meta_data,
    created_at,
    updated_at
FROM auth.users 
WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b';

-- 2. Check if the user has a profile
SELECT * FROM user_profiles 
WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b';

-- 3. Check if the trigger function exists
SELECT 
    routine_name, 
    routine_type, 
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- 4. Check if the triggers exist
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing, 
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table = 'users';

-- 5. Check RLS policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- 6. Manually create profile for this user (if Discord OAuth data exists)
-- First check what Discord data is available:
SELECT 
    id,
    raw_user_meta_data->>'sub' as discord_id,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'preferred_username' as preferred_username,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'avatar_url' as avatar_url,
    raw_user_meta_data->>'provider' as provider
FROM auth.users 
WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b';

-- 7. If Discord data exists, manually create the profile:
-- INSERT INTO user_profiles (id, discord_id, username, avatar_url)
-- VALUES (
--     'bf30a59c-92b4-42bc-ad4a-574770bc730b',
--     (SELECT raw_user_meta_data->>'sub' FROM auth.users WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b'),
--     COALESCE(
--         (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b'),
--         (SELECT raw_user_meta_data->>'preferred_username' FROM auth.users WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b'),
--         (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b'),
--         'Unknown User'
--     ),
--     (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = 'bf30a59c-92b4-42bc-ad4a-574770bc730b')
-- );
