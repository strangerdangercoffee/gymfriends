-- Update the group invitation trigger to preserve responded_at if already set
-- This allows QR code scanning to set responded_at = created_at

CREATE OR REPLACE FUNCTION handle_group_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
    -- When invitation is accepted, add user to group_members
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (NEW.group_id, NEW.invited_user_id, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;
        
        -- Set responded_at timestamp only if not already set
        -- (allows caller to set responded_at = created_at for immediate acceptance)
        IF NEW.responded_at IS NULL THEN
            NEW.responded_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger is already created, this just updates the function
