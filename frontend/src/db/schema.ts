// Aluminium System Configuration Engine — relational schema, ported unchanged
// from the app's original SQLite schema (pre-Postgres). Every master/rule
// table here is meant to be admin-editable data, not application logic.
// Plus the drawing-recognition module's tables (drawings/drawing_files/
// rate_master) and a local app_config table for the single-admin login,
// none of which need a server anymore — everything lives in this one
// sql.js database, persisted to IndexedDB (see engine.ts).
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS door_architectures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  uses_track INTEGER NOT NULL DEFAULT 0,
  uses_hinges INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS panel_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  total_panels INTEGER NOT NULL,
  track_count INTEGER NOT NULL,
  is_heavy_duty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finish_price_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS profile_finishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  group_id INTEGER NOT NULL REFERENCES finish_price_groups(id),
  swatch_hex TEXT NOT NULL DEFAULT '#888888'
);

CREATE TABLE IF NOT EXISTS profile_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  system_type_id INTEGER REFERENCES system_types(id),
  description TEXT NOT NULL DEFAULT ''
);

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

CREATE TABLE IF NOT EXISTS glass_bead_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  min_thickness_mm REAL NOT NULL DEFAULT 0,
  max_thickness_mm REAL,
  weight_per_metre_kg REAL NOT NULL,
  rate_per_metre REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS accessory_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS floor_spring_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  spring_type TEXT NOT NULL CHECK (spring_type IN ('floor_pivot', 'hydraulic_floor_spring', 'top_pivot', 'bottom_pivot')),
  max_capacity_kg REAL NOT NULL,
  rate_per_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS hardware_set_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  hinge_id INTEGER REFERENCES hinge_master(id),
  floor_spring_id INTEGER REFERENCES floor_spring_master(id),
  handle_id INTEGER NOT NULL REFERENCES handle_master(id),
  lock_id INTEGER NOT NULL REFERENCES lock_master(id),
  rate_per_set REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS hardware_set_recommendation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  door_architecture_id INTEGER REFERENCES door_architectures(id),
  profile_series_id INTEGER REFERENCES profile_series(id),
  min_door_weight_kg REAL NOT NULL DEFAULT 0,
  max_door_weight_kg REAL,
  recommended_hardware_set_id INTEGER NOT NULL REFERENCES hardware_set_master(id),
  priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waste_percent REAL NOT NULL DEFAULT 5,
  margin_percent REAL NOT NULL DEFAULT 18
);

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

CREATE TABLE IF NOT EXISTS floor_spring_recommendation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  door_architecture_id INTEGER REFERENCES door_architectures(id),
  min_door_weight_kg REAL NOT NULL DEFAULT 0,
  max_door_weight_kg REAL,
  recommended_floor_spring_id INTEGER NOT NULL REFERENCES floor_spring_master(id),
  priority INTEGER NOT NULL DEFAULT 0
);

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
  recommended_floor_spring_id INTEGER REFERENCES floor_spring_master(id),
  recommended_handle_id INTEGER REFERENCES handle_master(id),
  recommended_lock_id INTEGER REFERENCES lock_master(id),
  recommended_hardware_set_id INTEGER REFERENCES hardware_set_master(id),
  material_cost REAL,
  waste_cost REAL,
  total_cost REAL,
  selling_price REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS configuration_bom_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  configuration_id TEXT NOT NULL REFERENCES configurations(id),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  formula TEXT NOT NULL
);

-- Drawing-recognition module: one JSON blob per drawing (still evolving
-- shape, same reasoning as when this lived in Postgres jsonb) plus a
-- separate BLOB table for the uploaded original + generated OCR preview,
-- keyed by (drawing_id, kind) since a drawing has exactly one of each.
CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawing_files (
  drawing_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('upload', 'preview')),
  data BLOB NOT NULL,
  content_type TEXT NOT NULL,
  PRIMARY KEY (drawing_id, kind)
);

CREATE TABLE IF NOT EXISTS rate_master (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);

-- Local single-admin login: a tiny key/value table instead of a server .env
-- file, since there's no server. 'admin_username'/'admin_password_hash' are
-- absent until first run's "set your password" step creates them.
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`
