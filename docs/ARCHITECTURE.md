# Architecture

## Overview

The NPS Insights Tool follows a modern, scalable architecture with clear separation of concerns:

```
CSV/XLSX → Supabase → AI Enrichment → Dashboards → PDF/Share
```

## System Components

### 1. Frontend (Next.js 14)
- **Framework**: Next.js with App Router
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with dark mode support
- **State Management**: React hooks and context
- **Data Fetching**: Direct Supabase client calls

### 2. Backend (FastAPI)
- **Framework**: FastAPI with async/await support
- **API Documentation**: Automatic OpenAPI/Swagger docs
- **Data Processing**: Pandas for CSV processing
- **AI Integration**: OpenAI GPT-3.5-turbo for text analysis
- **CORS**: Configured for frontend communication

### 3. Database (Supabase/PostgreSQL)
- **Primary Database**: PostgreSQL via Supabase
- **Features**: Row Level Security (RLS), real-time subscriptions
- **Schema**: Normalized design with proper relationships
- **Views**: Pre-computed aggregations for performance

### 4. AI Services (OpenAI)
- **Model**: GPT-3.5-turbo for text analysis
- **Features**: Theme extraction, sentiment analysis, keyword identification
- **Processing**: Async background processing for scalability

## Data Flow

### 1. Data Ingestion
```
CSV Upload → FastAPI → Pandas Processing → Supabase Storage
```

### 2. Data Processing
```
Raw Data → Validation → Categorization → AI Enrichment → Processed Data
```

### 3. Dashboard Rendering
```
Supabase Query → Frontend Components → Real-time Updates
```

## Security

### Authentication & Authorization
- **Row Level Security**: Database-level access control
- **Role-based Access**: Admin, Analyst, Processor, Public roles
- **API Security**: CORS configuration and input validation

### Data Protection
- **Environment Variables**: Sensitive data in environment files
- **Input Validation**: Pydantic models for data validation
- **SQL Injection**: Parameterized queries via Supabase client

## Scalability Considerations

### Performance
- **Database Indexes**: Optimized for common query patterns
- **Caching**: Supabase built-in caching
- **Async Processing**: Non-blocking AI enrichment

### Monitoring
- **Health Checks**: API health endpoints
- **Error Handling**: Comprehensive error responses
- **Logging**: Structured logging for debugging

## Deployment Architecture

### Development
- **Frontend**: Next.js dev server (localhost:3000)
- **Backend**: Uvicorn dev server (localhost:8000)
- **Database**: Supabase cloud instance

### Production (Recommended)
- **Frontend**: Vercel or similar static hosting
- **Backend**: Railway, Render, or containerized deployment
- **Database**: Supabase production instance
- **CDN**: For static assets and API caching
