-- Simple fix for user_alerts table
-- Execute this in DBeaver or your PostgreSQL client

-- First, let's see the current table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_alerts' 
ORDER BY ordinal_position;

-- Check if there are any existing records
SELECT COUNT(*) as total_records FROM user_alerts;

-- Check the current primary key constraint
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'user_alerts';

-- If you have existing data, backup first:
-- CREATE TABLE user_alerts_backup AS SELECT * FROM user_alerts;

-- Then execute this fix:
-- Step 1: Drop the problematic constraint
ALTER TABLE user_alerts DROP CONSTRAINT IF EXISTS user_alerts_pkey;

-- Step 2: Add a new auto-incrementing id column
ALTER TABLE user_alerts ADD COLUMN new_id SERIAL PRIMARY KEY;

-- Step 3: Drop the old id column
ALTER TABLE user_alerts DROP COLUMN IF EXISTS id;

-- Step 4: Rename the new column
ALTER TABLE user_alerts RENAME COLUMN new_id TO id;

-- Step 5: Add unique constraint for user-project combination
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_user_project_unique 
UNIQUE (discord_user_id, project_id);

-- Verify the fix worked
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_alerts' 
ORDER BY ordinal_position;
