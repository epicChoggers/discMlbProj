# Testing Discord OAuth Integration

## Steps to Test Discord OAuth

1. **Run the Complete Setup Script**
   - Execute `supabase-complete-setup.sql` in your Supabase SQL Editor
   - This will create the necessary tables, triggers, and functions

2. **Test Discord Login**
   - Go to your app and click "Sign in with Discord"
   - Complete the Discord OAuth flow
   - Check if you're redirected back to the app

3. **Verify User Profile Creation**
   - After logging in, check the `user_profiles` table in Supabase
   - You should see a new row with your Discord username and avatar URL
   - The `discord_id` should match your Discord user ID

4. **Test Leaderboard Display**
   - Make a prediction (if there's an active game)
   - Check the leaderboard - it should now show your Discord username and avatar
   - Instead of "Unknown User", you should see your actual Discord username

## Troubleshooting

### If you still see "Unknown User":
1. Check the browser console for any error messages
2. Verify that the `handle_new_user` function was created successfully
3. Check if the trigger `on_auth_user_created` exists on the `auth.users` table
4. Look at the `raw_user_meta_data` column in `auth.users` to see what Discord data is available

### If the avatar doesn't show:
1. Check if the `avatar_url` field in `user_profiles` is populated
2. Discord avatar URLs might need to be formatted differently
3. Some Discord users might not have avatars set

### If the trigger isn't working:
1. Manually run the `handle_new_user` function for existing users:
   ```sql
   SELECT public.handle_new_user() FROM auth.users WHERE id = 'your-user-id';
   ```
2. Or manually insert the profile:
   ```sql
   INSERT INTO user_profiles (id, discord_id, username, avatar_url)
   VALUES (
     'your-user-id',
     'your-discord-id',
     'Your Discord Username',
     'https://cdn.discordapp.com/avatars/...'
   );
   ```

## Expected Discord OAuth Data Structure

When a user signs in with Discord, Supabase stores the following in `raw_user_meta_data`:
- `sub`: Discord user ID
- `full_name`: Discord display name
- `preferred_username`: Discord username
- `name`: Discord username (fallback)
- `avatar_url`: Discord avatar URL
- `provider`: "discord"
