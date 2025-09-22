# Environment Variables

This document describes the environment variables needed for the NPS Insights Tool.

## Frontend (.env.local)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Backend (.env)

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration (if using direct connection)
DATABASE_URL=postgresql://user:password@host:port/database

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
```

## Setup Instructions

1. **Supabase Setup:**
   - Create a new Supabase project
   - Go to Settings > API to get your URL and anon key
   - Run the SQL files in the `sql/` directory to set up the database schema

2. **OpenAI Setup:**
   - Get an API key from https://platform.openai.com/api-keys
   - Add it to your backend `.env` file

3. **Environment Files:**
   - Copy `.env.example` to `.env` in the backend directory
   - Copy `.env.local.example` to `.env.local` in the frontend directory
   - Fill in your actual values

## Security Notes

- Never commit `.env` files to version control
- Use different keys for development and production
- Rotate API keys regularly
- Consider using environment-specific configurations
