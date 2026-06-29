-- Add anon grant and reload PostgREST schema cache
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO anon;
NOTIFY pgrst, 'reload schema';
