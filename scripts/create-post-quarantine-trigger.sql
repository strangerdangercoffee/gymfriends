-- Create Post Quarantine Trigger
-- This script creates a trigger to auto-quarantine posts with 3+ reports

CREATE OR REPLACE FUNCTION check_post_reports()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  -- Count reports for this post
  SELECT COUNT(*) INTO report_count
  FROM post_reports
  WHERE post_id = NEW.post_id;
  
  -- Update report_count on the post
  UPDATE area_feed_posts
  SET report_count = report_count
  WHERE post_id = NEW.post_id;
  
  -- Auto-quarantine if 3+ reports and not already quarantined
  IF report_count >= 3 THEN
    UPDATE area_feed_posts
    SET 
      quarantined = true,
      quarantined_at = NOW(),
      quarantined_reason = 'Auto-quarantined due to ' || report_count || ' reports'
    WHERE post_id = NEW.post_id
    AND quarantined = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_check_post_reports ON post_reports;
CREATE TRIGGER trigger_check_post_reports
    AFTER INSERT ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION check_post_reports();

COMMENT ON FUNCTION check_post_reports() IS 'Automatically quarantines posts when they receive 3 or more reports';
