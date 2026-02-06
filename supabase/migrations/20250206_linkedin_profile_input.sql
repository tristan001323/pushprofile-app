-- =============================================
-- LinkedIn Profile Input Feature
-- Add support for LinkedIn URL as search input
-- =============================================

-- Add input_type to track the source of search data
ALTER TABLE searches ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'cv';
-- input_type: 'cv' | 'linkedin' | 'manual'

-- Add LinkedIn URL storage
ALTER TABLE searches ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Add profile picture (from LinkedIn)
ALTER TABLE searches ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Index for LinkedIn URL searches (for deduplication)
CREATE INDEX IF NOT EXISTS idx_searches_linkedin_url ON searches(linkedin_url) WHERE linkedin_url IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN searches.input_type IS 'Source of search data: cv, linkedin, or manual';
COMMENT ON COLUMN searches.linkedin_url IS 'LinkedIn profile URL if input_type is linkedin';
COMMENT ON COLUMN searches.profile_picture IS 'Profile picture URL from LinkedIn';
