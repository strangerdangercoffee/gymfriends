-- Migrate climbing_profiles table to use BOOLEAN instead of TEXT for climbing preferences
-- This script converts 'yes'/'no'/'both' text values to boolean values

-- Step 1: Add new boolean columns (temporary)
ALTER TABLE climbing_profiles
ADD COLUMN lead_climbing_new BOOLEAN DEFAULT false,
ADD COLUMN top_rope_new BOOLEAN DEFAULT false,
ADD COLUMN bouldering_new BOOLEAN DEFAULT false,
ADD COLUMN traditional_climbing_new BOOLEAN DEFAULT false;

-- Step 2: Migrate data from old columns to new columns
-- Convert 'yes' or 'both' to true, 'no' to false
UPDATE climbing_profiles
SET 
  lead_climbing_new = CASE 
    WHEN lead_climbing IN ('yes', 'both') THEN true 
    ELSE false 
  END,
  top_rope_new = CASE 
    WHEN top_rope IN ('yes', 'both') THEN true 
    ELSE false 
  END,
  bouldering_new = CASE 
    WHEN bouldering IN ('yes', 'both') THEN true 
    ELSE false 
  END,
  traditional_climbing_new = CASE 
    WHEN traditional_climbing IN ('yes', 'both') THEN true 
    ELSE false 
  END;

-- Step 3: Drop old columns
ALTER TABLE climbing_profiles
DROP COLUMN lead_climbing,
DROP COLUMN top_rope,
DROP COLUMN bouldering,
DROP COLUMN traditional_climbing;

-- Step 4: Rename new columns to original names
ALTER TABLE climbing_profiles
RENAME COLUMN lead_climbing_new TO lead_climbing;
ALTER TABLE climbing_profiles
RENAME COLUMN top_rope_new TO top_rope;
ALTER TABLE climbing_profiles
RENAME COLUMN bouldering_new TO bouldering;
ALTER TABLE climbing_profiles
RENAME COLUMN traditional_climbing_new TO traditional_climbing;

-- Step 5: Set NOT NULL constraints and defaults
ALTER TABLE climbing_profiles
ALTER COLUMN lead_climbing SET NOT NULL,
ALTER COLUMN lead_climbing SET DEFAULT false,
ALTER COLUMN top_rope SET NOT NULL,
ALTER COLUMN top_rope SET DEFAULT false,
ALTER COLUMN bouldering SET NOT NULL,
ALTER COLUMN bouldering SET DEFAULT false,
ALTER COLUMN traditional_climbing SET NOT NULL,
ALTER COLUMN traditional_climbing SET DEFAULT false;

-- Step 6: Add comments
COMMENT ON COLUMN climbing_profiles.lead_climbing IS 'Whether user does lead climbing (boolean)';
COMMENT ON COLUMN climbing_profiles.top_rope IS 'Whether user does top rope climbing (boolean)';
COMMENT ON COLUMN climbing_profiles.bouldering IS 'Whether user does bouldering (boolean)';
COMMENT ON COLUMN climbing_profiles.traditional_climbing IS 'Whether user does traditional climbing (boolean)';
