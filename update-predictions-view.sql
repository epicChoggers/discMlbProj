-- Update predictions_with_users view to include is_partial_credit field
DROP VIEW IF EXISTS predictions_with_users CASCADE;

-- Recreate the predictions_with_users view with is_partial_credit field
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
    p.is_partial_credit,
    p.points_earned,
    p.streak_count,
    p.streak_bonus,
    p.created_at,
    p.resolved_at,
    -- Add batter and pitcher columns
    p.batter_id,
    p.batter_name,
    p.batter_position,
    p.batter_bat_side,
    p.pitcher_id,
    p.pitcher_name,
    p.pitcher_hand,
    u.email,
    u.username,
    u.avatar_url,
    u.raw_user_meta_data
FROM at_bat_predictions p
LEFT JOIN user_profiles u ON p.user_id = u.id;

-- Grant permissions
GRANT SELECT ON predictions_with_users TO authenticated;
