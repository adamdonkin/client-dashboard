-- Comprehensive check for cancellation/reschedule patterns
-- Check for various spellings and patterns

-- 1. Check for different cancellation spellings
SELECT 
  'cancelled_spelling' as pattern_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%cancelled%') as cancelled_count,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%canceled%') as canceled_count,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%cancel%') as cancel_count
FROM calendar_events;

-- 2. Check for reschedule patterns
SELECT 
  'reschedule_patterns' as pattern_type,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%reschedule%') as reschedule_count,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%postpone%') as postpone_count,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%no show%') as no_show_count
FROM calendar_events;

-- 3. Check for bracketed patterns
SELECT 
  'bracketed_patterns' as pattern_type,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%[cancelled]%') as bracketed_cancelled,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%[canceled]%') as bracketed_canceled,
  COUNT(*) FILTER (WHERE LOWER(title) LIKE '%[reschedule]%') as bracketed_reschedule
FROM calendar_events;

-- 4. Check for very short events (potential cancellations)
SELECT 
  'short_events' as pattern_type,
  COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (end_time - start_time)) / 60 < 15) as short_events_count
FROM calendar_events;

-- 5. Recent events (last 2 weeks) to see what's being synced
SELECT 
  'recent_events' as pattern_type,
  COUNT(*) as total_recent,
  COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '14 days') as last_14_days,
  COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '7 days') as last_7_days,
  COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '1 day') as last_1_day
FROM calendar_events;

-- 6. Sample of recent events to see patterns
SELECT 
  id, 
  title, 
  start_time, 
  end_time, 
  created_at,
  EXTRACT(EPOCH FROM (end_time - start_time)) / 60 as duration_minutes
FROM calendar_events 
WHERE start_time >= NOW() - INTERVAL '7 days'
ORDER BY start_time DESC
LIMIT 20; 