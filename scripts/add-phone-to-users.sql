-- Add phone number and verification timestamp to users table
-- Used for phone-only add friend, invitations, and matching pending invitations

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Optional: ensure one phone number per account (uncomment if desired)
-- CREATE UNIQUE INDEX idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

COMMENT ON COLUMN users.phone IS 'Normalized phone number (e.g. E.164 or digits-only) for add-friend and invitation matching';
COMMENT ON COLUMN users.phone_verified_at IS 'When the phone number was verified via SMS code; null if not yet verified';
