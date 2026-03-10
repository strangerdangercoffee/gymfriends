-- Debug script to check the current state of junction tables
-- This helps identify data inconsistencies

-- Check user-gym follows
SELECT 
    'user_gym_follows' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT gym_id) as unique_gyms
FROM user_gym_follows;

-- Check user friendships
SELECT 
    'user_friendships' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT friend_id) as unique_friends
FROM user_friendships;

-- Check user-gym presence
SELECT 
    'user_gym_presence' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT gym_id) as unique_gyms,
    COUNT(*) FILTER (WHERE is_active = true) as active_presence
FROM user_gym_presence;

-- Check for specific user's data (replace with actual user ID)
-- SELECT 
--     'User follows' as type,
--     uf.gym_id,
--     g.name as gym_name
-- FROM user_gym_follows uf
-- JOIN gyms g ON uf.gym_id = g.id
-- WHERE uf.user_id = 'YOUR_USER_ID_HERE';

-- Check for duplicate follows
SELECT 
    'Duplicate follows' as issue,
    user_id,
    gym_id,
    COUNT(*) as count
FROM user_gym_follows
GROUP BY user_id, gym_id
HAVING COUNT(*) > 1;

-- Check for duplicate friendships
SELECT 
    'Duplicate friendships' as issue,
    user_id,
    friend_id,
    COUNT(*) as count
FROM user_friendships
GROUP BY user_id, friend_id
HAVING COUNT(*) > 1;

-- Check for multiple active presence records per user
SELECT 
    'Multiple active presence' as issue,
    user_id,
    COUNT(*) as active_count
FROM user_gym_presence
WHERE is_active = true
GROUP BY user_id
HAVING COUNT(*) > 1;
