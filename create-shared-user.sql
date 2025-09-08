-- Create the shared email user for authentication
-- Replace 'your-shared-email@domain.com' with your actual shared email
-- Replace 'your-password' with your desired password

-- Note: This creates a user in the auth.users table
-- You'll need to run this in your Supabase SQL editor

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'your-shared-email@domain.com', -- Replace with your VITE_SHARED_EMAIL
    crypt('your-password', gen_salt('bf')), -- Replace with your desired password
    NOW(),
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Also create a corresponding user profile
INSERT INTO user_profiles (
    user_id,
    username,
    email,
    raw_user_meta_data
) 
SELECT 
    u.id,
    'Shared User',
    u.email,
    '{}'
FROM auth.users u 
WHERE u.email = 'your-shared-email@domain.com' -- Replace with your VITE_SHARED_EMAIL
ON CONFLICT (user_id) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Shared user created successfully!';
    RAISE NOTICE 'Email: your-shared-email@domain.com';
    RAISE NOTICE 'Password: your-password';
    RAISE NOTICE 'Remember to update the password in your environment variables if needed.';
END $$;
