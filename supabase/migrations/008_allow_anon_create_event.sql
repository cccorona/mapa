-- Permitir crear eventos sin Supabase Auth (auth propio; created_by será null)
GRANT EXECUTE ON FUNCTION create_event(event_type, float, float, timestamptz, text, text, text, emotional_intensity, boolean) TO anon;
