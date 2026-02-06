-- =============================================
-- Async Search Processing
-- Add column to track processing progress
-- =============================================

-- Add processing_step column to searches table
ALTER TABLE searches
ADD COLUMN IF NOT EXISTS processing_step TEXT DEFAULT NULL;

-- Valid steps:
-- 'parsing' -> 'linkedin' -> 'indeed' -> 'glassdoor' -> 'wttj' -> 'filtering' -> 'scoring' -> 'saving' -> NULL (completed)

-- Add error column for failed searches
ALTER TABLE searches
ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT NULL;

-- Index for efficient polling
CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
CREATE INDEX IF NOT EXISTS idx_searches_user_status ON searches(user_id, status);
