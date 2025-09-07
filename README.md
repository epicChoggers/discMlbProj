
## Features

- 🔐 **Password Authentication**: Simple shared password gate using Supabase Auth
- ⚡ **Real-time Messaging**: Instant message updates across all connected clients
- 🎨 **Dark Theme UI**: Clean, modern interface with Tailwind CSS
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ✨ **Optimistic UI**: Messages appear instantly with rollback on errors
- 🔒 **Row Level Security**: Secure database access with Supabase RLS

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS (dark theme)
- **Backend**: Supabase (Auth + Realtime + PostgREST)
- **Deployment**: Static hosting (Vercel/Netlify/Cloudflare Pages)

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key from Settings → API

### 2. Set Up Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable extension for gen_random_uuid (if not already)
create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text,
  text text not null
);

alter table public.messages enable row level security;

-- Authenticated users can read everything
create policy "messages_select_auth"
on public.messages for select
to authenticated
using (true);

-- Authenticated users can insert
create policy "messages_insert_auth"
on public.messages for insert
to authenticated
with check (true);

-- Optional: prevent updates/deletes
revoke update, delete on public.messages from authenticated;
```

### 3. Enable Realtime

1. Go to Database → Replication in your Supabase dashboard
2. Enable Realtime for the `public` schema or specifically for the `messages` table

### 4. Create Shared User

1. Go to Authentication → Users in your Supabase dashboard
2. Add a new user with:
   - Email: `site@mydomain.com` (or your chosen shared email)
   - Password: Choose a strong password (this will be your site password)

### 5. Environment Setup

1. Copy `env.example` to `.env.local`:
   ```bash
   cp env.example .env.local
   ```

2. Fill in your environment variables:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_SHARED_EMAIL=site@mydomain.com
   ```

### 6. Install and Run

```bash
# Install dependencies
npm install
# or
pnpm install
# or
yarn install

# Start development server
npm run dev
# or
pnpm dev
# or
yarn dev
```

Visit `http://localhost:3000` and enter your shared password to access the text wall.

## Deployment

### Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SHARED_EMAIL`
4. Deploy

### Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Add environment variables in Netlify dashboard
4. Deploy

### Cloudflare Pages

1. Push your code to GitHub
2. Connect your repository to Cloudflare Pages
3. Add environment variables in Cloudflare dashboard
4. Deploy

## Project Structure

```
src/
├── components/
│   ├── LockScreen.tsx      # Password authentication
│   ├── TextWall.tsx        # Main text wall interface
│   ├── MessageBubble.tsx   # Individual message display
│   └── Composer.tsx        # Message input form
├── lib/
│   ├── useRealtimeMessages.ts  # Realtime messaging hook
│   ├── types.ts            # TypeScript type definitions
│   └── validators.ts       # Input validation utilities
├── styles/
│   └── index.css           # Global styles and Tailwind imports
├── App.tsx                 # Main app component
├── main.tsx               # React entry point
└── supabaseClient.ts      # Supabase client configuration
```

## Security Considerations

### Current Implementation (Shared Account)

- Uses a single shared email/password for all users
- Password is entered by users at runtime (not hardcoded)
- Suitable for small, trusted groups

### Migration to Per-User Auth

To upgrade to individual user accounts:

1. **Update Database Schema**:
   ```sql
   -- Add user reference to messages
   alter table public.messages add column user_id uuid references auth.users(id);
   
   -- Update RLS policies
   drop policy "messages_select_auth" on public.messages;
   drop policy "messages_insert_auth" on public.messages;
   
   create policy "messages_select_user"
   on public.messages for select
   to authenticated
   using (true);
   
   create policy "messages_insert_user"
   on public.messages for insert
   to authenticated
   with check (auth.uid() = user_id);
   ```

2. **Update Components**:
   - Replace `LockScreen` with Supabase Auth UI
   - Add user registration/login flow
   - Include `user_id` when inserting messages
   - Display user names from auth.users

3. **Add User Management**:
   - User profiles and avatars
   - Message attribution to specific users
   - Optional: user roles and permissions

## Features

### Real-time Updates
- Messages appear instantly across all connected clients
- Optimistic UI with error rollback
- Connection status indicators

### Input Validation
- 500 character message limit
- Required field validation
- Input sanitization

### User Experience
- Auto-scroll to new messages
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Loading states and error handling
- Responsive mobile design

### Accessibility
- Proper form labels and ARIA attributes
- Keyboard navigation support
- High contrast dark theme
- Screen reader friendly

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Yes |
| `VITE_SHARED_EMAIL` | Shared email for authentication | Yes |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
