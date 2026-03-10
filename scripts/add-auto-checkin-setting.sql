-- Add auto_check_in field to privacy_settings in users table
-- This allows users to enable/disable automatic check-in when near gyms

-- Update existing users to have the auto_check_in setting set to false by default
UPDATE users
SET privacy_settings = jsonb_set(
  COALESCE(privacy_settings, '{}'::jsonb),
  '{auto_check_in}',
  'false'::jsonb
)
WHERE privacy_settings IS NULL 
   OR NOT privacy_settings ? 'auto_check_in';

-- Verify the update
SELECT 
  id, 
  name, 
  privacy_settings->>'auto_check_in' as auto_check_in,
  privacy_settings
FROM users
LIMIT 5;


