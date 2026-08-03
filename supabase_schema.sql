-- ═══════════════════════════════════════════════════════════════════
--  TEAM PROFILE HUB  –  Supabase Schema with Auth & Approval Workflow
--  Paste into: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS & POLICIES FOR PROFILE IMAGES
-- ══════════════════════════════════════════════════════════════════

-- Create avatars bucket for profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Storage Policy: Authenticated users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ══════════════════════════════════════════════════════════════════
-- DATABASE TABLES
-- ══════════════════════════════════════════════════════════════════

-- ── 1. PROFILES TABLE (Linked to auth.users) ─────────────────────────
DROP TABLE IF EXISTS profiles CASCADE;
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER', 'GUEST', 'PENDING')),
  avatar_url      TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  bio             TEXT DEFAULT '',
  email_verified  BOOLEAN DEFAULT FALSE,
  phone_verified  BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup (handles both email/password and OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      split_part(NEW.email, '@', 1)
    ),
    CASE 
      WHEN LOWER(NEW.email) = 'admin@teamprofilehub.com' THEN 'ADMIN'
      WHEN LOWER(NEW.email) = 'member@teamprofilehub.com' THEN 'MEMBER'
      WHEN LOWER(NEW.email) = 'chaturvediakarsh51@gmail.com' THEN 'ADMIN'
      WHEN LOWER(NEW.email) = 'akarsh.c@brudite.com' THEN 'MEMBER'
      ELSE 'PENDING'
    END,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. MEMBERS TABLE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS members CASCADE;
CREATE TABLE members (
  id                    BIGSERIAL PRIMARY KEY,
  name                  TEXT        NOT NULL,
  gmail                 TEXT        NOT NULL,
  phone                 TEXT        DEFAULT '',
  address               TEXT        DEFAULT '',
  age                   TEXT        DEFAULT '',
  education             TEXT        DEFAULT '',
  dl_name               TEXT        DEFAULT '',
  marriage_date         TEXT        DEFAULT '',
  property_owned        TEXT        DEFAULT '',
  ssn_last4             TEXT        DEFAULT '',

  -- Visa & Work
  visa_type             TEXT        DEFAULT '',
  work_authorization    TEXT        DEFAULT '',
  green_card_date       TEXT        DEFAULT '',
  green_card_how        TEXT        DEFAULT '',
  w2_c2c_preference     TEXT        DEFAULT '',

  -- Professional
  last_company          TEXT        DEFAULT '',
  total_experience      TEXT        DEFAULT '',
  total_companies       INTEGER     DEFAULT 0,
  last_project          TEXT        DEFAULT '',
  last_project_overview TEXT        DEFAULT '',
  tech_stack            TEXT        DEFAULT '',

  -- US History
  came_to_us_date       TEXT        DEFAULT '',
  first_five_years_how  TEXT        DEFAULT '',
  places_lived          TEXT        DEFAULT '',
  current_location      TEXT        DEFAULT '',

  -- Documents (Google Drive links)
  resume_link           TEXT        DEFAULT '',
  dl_link               TEXT        DEFAULT '',

  -- Social
  github                TEXT        DEFAULT '',
  linkedin              TEXT        DEFAULT '',
  portfolio             TEXT        DEFAULT '',

  -- References stored as JSON array
  references            JSONB       DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on members
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. PENDING CHANGES TABLE ──────────────────────────────────────────
DROP TABLE IF EXISTS pending_changes CASCADE;
CREATE TABLE pending_changes (
  id                 BIGSERIAL PRIMARY KEY,
  change_type        TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  target_member_id   BIGINT REFERENCES members(id) ON DELETE SET NULL,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_email TEXT DEFAULT '',
  submitted_at       TIMESTAMPTZ DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  admin_note         TEXT DEFAULT ''
);

-- ── 4. AUDIT LOG TABLE ────────────────────────────────────────────────
DROP TABLE IF EXISTS audit_log CASCADE;
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  action_type   TEXT NOT NULL,
  actor         TEXT NOT NULL,
  target_record TEXT DEFAULT '',
  before_value  JSONB DEFAULT NULL,
  after_value   JSONB DEFAULT NULL,
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. LOGIN HISTORY TABLE ────────────────────────────────────────────
DROP TABLE IF EXISTS login_history CASCADE;
CREATE TABLE login_history (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  login_method  TEXT DEFAULT 'email' CHECK (login_method IN ('email', 'google', 'github', 'apple')),
  ip_address    TEXT DEFAULT '',
  user_agent    TEXT DEFAULT '',
  device_info   TEXT DEFAULT '',
  location      TEXT DEFAULT '',
  success       BOOLEAN DEFAULT TRUE,
  failure_reason TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for login history queries
CREATE INDEX idx_login_history_user ON login_history (user_id, created_at DESC);
CREATE INDEX idx_login_history_timestamp ON login_history (created_at DESC);

-- ── 6. ACTIVE SESSIONS TABLE ──────────────────────────────────────────
DROP TABLE IF EXISTS active_sessions CASCADE;
CREATE TABLE active_sessions (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  ip_address    TEXT DEFAULT '',
  user_agent    TEXT DEFAULT '',
  device_info   TEXT DEFAULT '',
  location      TEXT DEFAULT '',
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

-- Index for active sessions queries
CREATE INDEX idx_active_sessions_user ON active_sessions (user_id, last_activity DESC);
CREATE INDEX idx_active_sessions_expires ON active_sessions (expires_at);

-- Auto-cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ── 7. ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles reading" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile name" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Members Policies (Open for read, backend/admin managed for mutations)
CREATE POLICY "Members public read" ON members FOR SELECT USING (true);
CREATE POLICY "Backend/Admin direct mutation" ON members FOR ALL USING (true) WITH CHECK (true);

-- Pending Changes Policies
CREATE POLICY "Read pending changes" ON pending_changes FOR SELECT USING (true);
CREATE POLICY "Insert pending change" ON pending_changes FOR INSERT WITH CHECK (true);
CREATE POLICY "Update pending change" ON pending_changes FOR UPDATE USING (true);

-- Audit Log Policies
CREATE POLICY "Read audit log" ON audit_log FOR SELECT USING (true);
CREATE POLICY "Insert audit log" ON audit_log FOR INSERT WITH CHECK (true);

-- Login History Policies
CREATE POLICY "Users can read own login history" ON login_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Backend can insert login history" ON login_history FOR INSERT WITH CHECK (true);

-- Active Sessions Policies
CREATE POLICY "Users can read own sessions" ON active_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Backend can manage sessions" ON active_sessions FOR ALL USING (true) WITH CHECK (true);

-- ── 8. INDEXES ────────────────────────────────────────────────────────
CREATE INDEX idx_members_name ON members (name);
CREATE INDEX idx_members_gmail ON members (gmail);
CREATE INDEX idx_pending_status ON pending_changes (status);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp DESC);

-- ── 9. SEED DATA FOR MEMBERS ──────────────────────────────────────────
INSERT INTO members (
  name, gmail, phone, address, age, education, dl_name, marriage_date,
  property_owned, ssn_last4, visa_type, work_authorization, green_card_date,
  green_card_how, w2_c2c_preference, last_company, total_experience,
  total_companies, last_project, last_project_overview, tech_stack,
  came_to_us_date, first_five_years_how, places_lived, current_location,
  resume_link, dl_link, github, linkedin, portfolio, references
) VALUES
(
  'Nirav Patel', 'Niravp1216@gmail.com', '601-488-2998',
  '905 Waters Edge, Brandon, Mississippi 39047', '29', 'B.E. in Computer Science',
  'Nirav Patel', 'Not provided', 'Not provided', '1806',
  'Citizenship (Naturalized)', 'U.S. Citizen', '2018', 'Employer-sponsored',
  'W2: $50–$85/hr, C2C: $50–$85/hr',
  'Centene Corporation', '10+ years', 3,
  'Healthcare Cloud Migration & AI Integration',
  'Led cloud migration projects and AI-driven workflows for healthcare claims and member management, ensuring HIPAA compliance and high availability.',
  'Python, AWS, Terraform, Docker, React, PostgreSQL',
  '2016', 'F1 → OPT → H1-B → Green Card',
  'Brandon, MS; previously in other US cities', 'Brandon, MS',
  '', '',
  'https://github.com/niravp1216-tech',
  'https://www.linkedin.com/in/coder-48ba46251/',
  'https://ubiquitous-starburst-4b7914.netlify.app/',
  '[{"name":"Vito Mantese","designation":"Team Lead","company":"Centene Corporation","email":"Not Available","phone":"+1 314-399-9771","linkedin":"linkedin.com/in/vito-mantese-3a7264140"},{"name":"Amol Basargekar","designation":"Group Product Manager","company":"IntegriChain","email":"amol.basargekar@gmail.com","phone":"+1 954-555-0636","linkedin":"linkedin.com/in/amol-basargekar-8b66aa8"},{"name":"Mrudula Vijayanarasimha","designation":"Sr. Software Engineer","company":"Centene Corporation","email":"mrudula.v1712@gmail.com","phone":"+1 585-406-2642","linkedin":"linkedin.com/in/mrudulavijayanarasimha/"}]'::jsonb
),
(
  'Dhaval Patel', 'dhavalkumawat76@gmail.com', '+1 (980)-215-9384',
  '116 Mackinac Drive, Mooresville, NC 28117', '33', 'B.E. in Computer Engineering',
  'Dhaval Patel', '2019', 'Not provided', '6747',
  'Citizenship (Naturalized)', 'U.S. Citizen', '2019', 'Marriage to U.S. citizen',
  'W2 preferred',
  'NBCUniversal', '8 years', 4,
  'AI-Powered Clinical Trial Platform',
  'Led development of cloud-native microservices and AI/LLM workflows for clinical data management, patient monitoring, and regulatory compliance.',
  'Python, FastAPI, AWS (Lambda, EKS, S3, DynamoDB), Terraform, Docker, LangChain, PyTorch, PostgreSQL, MongoDB, Redis',
  '2017', 'Marriage-based Green Card in 2019, Citizenship in 2025',
  'Mooresville, NC; previously in other US cities', 'Mooresville, NC',
  '', '',
  'https://github.com/niravp1216-tech',
  'https://www.linkedin.com/in/ai-expert-coder',
  'https://dhavalpatel.tech',
  '[]'::jsonb
),
(
  'Foram Patel', 'foram.patel4932@gmail.com', '(561) 342-1074',
  'Florida', '34', 'B.S./M.S. in Computer Science',
  'Foram Patel', 'Not provided', 'Not provided', 'N/A',
  'Citizenship', 'U.S. Citizen', 'Not provided', 'Not provided',
  'Not provided',
  'McKinsey & Company', '11+ years', 4,
  'AI-Driven Healthcare RCM Platform',
  'Architected agentic AI and ETL pipelines for healthcare Revenue Cycle Management, cutting claim resolution time from hours to minutes.',
  'Python, React, NestJS, FastAPI, Node.js, AWS, DynamoDB, Kubernetes, Terraform, LangChain, pgvector, Docker, Grafana',
  'Not provided', 'Not provided', 'Not provided', 'Florida',
  '', '',
  'https://github.com/foram-p',
  'https://www.linkedin.com/in/forampatel',
  'https://forampatel.dev',
  '[]'::jsonb
),
(
  'Rishabh Tiwari', 'Rishabhstiwari1996@gmail.com', 'Not provided',
  'Not provided', '0', 'B.Tech in Computer Science & Engineering, Rajasthan Technical University',
  'Rishabh Tiwari', 'Not provided', 'Not provided', 'N/A',
  'Not specified', 'Not specified', 'Not provided', 'Not provided',
  'Not provided',
  'WCG', '9+ years', 5,
  'AI-Powered Anomaly Detection & Remediation',
  'Architected secure multi-cloud infrastructure for an AI-powered anomaly detection platform using Terraform, deploying containerised microservices on AKS and OpenShift.',
  'AWS, Azure, GCP, Kubernetes, Helm, Terraform, Ansible, Jenkins, GitHub Actions, ArgoCD, Datadog, Prometheus, Grafana, ELK, Python, Bash, PostgreSQL',
  'Not provided', 'Not provided', 'Not provided', 'Not provided',
  '', '', '', '', '',
  '[]'::jsonb
),
(
  'Ritu', 'Not provided', 'Not provided',
  'Not provided', '0', 'Not specified',
  'Ritu', 'Not provided', 'Not provided', 'N/A',
  'Not specified', 'Not specified', 'Not provided', 'Not provided',
  'Not provided',
  'Centene', '10.5 years', 5,
  'AI Platform Management & API Gateway',
  'Leading development of enterprise and healthcare AI & Generative AI platforms, including a centralized API management platform.',
  'Python, Go, FastAPI, Flask, Django, AWS, GCP, Azure, Kubernetes, Docker, LangChain, FAISS, OpenSearch, Kafka, Airflow, Databricks, Snowflake',
  'Not provided', 'Not provided', 'Not provided', 'Not provided',
  '', '', '', '', '',
  '[]'::jsonb
),
(
  'Hridesh Sharma', 'Not provided', 'Not provided',
  'Not provided', '0', 'B.Tech in Computer Science',
  'Hridesh Sharma', 'Not provided', 'Not provided', 'N/A',
  'Not specified', 'Not specified', 'Not provided', 'Not provided',
  'Not provided',
  'Brudite Private Limited', '6+ years', 6,
  'AI-Powered Slack Workflow Automation',
  'Led design and development of custom Slack applications with OAuth 2.0, RBAC, interactive components, and AI-powered workflows integrating GPT-4 and Claude via LangChain and MCP servers.',
  'Python, Node.js, Go, FastAPI, Slack Bolt SDK, OAuth 2.0, LangChain, GPT-4, Claude, RAG, Vector DB, PostgreSQL, MongoDB, AWS, GCP, Terraform',
  'Not provided', 'Not provided', 'Not provided', 'Not provided',
  '', '', '', '', '',
  '[]'::jsonb
);
