# 🚀 Quick Setup Guide

## Your Supabase Credentials
I've configured your environment files with your Supabase credentials:

- **Project URL**: https://zkmmupwcieyvqtyiiotb.supabase.co
- **Anon Key**: Configured in both frontend and backend
- **Service Role Key**: Configured in backend

## Step 1: Set Up Database Schema

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Open SQL Editor** in your project
3. **Copy and paste** the entire contents of `setup-database.sql`
4. **Run the script** - this will create all tables, views, functions, and sample data

## Step 2: Set Up Environment Files

### Backend Environment
```bash
# Copy the example file
cp backend/env.example backend/.env

# Edit with your OpenAI API key
# Add your OpenAI API key to the OPENAI_API_KEY field
```

### Frontend Environment
```bash
# Copy the example file  
cp frontend/env.local.example frontend/.env.local

# The Supabase credentials are already configured!
```

## Step 3: Install Dependencies

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Step 4: Start the Application

### Terminal 1 - Backend
```bash
cd backend
uvicorn main:app --reload
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

## Step 5: Access Your Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Step 6: Test with Sample Data

The database setup includes your sample data from the CSV:
- Survey: "LLT_Nieuws"
- NPS Score: 9 (Promoter)
- Explanation: "Goede krant"

You should see this data in your dashboard!

## Next Steps

1. **Get OpenAI API Key**: https://platform.openai.com/api-keys
2. **Upload More Data**: Use the upload button in the dashboard
3. **Explore Features**: Check out the different dashboard sections

## Troubleshooting

### Database Issues
- Make sure you ran the complete `setup-database.sql` script
- Check the Supabase logs for any errors

### API Issues
- Verify your OpenAI API key is set correctly
- Check the backend logs for error messages

### Frontend Issues
- Make sure the backend is running on port 8000
- Check browser console for any errors

## Need Help?

- Check the main README.md for detailed documentation
- Review the API docs at http://localhost:8000/docs
- Check the individual documentation files in the `docs/` folder
