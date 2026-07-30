# Team Profile Hub – US IT Consultants Manager

A full-stack web application for managing US IT consultant profiles with comprehensive CRUD operations, search functionality, and cloud document integration.

## 🚀 Features

- **Complete Profile Management**: Add, edit, view, and delete consultant profiles
- **Advanced Search**: Real-time search across names, companies, visa types, locations, and tech stacks
- **Rich Data Fields**: Personal info, visa/work authorization, professional history, US immigration timeline, references
- **Google Drive Integration**: Store and link resumes and driver's licenses via shareable Drive URLs
- **Statistics Dashboard**: Live stats showing total members, visa types, document availability
- **Dark/Light Theme**: User preference with localStorage persistence
- **Responsive Design**: Mobile-first, works seamlessly on all devices
- **Offline Support**: Automatic fallback to localStorage when backend is unavailable
- **Professional UI**: Modern glassmorphism design with smooth animations

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3 (Custom Properties), Vanilla JavaScript
- Bootstrap 5.3.2 (UI components)
- Bootstrap Icons 1.11.3

**Backend:**
- Node.js + Express.js
- Supabase (PostgreSQL) for production database
- In-memory fallback for local development
- CORS, Helmet, Rate Limiting security middleware

**Deployment:**
- Vercel (frontend + serverless functions)
- Supabase (managed PostgreSQL database)

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Git
- Supabase account (free tier)

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your Supabase credentials
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
# FRONTEND_URL=http://localhost:3001
# PORT=3001

# Run backend server
npm run dev
```

### Frontend Setup

The frontend is static HTML/CSS/JS. Just open `frontend/index.html` in a browser or serve via the backend.

When the backend runs on port 3001, it automatically serves the frontend at `http://localhost:3001/`

## 🚢 Deployment

See **[DEPLOY.md](./DEPLOY.md)** for detailed deployment instructions including:
- Setting up Supabase database
- Configuring environment variables
- Deploying to Vercel
- Testing the live application

## 📁 Project Structure

```
US-data-store-grid/
├── frontend/
│   ├── index.html          # Main application UI
│   ├── app.js              # Frontend logic (API calls, rendering)
│   └── style.css           # Complete styling with theme support
├── backend/
│   ├── server.js           # Express server entry point
│   ├── supabase.js         # Supabase client configuration
│   ├── defaultData.js      # Seed data for 6 default members
│   ├── routes/
│   │   └── members.js      # REST API endpoints (CRUD)
│   ├── package.json        # Backend dependencies
│   ├── .env.example        # Environment template
│   └── .gitignore          # Backend ignore rules
├── supabase_schema.sql     # Database schema + seed data
├── vercel.json             # Vercel deployment config
├── package.json            # Root package for scripts
├── DEPLOY.md               # Deployment guide
├── .gitignore              # Project-wide ignore rules
└── README.md               # This file
```

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/members` | Get all members |
| GET | `/api/members/:id` | Get single member by ID |
| POST | `/api/members` | Create new member |
| PUT | `/api/members/:id` | Update member by ID |
| DELETE | `/api/members/:id` | Delete member by ID |
| GET | `/api/health` | Health check endpoint |

## 🎨 Screenshots

- Modern card-based grid layout
- Detailed profile panel with tabbed navigation
- Inline edit/delete controls on cards
- Comprehensive modal forms for add/edit
- Stats bar with live counts
- Theme toggle (light/dark)

## 👥 Default Members

The application comes pre-seeded with 6 consultant profiles:
1. Nirav Patel – Python/AWS/Cloud architect
2. Dhaval Patel – AI/ML engineer
3. Foram Patel – Healthcare RCM specialist
4. Rishabh Tiwari – DevOps/Multi-cloud expert
5. Ritu – AI Platform architect
6. Hridesh Sharma – Slack/Integration specialist

## 🔐 Security Features

- Helmet.js for security headers
- CORS with origin whitelisting
- Rate limiting (200 requests per 15 minutes)
- Input sanitization and validation
- Row-level security (RLS) in Supabase
- Environment variable protection

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📧 Contact

For questions or support, please open an issue in the repository.

---

**Built with ❤️ for managing US IT consultant teams**