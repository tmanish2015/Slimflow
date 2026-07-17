-- Aluminium System Configuration Engine — relational schema.
-- Every table here is meant to be admin-editable data, not application
-- logic: adding a new finish, profile, track, or recommendation threshold
-- is a row insert, never a code change. Recommendation rules are threshold
-- BANDS (min/max columns) rather than a generic condition DSL — simpler to
-- reason about and edit than a rules engine, while still being pure data.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- uses_track/uses_hinges gate whether Track (Step 7) and Hinge (Step 9)
-- recommendation apply at all — e.g. Openable doors don't run on a track,
-- Fixed panels need neither. Kept as data, not an architecture-name check in
-- code, so a newly added architecture (e.g. "Tilt & Turn") is configured by
-- an admin setting these flags, never a code change.
CREATE TABLE IF NOT EXISTS door_architectures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  uses_track INTEGER NOT NULL DEFAULT 0,
  uses_hinges INTEGER NOT NULL DEFAULT 0
);

-- Panel configuration codes like "1+3" (1 fixed + 3 sliding) carry a
-- total_panels count and a heavy-duty flag, seeded from the spec's rule
-- ("if configuration >= 1+3, recommend Heavy Track") but editable per row —
-- an admin can flip is_heavy_duty on a specific config without touching code.
CREATE TABLE IF NOT EXISTS panel_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  total_panels INTEGER NOT NULL,
  track_count INTEGER NOT NULL,
  is_heavy_duty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_finishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  price_multiplier REAL NOT NULL DEFAULT 1.0,
  swatch_hex TEXT NOT NULL DEFAULT '#888888'
);

CREATE TABLE IF NOT EXISTS profile_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  system_type_id INTEGER REFERENCES system_types(id),
  description TEXT NOT NULL DEFAULT ''
);

-- Reference enum for profile roles (Top/Bottom/Left/Right, Centre Divider,
-- Horizontal Divider, Glass Bead, Clip, Cover Profile). scaling_rule and
-- orientation drive Step 4's automatic quantity/length calculation:
--   scaling_rule 'fixed'       -> quantity is always `fixed_qty`
--   scaling_rule 'per_divider' -> quantity scales with (total_panels - 1)
--   orientation 'horizontal'   -> cut length comes from the opening width
--   orientation 'vertical'     -> cut length comes from the opening height
CREATE TABLE IF NOT EXISTS profile_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  orientation TEXT NOT NULL CHECK (orientation IN ('horizontal', 'vertical')),
  scaling_rule TEXT NOT NULL CHECK (scaling_rule IN ('fixed', 'per_divider')),
  fixed_qty INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id INTEGER NOT NULL REFERENCES profile_series(id),
  role_id INTEGER NOT NULL REFERENCES profile_roles(id),
  name TEXT NOT NULL,
  weight_per_metre_kg REAL NOT NULL,
  rate_per_kg REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS track_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  duty_class TEXT NOT NULL CHECK (duty_class IN ('light', 'medium', 'heavy', 'ultra_heavy', 'soft_close')),
  max_capacity_kg REAL NOT NULL,
  max_span_mm REAL NOT NULL,
  rate_per_metre REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS frame_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  duty_class TEXT NOT NULL CHECK (duty_class IN ('light', 'medium', 'heavy', 'extra_heavy')),
  max_capacity_kg REAL NOT NULL,
  rate_per_metre REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS hinge_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  hinge_type TEXT NOT NULL CHECK (hinge_type IN ('normal', 'concealed', 'pivot', 'hydraulic', 'soft_close', 'heavy_duty')),
  max_capacity_kg REAL NOT NULL,
  rate_per_unit REAL NOT NULL
);

-- applicable_door_types stores a JSON array of door_architectures.name —
-- kept as JSON rather than a join table for Phase 1 simplicity; still a
-- data edit, not a code change, to widen/narrow where a handle/lock applies.
CREATE TABLE IF NOT EXISTS handle_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  handle_type TEXT NOT NULL,
  applicable_door_types TEXT NOT NULL DEFAULT '[]',
  rate_per_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS lock_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  lock_type TEXT NOT NULL,
  applicable_door_types TEXT NOT NULL DEFAULT '[]',
  rate_per_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS connector_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  connector_type TEXT NOT NULL,
  rate_per_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS seal_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  rate_per_metre REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tape_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  rate_per_sqft REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS glass_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  glass_type TEXT NOT NULL,
  thickness_mm REAL NOT NULL,
  weight_per_sqft_kg REAL NOT NULL,
  rate_per_sqft REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS accessory_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  rate REAL NOT NULL
);

-- Recommendation rule tables: each row is a threshold band mapping to a
-- recommended master item. Multiple matching rows resolve by `priority`
-- (highest first) — this is how an admin overrides a general rule with a
-- more specific one without editing any code.
CREATE TABLE IF NOT EXISTS track_recommendation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_door_weight_kg REAL NOT NULL DEFAULT 0,
  max_door_weight_kg REAL,
  requires_heavy_duty_config INTEGER,
  max_span_mm REAL,
  recommended_track_id INTEGER NOT NULL REFERENCES track_master(id),
  priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS frame_recommendation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_height_mm REAL NOT NULL DEFAULT 0,
  max_height_mm REAL,
  min_width_mm REAL NOT NULL DEFAULT 0,
  max_width_mm REAL,
  min_total_weight_kg REAL NOT NULL DEFAULT 0,
  recommended_frame_id INTEGER NOT NULL REFERENCES frame_master(id),
  priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hinge_recommendation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  door_architecture_id INTEGER REFERENCES door_architectures(id),
  min_door_weight_kg REAL NOT NULL DEFAULT 0,
  max_door_weight_kg REAL,
  recommended_hinge_id INTEGER NOT NULL REFERENCES hinge_master(id),
  priority INTEGER NOT NULL DEFAULT 0
);

-- Generic compatibility engine (Step 17) — "X excludes/requires Y" between
-- any two master rows. Schema exists from Phase 1; only lightly enforced
-- until the compatibility engine phase actually reads it.
CREATE TABLE IF NOT EXISTS compatibility_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  subject_table TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  constraint_table TEXT NOT NULL,
  constraint_id INTEGER NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('requires', 'excludes')),
  active INTEGER NOT NULL DEFAULT 1
);

-- A saved user configuration ("project") — the actual thing being quoted.
CREATE TABLE IF NOT EXISTS configurations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  system_type_id INTEGER REFERENCES system_types(id),
  door_architecture_id INTEGER REFERENCES door_architectures(id),
  panel_configuration_id INTEGER REFERENCES panel_configurations(id),
  profile_series_id INTEGER REFERENCES profile_series(id),
  finish_id INTEGER REFERENCES profile_finishes(id),
  glass_id INTEGER REFERENCES glass_master(id),
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  estimated_door_weight_kg REAL,
  recommended_track_id INTEGER REFERENCES track_master(id),
  recommended_frame_id INTEGER REFERENCES frame_master(id),
  recommended_hinge_id INTEGER REFERENCES hinge_master(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Auto-calculated frame profile quantities (Step 4), one row per profile
-- role used in a configuration.
CREATE TABLE IF NOT EXISTS configuration_profile_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  configuration_id TEXT NOT NULL REFERENCES configurations(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  role_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  length_mm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  cost REAL NOT NULL
);
