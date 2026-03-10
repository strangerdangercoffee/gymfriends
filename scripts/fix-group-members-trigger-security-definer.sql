-- Fix group_members RLS for QR join: make the invitation-accepted trigger run as
-- SECURITY DEFINER so the INSERT into group_members bypasses RLS (the invitation
-- acceptance already authorizes the user to join).

CREATE OR REPLACE FUNCTION handle_group_invitation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (NEW.group_id, NEW.invited_user_id, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;

        IF NEW.responded_at IS NULL THEN
            NEW.responded_at = NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
