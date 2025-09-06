-- =====================================================
-- PREDICTIONS WITH USER INFORMATION VIEW
-- =====================================================

-- Create a view for predictions with user information
CREATE OR REPLACE VIEW predictions_with_users AS
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

-- Grant access to the view
GRANT SELECT ON predictions_with_users TO authenticated;
