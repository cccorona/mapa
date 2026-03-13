-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enum: closed domain of event types (no "Other")
CREATE TYPE event_type AS ENUM (
  'DEATH',
  'JOB_RESIGNATION',
  'JOB_TERMINATION',
  'RELATIONSHIP_END',
  'MAJOR_DECISION',
  'NEW_BEGINNING',
  'RELOCATION',
  'ACCIDENT',
  'HEALTH_DIAGNOSIS',
  'LEGAL_EVENT'
);

-- Enum: emotional intensity scale 1-5
CREATE TYPE emotional_intensity AS ENUM ('1', '2', '3', '4', '5');

-- Enum: moderation status
CREATE TYPE event_status AS ENUM ('pending', 'approved', 'rejected');

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type event_type NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  title TEXT,
  location_label TEXT,
  emotional_intensity emotional_intensity NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  status event_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for geospatial and filter queries
CREATE INDEX events_location_idx ON events USING GIST(location);
CREATE INDEX events_type_idx ON events(event_type);
CREATE INDEX events_occurred_at_idx ON events(occurred_at);
CREATE INDEX events_status_idx ON events(status);

-- RLS policies (enable after auth)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Public read for approved events only
CREATE POLICY "events_select_approved" ON events
  FOR SELECT
  USING (status = 'approved');

-- Authenticated users can insert (creates as pending)
CREATE POLICY "events_insert_authenticated" ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own pending events
CREATE POLICY "events_update_own_pending" ON events
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'pending')
  WITH CHECK (true);

-- RPC: get events in bounding box (for map viewport)
CREATE OR REPLACE FUNCTION get_events_in_bounds(
  p_north float, p_south float, p_east float, p_west float
)
RETURNS SETOF events
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM events
  WHERE status = 'approved'
  AND ST_Intersects(
    location,
    ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
  )
  ORDER BY occurred_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_events_in_bounds TO anon;
GRANT EXECUTE ON FUNCTION get_events_in_bounds TO authenticated;

-- RPC: create event (handles geography conversion)
CREATE OR REPLACE FUNCTION create_event(
  p_event_type event_type,
  p_lng float, p_lat float,
  p_occurred_at timestamptz,
  p_description text,
  p_title text DEFAULT NULL,
  p_location_label text DEFAULT NULL,
  p_emotional_intensity emotional_intensity DEFAULT '3',
  p_is_anonymous boolean DEFAULT true
)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row events;
BEGIN
  INSERT INTO events (
    event_type, location, occurred_at, description,
    title, location_label, emotional_intensity, is_anonymous, created_by
  ) VALUES (
    p_event_type,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_occurred_at,
    p_description,
    p_title,
    p_location_label,
    p_emotional_intensity,
    p_is_anonymous,
    auth.uid()
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_event TO authenticated;

-- RPC: update event status (for moderation - requires auth)
CREATE OR REPLACE FUNCTION update_event_status(
  p_event_id uuid,
  p_status event_status
)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row events;
BEGIN
  UPDATE events SET status = p_status, updated_at = now() WHERE id = p_event_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_status TO authenticated;

-- RPC: get all events for moderation (authenticated users only)
CREATE OR REPLACE FUNCTION get_events_for_moderation()
RETURNS SETOF events
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM events ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_events_for_moderation TO authenticated;
