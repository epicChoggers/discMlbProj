-- =====================================================
-- REMOVE STREAK SYSTEM
-- =====================================================

-- Remove streak tracking columns from at_bat_predictions table
ALTER TABLE at_bat_predictions DROP COLUMN IF EXISTS streak_count;
ALTER TABLE at_bat_predictions DROP COLUMN IF EXISTS streak_bonus;

-- Drop the existing view first
DROP VIEW IF EXISTS predictions_with_users;

-- Recreate the predictions_with_users view without streak information
CREATE VIEW predictions_with_users AS
SELECT 
    p.id,
    p.user_id,
    p.game_pk,
    p.at_bat_index,
    p.prediction,
    p.prediction_category,
    p.actual_outcome,
    p.actual_category,
    p.is_correct,
    p.points_earned,
    p.created_at,
    p.resolved_at,
    u.email,
    u.raw_user_meta_data
FROM at_bat_predictions p
LEFT JOIN auth.users u ON p.user_id = u.id;

-- Grant access to the updated view
GRANT SELECT ON predictions_with_users TO authenticated;
