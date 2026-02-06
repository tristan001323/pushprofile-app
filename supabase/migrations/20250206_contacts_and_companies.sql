-- =============================================
-- PushProfile V2 - Module 2 & 3 Tables
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Contacts Cache (Module 2)
-- Cache enriched contacts to avoid re-paying for same lookups
CREATE TABLE IF NOT EXISTS contacts_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    job_title_searched TEXT,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    job_title TEXT,
    email TEXT,
    email_status TEXT,
    phone TEXT,
    linkedin_url TEXT,
    company_domain TEXT,
    company_industry TEXT,
    company_size TEXT,
    enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to avoid duplicates
    UNIQUE(company_name, linkedin_url)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_cache_company ON contacts_cache(company_name);
CREATE INDEX IF NOT EXISTS idx_contacts_cache_enriched_at ON contacts_cache(enriched_at);

-- 2. API Usage Tracking (for billing/quotas)
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    api_name TEXT NOT NULL,
    credits_used INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);

-- 3. Company Profiles Cache (Module 3)
-- Cache company intelligence data from WTTJ
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    wttj_url TEXT,
    linkedin_url TEXT,
    website TEXT,

    -- Company info
    description TEXT,
    size TEXT,
    employee_count INTEGER,
    average_age INTEGER,
    creation_year INTEGER,

    -- Parity
    parity_men INTEGER,
    parity_women INTEGER,

    -- Location
    offices JSONB DEFAULT '[]',
    headquarters_city TEXT,
    headquarters_country TEXT,

    -- Industry & Tech
    sectors JSONB DEFAULT '[]',
    tech_stack JSONB DEFAULT '[]',

    -- Social
    social_networks JSONB DEFAULT '{}',

    -- Jobs
    jobs_count INTEGER DEFAULT 0,
    jobs JSONB DEFAULT '[]',

    -- Raw data
    raw_data JSONB DEFAULT '{}',

    -- Timestamps
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_name ON company_profiles(name);
CREATE INDEX IF NOT EXISTS idx_company_profiles_scraped ON company_profiles(scraped_at);

-- 4. User Quotas (for premium features)
CREATE TABLE IF NOT EXISTS user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id),
    plan TEXT DEFAULT 'free',  -- 'free', 'starter', 'pro', 'business'

    -- Monthly quotas
    contacts_quota INTEGER DEFAULT 0,
    contacts_used INTEGER DEFAULT 0,
    company_intel_quota INTEGER DEFAULT 0,
    company_intel_used INTEGER DEFAULT 0,
    searches_quota INTEGER DEFAULT 10,
    searches_used INTEGER DEFAULT 0,

    -- Reset date (monthly)
    quota_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE contacts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- API Usage: users can only see their own usage
CREATE POLICY "Users can view own api_usage" ON api_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert api_usage" ON api_usage
    FOR INSERT WITH CHECK (true);

-- User Quotas: users can only see their own quotas
CREATE POLICY "Users can view own quotas" ON user_quotas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage quotas" ON user_quotas
    FOR ALL WITH CHECK (true);

-- Company Profiles: everyone can read (public data)
CREATE POLICY "Anyone can view company_profiles" ON company_profiles
    FOR SELECT USING (true);

CREATE POLICY "Service can manage company_profiles" ON company_profiles
    FOR ALL WITH CHECK (true);

-- Contacts Cache: service role only (sensitive data)
CREATE POLICY "Service can manage contacts_cache" ON contacts_cache
    FOR ALL WITH CHECK (true);

-- 7. Function to check and decrement quota
CREATE OR REPLACE FUNCTION check_and_use_quota(
    p_user_id UUID,
    p_quota_type TEXT,  -- 'contacts', 'company_intel', 'searches'
    p_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
    v_quota INTEGER;
    v_used INTEGER;
    v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current quota and usage
    SELECT
        CASE p_quota_type
            WHEN 'contacts' THEN contacts_quota
            WHEN 'company_intel' THEN company_intel_quota
            WHEN 'searches' THEN searches_quota
        END,
        CASE p_quota_type
            WHEN 'contacts' THEN contacts_used
            WHEN 'company_intel' THEN company_intel_used
            WHEN 'searches' THEN searches_used
        END,
        quota_reset_at
    INTO v_quota, v_used, v_reset_at
    FROM user_quotas
    WHERE user_id = p_user_id;

    -- If no quota record, create one with defaults
    IF NOT FOUND THEN
        INSERT INTO user_quotas (user_id) VALUES (p_user_id);
        RETURN p_quota_type = 'searches' AND p_amount <= 10;  -- Free plan: 10 searches
    END IF;

    -- Check if reset is needed
    IF v_reset_at < NOW() THEN
        UPDATE user_quotas SET
            contacts_used = 0,
            company_intel_used = 0,
            searches_used = 0,
            quota_reset_at = NOW() + INTERVAL '30 days'
        WHERE user_id = p_user_id;
        v_used := 0;
    END IF;

    -- Check quota
    IF v_used + p_amount > v_quota THEN
        RETURN FALSE;
    END IF;

    -- Decrement quota
    EXECUTE format(
        'UPDATE user_quotas SET %I = %I + $1 WHERE user_id = $2',
        p_quota_type || '_used',
        p_quota_type || '_used'
    ) USING p_amount, p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
