-- Postgres port of the configurator's original schema.sql (SQLite via
-- node:sqlite) for the Vercel/Supabase migration — node:sqlite's file-backed
-- DB doesn't survive Vercel's ephemeral/serverless filesystem. Same tables,
-- same columns, same semantics: INTEGER PRIMARY KEY AUTOINCREMENT ->
-- identity column, REAL -> double precision, TEXT stays text.
-- Boolean-flavored INTEGER columns (uses_track, uses_hinges, is_heavy_duty,
-- active) are kept as integer 0/1 rather than converted to boolean, since
-- the application code's comparisons (e.g.
-- `requires_heavy_duty_config = ?` bound to a JS number) read them
-- numerically — converting types is a separate cleanup, not part of this
-- migration.
--
-- Applied to the Supabase project via the Supabase MCP's apply_migration
-- (migration name: create_slimflow_schema) — this file is a record of what
-- was run, not itself executed by the app.

CREATE TABLE IF NOT EXISTS system_types (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS door_architectures (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  uses_track integer NOT NULL DEFAULT 0,
  uses_hinges integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS panel_configurations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  total_panels integer NOT NULL,
  track_count integer NOT NULL,
  is_heavy_duty integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finish_price_groups (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  multiplier double precision NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS profile_finishes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  group_id integer NOT NULL REFERENCES finish_price_groups(id),
  swatch_hex text NOT NULL DEFAULT '#888888'
);

CREATE TABLE IF NOT EXISTS profile_series (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  system_type_id integer REFERENCES system_types(id),
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS profile_roles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  orientation text NOT NULL CHECK (orientation IN ('horizontal', 'vertical')),
  scaling_rule text NOT NULL CHECK (scaling_rule IN ('fixed', 'per_divider')),
  fixed_qty integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS profiles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  series_id integer NOT NULL REFERENCES profile_series(id),
  role_id integer NOT NULL REFERENCES profile_roles(id),
  name text NOT NULL,
  weight_per_metre_kg double precision NOT NULL,
  rate_per_kg double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS track_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  duty_class text NOT NULL CHECK (duty_class IN ('light', 'medium', 'heavy', 'ultra_heavy', 'soft_close')),
  max_capacity_kg double precision NOT NULL,
  max_span_mm double precision NOT NULL,
  rate_per_metre double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS frame_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  duty_class text NOT NULL CHECK (duty_class IN ('light', 'medium', 'heavy', 'extra_heavy')),
  max_capacity_kg double precision NOT NULL,
  rate_per_metre double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS hinge_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  hinge_type text NOT NULL CHECK (hinge_type IN ('normal', 'concealed', 'pivot', 'hydraulic', 'soft_close', 'heavy_duty')),
  max_capacity_kg double precision NOT NULL,
  rate_per_unit double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS handle_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  handle_type text NOT NULL,
  applicable_door_types text NOT NULL DEFAULT '[]',
  rate_per_unit double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS lock_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  lock_type text NOT NULL,
  applicable_door_types text NOT NULL DEFAULT '[]',
  rate_per_unit double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS connector_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  connector_type text NOT NULL,
  rate_per_unit double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS seal_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  rate_per_metre double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS tape_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  rate_per_sqft double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS glass_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  glass_type text NOT NULL,
  thickness_mm double precision NOT NULL,
  weight_per_sqft_kg double precision NOT NULL,
  rate_per_sqft double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS glass_bead_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  min_thickness_mm double precision NOT NULL DEFAULT 0,
  max_thickness_mm double precision,
  weight_per_metre_kg double precision NOT NULL,
  rate_per_metre double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS accessory_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  unit text NOT NULL,
  rate double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS floor_spring_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  spring_type text NOT NULL CHECK (spring_type IN ('floor_pivot', 'hydraulic_floor_spring', 'top_pivot', 'bottom_pivot')),
  max_capacity_kg double precision NOT NULL,
  rate_per_unit double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS hardware_set_master (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text UNIQUE NOT NULL,
  hinge_id integer REFERENCES hinge_master(id),
  floor_spring_id integer REFERENCES floor_spring_master(id),
  handle_id integer NOT NULL REFERENCES handle_master(id),
  lock_id integer NOT NULL REFERENCES lock_master(id),
  rate_per_set double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS hardware_set_recommendation_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  door_architecture_id integer REFERENCES door_architectures(id),
  profile_series_id integer REFERENCES profile_series(id),
  min_door_weight_kg double precision NOT NULL DEFAULT 0,
  max_door_weight_kg double precision,
  recommended_hardware_set_id integer NOT NULL REFERENCES hardware_set_master(id),
  priority integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  waste_percent double precision NOT NULL DEFAULT 5,
  margin_percent double precision NOT NULL DEFAULT 18
);

CREATE TABLE IF NOT EXISTS track_recommendation_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  min_door_weight_kg double precision NOT NULL DEFAULT 0,
  max_door_weight_kg double precision,
  requires_heavy_duty_config integer,
  max_span_mm double precision,
  recommended_track_id integer NOT NULL REFERENCES track_master(id),
  priority integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS frame_recommendation_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  min_height_mm double precision NOT NULL DEFAULT 0,
  max_height_mm double precision,
  min_width_mm double precision NOT NULL DEFAULT 0,
  max_width_mm double precision,
  min_total_weight_kg double precision NOT NULL DEFAULT 0,
  recommended_frame_id integer NOT NULL REFERENCES frame_master(id),
  priority integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hinge_recommendation_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  door_architecture_id integer REFERENCES door_architectures(id),
  min_door_weight_kg double precision NOT NULL DEFAULT 0,
  max_door_weight_kg double precision,
  recommended_hinge_id integer NOT NULL REFERENCES hinge_master(id),
  priority integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS floor_spring_recommendation_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  door_architecture_id integer REFERENCES door_architectures(id),
  min_door_weight_kg double precision NOT NULL DEFAULT 0,
  max_door_weight_kg double precision,
  recommended_floor_spring_id integer NOT NULL REFERENCES floor_spring_master(id),
  priority integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compatibility_rules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_name text NOT NULL,
  subject_table text NOT NULL,
  subject_id integer NOT NULL,
  constraint_table text NOT NULL,
  constraint_id integer NOT NULL,
  relation text NOT NULL CHECK (relation IN ('requires', 'excludes')),
  active integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS configurations (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  system_type_id integer REFERENCES system_types(id),
  door_architecture_id integer REFERENCES door_architectures(id),
  panel_configuration_id integer REFERENCES panel_configurations(id),
  profile_series_id integer REFERENCES profile_series(id),
  finish_id integer REFERENCES profile_finishes(id),
  glass_id integer REFERENCES glass_master(id),
  width_mm double precision NOT NULL,
  height_mm double precision NOT NULL,
  estimated_door_weight_kg double precision,
  recommended_track_id integer REFERENCES track_master(id),
  recommended_frame_id integer REFERENCES frame_master(id),
  recommended_hinge_id integer REFERENCES hinge_master(id),
  recommended_floor_spring_id integer REFERENCES floor_spring_master(id),
  recommended_handle_id integer REFERENCES handle_master(id),
  recommended_lock_id integer REFERENCES lock_master(id),
  recommended_hardware_set_id integer REFERENCES hardware_set_master(id),
  material_cost double precision,
  waste_cost double precision,
  total_cost double precision,
  selling_price double precision,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS configuration_profile_lines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  configuration_id text NOT NULL REFERENCES configurations(id),
  profile_id integer NOT NULL REFERENCES profiles(id),
  role_name text NOT NULL,
  quantity integer NOT NULL,
  length_mm double precision NOT NULL,
  weight_kg double precision NOT NULL,
  cost double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS configuration_bom_lines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  configuration_id text NOT NULL REFERENCES configurations(id),
  category text NOT NULL,
  item text NOT NULL,
  quantity double precision NOT NULL,
  unit text NOT NULL,
  unit_cost double precision NOT NULL,
  total_cost double precision NOT NULL,
  formula text NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS drawings (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_master (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL
);
