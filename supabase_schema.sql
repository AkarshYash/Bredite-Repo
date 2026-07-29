-- ═══════════════════════════════════════════════════════════════════
--  TEAM PROFILE HUB  –  Supabase Schema
--  Paste this into: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID extension (already enabled on Supabase by default)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drop table if re-running ─────────────────────────────────────────
DROP TABLE IF EXISTS members CASCADE;

-- ── Create members table ─────────────────────────────────────────────
CREATE TABLE members (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT        NOT NULL,
  gmail                TEXT        NOT NULL,
  phone                TEXT        DEFAULT '',
  address              TEXT        DEFAULT '',
  age                  TEXT        DEFAULT '',
  education            TEXT        DEFAULT '',
  dl_name              TEXT        DEFAULT '',
  marriage_date        TEXT        DEFAULT '',
  property_owned       TEXT        DEFAULT '',
  ssn_last4            TEXT        DEFAULT '',

  -- Visa & Work
  visa_type            TEXT        DEFAULT '',
  work_authorization   TEXT        DEFAULT '',
  green_card_date      TEXT        DEFAULT '',
  green_card_how       TEXT        DEFAULT '',
  w2_c2c_preference    TEXT        DEFAULT '',

  -- Professional
  last_company         TEXT        DEFAULT '',
  total_experience     TEXT        DEFAULT '',
  total_companies      INTEGER     DEFAULT 0,
  last_project         TEXT        DEFAULT '',
  last_project_overview TEXT       DEFAULT '',
  tech_stack           TEXT        DEFAULT '',

  -- US History
  came_to_us_date      TEXT        DEFAULT '',
  first_five_years_how TEXT        DEFAULT '',
  places_lived         TEXT        DEFAULT '',
  current_location     TEXT        DEFAULT '',

  -- Documents (Google Drive links)
  resume_link          TEXT        DEFAULT '',
  dl_link              TEXT        DEFAULT '',

  -- Social
  github               TEXT        DEFAULT '',
  linkedin             TEXT        DEFAULT '',
  portfolio            TEXT        DEFAULT '',

  -- References stored as JSON array
  references           JSONB       DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto-update updated_at on every row change ────────────────────────
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

-- ── Row Level Security (RLS) ──────────────────────────────────────────
-- Using anon key with RLS policies so the API is the gatekeeper.
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Allow all operations from the service/anon key (backend controls access)
CREATE POLICY "allow_all" ON members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────
CREATE INDEX idx_members_name  ON members (name);
CREATE INDEX idx_members_gmail ON members (gmail);

-- ── Seed data ─────────────────────────────────────────────────────────
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
