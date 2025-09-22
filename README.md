# NPS Insights Tool

A comprehensive Net Promoter Score (NPS) analysis and insights platform built with Next.js, FastAPI, and Supabase.

## 🚀 Features

- **Data Ingestion**: Upload CSV/XLSX files with NPS survey data
- **AI Enrichment**: Automatic theme extraction, sentiment analysis, and keyword identification using OpenAI
- **Interactive Dashboard**: Real-time NPS metrics, trends, and visualizations
- **Segmentation**: Analyze NPS by demographics and other criteria
- **Theme Analysis**: Identify common themes and patterns in responses
- **Export & Sharing**: Generate reports and export data

## 🏗️ Architecture

```
CSV/XLSX → Supabase → AI Enrichment → Dashboard → PDF/Share
```

- **Frontend**: Next.js 14 with shadcn/ui components
- **Backend**: FastAPI with async processing
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-3.5-turbo for text analysis
- **Styling**: Tailwind CSS with dark mode support

## 📁 Project Structure

```
nps-starter/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # App router pages
│   ├── components/          # React components
│   ├── lib/                 # Utilities and helpers
│   └── hooks/               # Custom React hooks
├── backend/                 # FastAPI backend
│   ├── main.py             # Main API application
│   └── requirements.txt    # Python dependencies
├── sql/                    # Database schema and migrations
│   ├── 001_init.sql        # Initial database setup
│   ├── 002_views.sql       # Database views
│   └── 003_security.sql    # Row Level Security
├── docs/                   # Documentation
└── seeds/                  # Sample data
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Supabase account
- OpenAI API key

### 1. Database Setup

1. Create a new Supabase project
2. Run the SQL files in order:
   ```sql
   -- Run these in your Supabase SQL editor
   \i sql/001_init.sql
   \i sql/002_views.sql
   \i sql/003_security.sql
   ```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Create .env file with your credentials
cp .env.example .env
# Edit .env with your Supabase and OpenAI credentials

# Run the backend
uvicorn main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Create .env.local file
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run the frontend
npm run dev
```

### 4. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 📊 Data Format

The tool expects CSV files with the following columns:

| Column | Description | Required |
|--------|-------------|----------|
| SURVEY | Survey name | Yes |
| NPS | NPS score (0-10) | Yes |
| NPS_TOELICHTING | Explanation text | No |
| GESLACHT | Gender | No |
| LEEFTIJD | Age range | No |
| ABOJAREN | Years employed | No |
| CREATIE_DT | Creation date | No |
| TITEL_TEKST | Title/position | No |

## 🔧 Configuration

### Environment Variables

See [docs/ENV.md](docs/ENV.md) for detailed environment variable configuration.

### Database Schema

See [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for the complete data model.

## 📈 Usage

1. **Upload Data**: Use the "Upload Data" button to import CSV files
2. **View Dashboard**: Monitor key NPS metrics and trends
3. **Analyze Segments**: Explore NPS by demographics
4. **Review Themes**: See AI-extracted themes and sentiment
5. **Export Reports**: Generate and share insights

## 🛠️ Development

### Adding New Features

1. **Backend**: Add new endpoints in `backend/main.py`
2. **Frontend**: Create components in `frontend/components/`
3. **Database**: Add migrations in `sql/` directory

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Dashboard Design](docs/DASHBOARD_DESIGN.md)
- [API Documentation](http://localhost:8000/docs)
- [Style Guide](docs/STYLEGUIDE.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in the `docs/` folder
- Review the API documentation at `/docs`
- Open an issue for bugs or feature requests
