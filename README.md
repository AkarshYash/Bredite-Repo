# Team Profile Hub

A full-stack web application for managing US IT Consultants profiles with role-based access control, authentication, and approval workflows.

## 🚀 Features

- **Member Management**: Create, read, update, and delete consultant profiles
- **Role-Based Access Control**: Admin and Member roles with different permissions
- **Approval Workflow**: Members can submit changes that require Admin approval
- **Authentication**: Secure login with Google OAuth, Apple Sign-In, and email/password
- **Audit Log**: Track all actions and changes (Admin only)
- **User Management**: Approve new user registrations and manage roles (Admin only)
- **Responsive Design**: Modern UI with dark/light theme toggle
- **Search & Filter**: Quick search across member profiles

## 📁 Project Structure

```
├── backend/                    # Node.js/Express API server
│   ├── routes/                 # API route handlers
│   │   ├── auth.js            # Authentication endpoints
│   │   ├── members.js         # Member CRUD operations
│   │   ├── pending.js         # Approval workflow
│   │   ├── audit.js           # Activity logging
│   │   ├── users.js           # User management
│   │   ├── profile.js         # Profile operations
│   │   ├── otp.js             # OTP functionality
│   │   └── security.js        # Security settings
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── server.js              # Express server setup
│   ├── supabase.js            # Supabase client configuration
│   ├── store.js               # In-memory data store (demo mode)
│   ├── defaultData.js         # Sample data for demo
│   ├── .env.example           # Environment variables template
│   └── package.json           # Backend dependencies
│
├── frontend/                   # Static frontend files
│   ├── index.html             # Main application page
│   ├── app.js                 # Main application logic
│   ├── auth.html              # Authentication page
│   ├── auth.js                # Auth handling
│   ├── auth-callback.html     # OAuth callback handler
│   ├── profile.html           # Profile detail page
│   ├── profile.js             # Profile logic
│   ├── config.js              # Frontend configuration
│   ├── style.css              # Main styles
│   ├── auth.css               # Auth page styles
│   └── profile.css            # Profile page styles
│
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## 🛠️ Technology Stack

### Backend
- **Node.js** & **Express** - Server framework
- **Supabase** - Database and authentication (optional)
- **JWT** - Token-based authentication
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - API rate limiting

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Bootstrap 5** - UI components
- **Supabase JS Client** - Auth integration
- **Bootstrap Icons** - Icon library

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/AkarshYash/Bredite-Repo.git
   cd Bredite-Repo
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (optional - leave empty for demo mode)
   - `PORT` (default: 3001)
   - `FRONTEND_URL` (for CORS)

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open your browser and navigate to: `http://localhost:3001`

## 🔐 Demo Mode

The application runs in **demo mode** with in-memory data when Supabase credentials are not configured. Demo accounts:

- **Admin**: `admin@demo.com` / `admin123` (full access)
- **Member**: `member@demo.com` / `member123` (view & submit proposals)

## 🗄️ Database Setup (Optional)

For production with Supabase:

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key to `.env`
4. Run the database schema (see Supabase dashboard)

## 🚀 Deployment

The application is configured to run as a single server that serves both API and frontend:

- Backend serves API routes at `/api/*`
- Backend serves frontend static files from the root
- Single deployment, single port

## 📝 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/session` - Get current session

### Members
- `GET /api/members` - List all members
- `POST /api/members` - Create member (Admin) or submit proposal (Member)
- `PUT /api/members/:id` - Update member (Admin) or submit proposal (Member)
- `DELETE /api/members/:id` - Delete member (Admin only)

### Pending Changes
- `GET /api/pending-changes` - List pending proposals
- `POST /api/pending-changes/:id/approve` - Approve (Admin only)
- `POST /api/pending-changes/:id/reject` - Reject (Admin only)

### Audit Log
- `GET /api/audit-log` - View activity log (Admin only)

### Users
- `GET /api/users` - List all users (Admin only)
- `PUT /api/users/:id/role` - Update user role (Admin only)
- `PUT /api/users/:id/approve` - Approve user registration (Admin only)

## 🔒 Security Features

- JWT-based authentication
- Password hashing (via Supabase Auth or bcrypt)
- Rate limiting on API endpoints
- CSRF protection
- Helmet security headers
- Input validation and sanitization

## 🎨 User Roles

### Admin
- Full CRUD access to member profiles
- Approve/reject pending changes
- View audit logs
- Manage user roles and approvals

### Member
- View all member profiles
- Submit change proposals (requires approval)
- Cannot directly edit or delete

### Pending User
- Limited access until Admin approval
- Can view own profile only

## 📄 License

Private project - All rights reserved

## 👥 Authors

- Akarsh Chaturvedi
- Nirav Patel

## 🤝 Contributing

This is a private internal tool. For access or questions, contact the development team.
