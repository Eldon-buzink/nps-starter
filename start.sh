#!/bin/bash

# NPS Insights Tool Startup Script
# This script helps you get started with the NPS tool

echo "🚀 NPS Insights Tool Setup"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo "❌ Please run this script from the nps-starter directory"
    exit 1
fi

echo "📋 Prerequisites Check"
echo "----------------------"

# Check for Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js $(node --version) found"
else
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check for Python
if command -v python3 &> /dev/null; then
    echo "✅ Python $(python3 --version) found"
else
    echo "❌ Python 3 not found. Please install Python 3.8+ from https://python.org"
    exit 1
fi

# Check for pip
if command -v pip3 &> /dev/null; then
    echo "✅ pip3 found"
else
    echo "❌ pip3 not found. Please install pip"
    exit 1
fi

echo ""
echo "🔧 Environment Setup"
echo "--------------------"

# Create environment files if they don't exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend/.env file..."
    cat > backend/.env << EOF
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
EOF
    echo "⚠️  Please edit backend/.env with your actual credentials"
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "📝 Creating frontend/.env.local file..."
    cat > frontend/.env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
    echo "⚠️  Please edit frontend/.env.local with your actual credentials"
fi

echo ""
echo "📦 Installing Dependencies"
echo "--------------------------"

# Install backend dependencies
echo "Installing Python dependencies..."
cd backend
pip3 install -r requirements.txt
cd ..

# Install frontend dependencies
echo "Installing Node.js dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "🗄️  Database Setup"
echo "------------------"
echo "📋 Next steps for database setup:"
echo "1. Create a Supabase project at https://supabase.com"
echo "2. Go to Settings > API to get your URL and anon key"
echo "3. Run the SQL files in the sql/ directory:"
echo "   - sql/001_init.sql"
echo "   - sql/002_views.sql" 
echo "   - sql/003_security.sql"
echo "4. Update your .env files with the Supabase credentials"

echo ""
echo "🤖 AI Setup"
echo "-----------"
echo "📋 Next steps for AI setup:"
echo "1. Get an OpenAI API key from https://platform.openai.com/api-keys"
echo "2. Add it to backend/.env file"

echo ""
echo "🚀 Starting the Application"
echo "---------------------------"
echo "To start the application:"
echo ""
echo "1. Start the backend:"
echo "   cd backend && uvicorn main:app --reload"
echo ""
echo "2. Start the frontend (in a new terminal):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"

echo ""
echo "✅ Setup complete! Follow the instructions above to get started."
echo "📚 For more information, see the README.md file."
