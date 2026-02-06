-- =============================================
-- SCHEMA COMPLET PUSHPROFILE V2
-- A exécuter dans Supabase SQL Editor
-- =============================================

-- Table: searches
CREATE TABLE IF NOT EXISTS searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  search_type TEXT DEFAULT 'cv',
  job_title TEXT,
  location TEXT,
  seniority TEXT,
  brief TEXT,
  cv_text TEXT,
  parsed_data JSONB,
  status TEXT DEFAULT 'pending',
  processing_step TEXT,
  error_message TEXT,
  recurrence TEXT,
  is_recurrence_active BOOLEAN DEFAULT false,
  next_run_at TIMESTAMPTZ,
  exclude_agencies BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES searches(id) ON DELETE CASCADE,
  title TEXT,
  company TEXT,
  location TEXT,
  salary TEXT,
  description TEXT,
  url TEXT,
  source TEXT,
  contract_type TEXT,
  remote TEXT,
  posted_date TEXT,
  company_logo TEXT,
  score INTEGER,
  score_details JSONB,
  scored_at TIMESTAMPTZ,
  is_new BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: contacts_cache
CREATE TABLE IF NOT EXISTS contacts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contacts JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Table: company_profiles
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  wttj_url TEXT,
  profile_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Table: api_usage
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  api_name TEXT NOT NULL,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_quotas
CREATE TABLE IF NOT EXISTS user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  monthly_credits INTEGER DEFAULT 100,
  credits_used INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
CREATE INDEX IF NOT EXISTS idx_searches_user_status ON searches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_search_id ON matches(search_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts_cache(company_name);
CREATE INDEX IF NOT EXISTS idx_company_profiles_name ON company_profiles(company_name);

-- RLS (Row Level Security)
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- Policies pour accès public (dev mode - à sécuriser plus tard)
CREATE POLICY "Allow all searches" ON searches FOR ALL USING (true);
CREATE POLICY "Allow all matches" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all contacts_cache" ON contacts_cache FOR ALL USING (true);
CREATE POLICY "Allow all company_profiles" ON company_profiles FOR ALL USING (true);
CREATE POLICY "Allow all api_usage" ON api_usage FOR ALL USING (true);
CREATE POLICY "Allow all user_quotas" ON user_quotas FOR ALL USING (true);
