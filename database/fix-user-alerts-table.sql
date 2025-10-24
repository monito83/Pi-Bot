-- Fix user_alerts table to properly handle auto-incrementing IDs
-- This script fixes the primary key constraint issue

-- Step 1: Drop the existing primary key constraint
ALTER TABLE user_alerts DROP CONSTRAINT IF EXISTS user_alerts_pkey;

-- Step 2: Drop the existing id column
ALTER TABLE user_alerts DROP COLUMN IF EXISTS id;

-- Step 3: Add a new id column as SERIAL (auto-incrementing)
ALTER TABLE user_alerts ADD COLUMN id SERIAL PRIMARY KEY;

-- Step 4: Add unique constraint for (discord_user_id, project_id) if it doesn't exist
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_user_project_unique 
UNIQUE (discord_user_id, project_id);

-- Step 5: Verify the table structure
\d user_alerts;

