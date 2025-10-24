-- Alternative safer approach: Create a new table and migrate data
-- This avoids potential data loss

-- Step 1: Create a new table with proper structure
CREATE TABLE user_alerts_new (
  id SERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  project_id INTEGER NOT NULL REFERENCES nft_projects(id),
  alert_types TEXT DEFAULT '[]',
  floor_threshold REAL DEFAULT 5.0,
  volume_threshold REAL DEFAULT 10.0,
  sales_threshold INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (discord_user_id, project_id)
);

-- Step 2: Copy data from old table (if any exists)
INSERT INTO user_alerts_new (discord_user_id, project_id, alert_types, floor_threshold, volume_threshold, sales_threshold, is_active, created_at, updated_at)
SELECT 
  discord_user_id, 
  project_id, 
  alert_types, 
  floor_threshold, 
  volume_threshold, 
  sales_threshold, 
  is_active, 
  COALESCE(created_at, NOW()), 
  COALESCE(updated_at, NOW())
FROM user_alerts;

-- Step 3: Drop the old table
DROP TABLE user_alerts;

-- Step 4: Rename the new table
ALTER TABLE user_alerts_new RENAME TO user_alerts;

-- Step 5: Verify the table structure
\d user_alerts;
