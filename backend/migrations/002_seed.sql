-- Postgres port of the configurator's original seed.ts data (same values,
-- name-keyed subqueries instead of hardcoded ids — same robustness
-- reasoning seed.ts's own idByName helper already used).
--
-- Applied to the Supabase project via the Supabase MCP's apply_migration
-- (migration name: seed_slimflow_data) — this file is a record of what was
-- run, not itself executed by the app. Row counts verified against the
-- original seed.ts after applying (system_types 13, door_architectures 7,
-- ..., compatibility_rules 28 = 23 derived + 5 explicit).

INSERT INTO system_types (name, description) VALUES
  ('Openable Door', 'Hinged single/double door leaf'),
  ('Sliding Door', 'Horizontally sliding door panels'),
  ('Sliding Window', 'Horizontally sliding window panels'),
  ('Openable Window', 'Hinged/casement window'),
  ('Fixed Glass', 'Non-operable glazed panel'),
  ('Partition', 'Internal glazed partition wall'),
  ('Shower Cubicle', 'Frameless/semi-framed shower enclosure'),
  ('Wardrobe Door', 'Sliding/hinged wardrobe shutter'),
  ('Kitchen Door', 'Kitchen shutter/cabinet door'),
  ('Shop Front', 'Storefront glazing system'),
  ('Curtain Wall', 'Structural facade glazing'),
  ('Pergola', 'Outdoor aluminium structure'),
  ('Custom Structure', 'Anything not covered above');

INSERT INTO door_architectures (name, description, uses_track, uses_hinges) VALUES
  ('Openable', 'Side-hinged swing', 0, 1),
  ('Sliding', 'Horizontal sliding panels on a track', 1, 0),
  ('Fixed', 'Non-operable', 0, 0),
  ('Bi-Fold', 'Folding panel set', 1, 1),
  ('Pivot', 'Rotates on a top/bottom pivot point, not side hinges', 0, 1),
  ('French', 'Paired hinged doors opening from the centre', 0, 1),
  ('Pocket Door', 'Slides into a wall cavity', 1, 0);

INSERT INTO panel_configurations (code, label, total_panels, track_count, is_heavy_duty) VALUES
  ('1+1', '1+1 (1 fixed + 1 sliding)', 2, 2, 0),
  ('1+2', '1+2 (1 fixed + 2 sliding)', 3, 2, 0),
  ('1+3', '1+3 (1 fixed + 3 sliding)', 4, 2, 1),
  ('2+2', '2+2', 4, 2, 1),
  ('2+3', '2+3', 5, 2, 1),
  ('2+4', '2+4', 6, 2, 1),
  ('3_track', '3 Track', 3, 3, 1),
  ('4_track', '4 Track', 4, 4, 1),
  ('6_track', '6 Track', 6, 6, 1),
  ('custom', 'Custom', 1, 1, 0);

INSERT INTO finish_price_groups (name, multiplier) VALUES
  ('Standard RAL', 1.0),
  ('Designer RAL', 1.1),
  ('Metallic RAL', 1.15),
  ('Bespoke RAL', 1.2),
  ('Textured/Wood RAL', 1.25);

INSERT INTO profile_finishes (name, group_id, swatch_hex) VALUES
  ('Black', (SELECT id FROM finish_price_groups WHERE name = 'Standard RAL'), '#1a1a1a'),
  ('Brush Gold', (SELECT id FROM finish_price_groups WHERE name = 'Metallic RAL'), '#b08d57'),
  ('Rose Gold', (SELECT id FROM finish_price_groups WHERE name = 'Metallic RAL'), '#b76e79'),
  ('Grey', (SELECT id FROM finish_price_groups WHERE name = 'Standard RAL'), '#808080'),
  ('Champagne', (SELECT id FROM finish_price_groups WHERE name = 'Designer RAL'), '#d4b896'),
  ('Silver', (SELECT id FROM finish_price_groups WHERE name = 'Standard RAL'), '#c0c0c0'),
  ('White', (SELECT id FROM finish_price_groups WHERE name = 'Standard RAL'), '#ffffff'),
  ('Wood Finish', (SELECT id FROM finish_price_groups WHERE name = 'Textured/Wood RAL'), '#8b5a2b'),
  ('Custom RAL', (SELECT id FROM finish_price_groups WHERE name = 'Bespoke RAL'), '#888888');

INSERT INTO profile_series (name, system_type_id, description) VALUES
  ('Slimflow Slide-60', (SELECT id FROM system_types WHERE name = 'Sliding Door'), '60mm sliding door/window series'),
  ('Slimflow Case-45', (SELECT id FROM system_types WHERE name = 'Openable Door'), '45mm casement/openable series');

INSERT INTO profile_roles (name, orientation, scaling_rule, fixed_qty) VALUES
  ('Top Profile', 'horizontal', 'fixed', 1),
  ('Bottom Profile', 'horizontal', 'fixed', 1),
  ('Left Profile', 'vertical', 'fixed', 1),
  ('Right Profile', 'vertical', 'fixed', 1),
  ('Centre Divider', 'vertical', 'per_divider', 0),
  ('Horizontal Divider', 'horizontal', 'fixed', 0),
  ('Glass Bead', 'vertical', 'fixed', 1),
  ('Clip', 'vertical', 'fixed', 1),
  ('Cover Profile', 'horizontal', 'fixed', 1);

INSERT INTO profiles (series_id, role_id, name, weight_per_metre_kg, rate_per_kg)
  SELECT s.id, r.id, v.name, v.weight, v.rate
  FROM (VALUES
    ('Slimflow Slide-60', 'Top Profile', 'Slide-60 Top Track Profile', 1.8, 320),
    ('Slimflow Slide-60', 'Bottom Profile', 'Slide-60 Bottom Track Profile', 2.0, 320),
    ('Slimflow Slide-60', 'Left Profile', 'Slide-60 Left Jamb', 1.6, 320),
    ('Slimflow Slide-60', 'Right Profile', 'Slide-60 Right Jamb', 1.6, 320),
    ('Slimflow Slide-60', 'Centre Divider', 'Slide-60 Centre Divider', 1.7, 320),
    ('Slimflow Slide-60', 'Glass Bead', 'Slide-60 Glass Bead', 0.3, 320),
    ('Slimflow Slide-60', 'Clip', 'Slide-60 Interlock Clip', 0.1, 320),
    ('Slimflow Slide-60', 'Cover Profile', 'Slide-60 Cover Cap', 0.5, 320),
    ('Slimflow Case-45', 'Top Profile', 'Case-45 Top Profile', 1.3, 320),
    ('Slimflow Case-45', 'Bottom Profile', 'Case-45 Bottom Profile', 1.4, 320),
    ('Slimflow Case-45', 'Left Profile', 'Case-45 Left Jamb', 1.2, 320),
    ('Slimflow Case-45', 'Right Profile', 'Case-45 Right Jamb', 1.2, 320),
    ('Slimflow Case-45', 'Centre Divider', 'Case-45 Mullion', 1.3, 320),
    ('Slimflow Case-45', 'Glass Bead', 'Case-45 Glass Bead', 0.25, 320),
    ('Slimflow Case-45', 'Clip', 'Case-45 Clip', 0.1, 320),
    ('Slimflow Case-45', 'Cover Profile', 'Case-45 Cover Cap', 0.4, 320)
  ) AS v(series_name, role_name, name, weight, rate)
  JOIN profile_series s ON s.name = v.series_name
  JOIN profile_roles r ON r.name = v.role_name;

INSERT INTO track_master (name, duty_class, max_capacity_kg, max_span_mm, rate_per_metre) VALUES
  ('Light Duty Track', 'light', 40, 1500, 180),
  ('Medium Duty Track', 'medium', 80, 2200, 260),
  ('Heavy Duty Track', 'heavy', 150, 3000, 380),
  ('Ultra Heavy Track', 'ultra_heavy', 300, 4000, 520),
  ('Soft Close Track', 'soft_close', 100, 2500, 450);

INSERT INTO frame_master (name, duty_class, max_capacity_kg, rate_per_metre) VALUES
  ('Light Frame', 'light', 60, 150),
  ('Medium Frame', 'medium', 120, 220),
  ('Heavy Frame', 'heavy', 200, 310),
  ('Extra Heavy Frame', 'extra_heavy', 350, 420);

INSERT INTO hinge_master (name, hinge_type, max_capacity_kg, rate_per_unit) VALUES
  ('Normal Hinge', 'normal', 25, 40),
  ('Concealed Hinge', 'concealed', 40, 120),
  ('Pivot Hinge', 'pivot', 80, 350),
  ('Hydraulic Hinge', 'hydraulic', 60, 500),
  ('Soft Close Hinge', 'soft_close', 45, 280),
  ('Heavy Duty Hinge', 'heavy_duty', 100, 600);

INSERT INTO handle_master (name, handle_type, applicable_door_types, rate_per_unit) VALUES
  ('Square Handle', 'square', '["Openable","Sliding","Fixed"]', 350),
  ('Round Handle', 'round', '["Openable"]', 300),
  ('Pull Handle', 'pull', '["Sliding","Openable","Pivot"]', 450),
  ('D Handle', 'd_handle', '["Openable","Pivot"]', 400),
  ('Flush Handle', 'flush', '["Sliding","Pocket Door"]', 250),
  ('Shower Handle', 'shower', '["Fixed"]', 600),
  ('Hidden Handle', 'hidden', '["Sliding","Pocket Door"]', 500),
  ('Profile Handle', 'profile', '["Sliding"]', 200);

INSERT INTO lock_master (name, lock_type, applicable_door_types, rate_per_unit) VALUES
  ('Sliding Lock', 'sliding', '["Sliding"]', 300),
  ('Mortise Lock', 'mortise', '["Openable","French"]', 450),
  ('Cylinder Lock', 'cylinder', '["Openable"]', 350),
  ('Dead Lock', 'dead_lock', '["Openable"]', 400),
  ('Magnetic Lock', 'magnetic', '["Sliding","Fixed"]', 550),
  ('Glass Door Lock', 'glass_door', '["Pivot","Fixed"]', 700);

INSERT INTO connector_master (name, connector_type, rate_per_unit) VALUES
  ('Frame Connector', 'frame', 80),
  ('Divider Connector', 'divider', 90),
  ('90 Degree Connector', 'corner', 60),
  ('135 Degree Connector', 'corner', 70),
  ('T Connector', 'junction', 65),
  ('L Connector', 'junction', 55),
  ('Corner Connector', 'corner', 50),
  ('Expansion Connector', 'expansion', 100),
  ('Hidden Connector', 'hidden', 120);

INSERT INTO seal_master (name, rate_per_metre) VALUES
  ('EPDM Seal', 12),
  ('Wool Pile Seal', 15),
  ('Silicone Seal', 18);

INSERT INTO tape_master (name, rate_per_sqft) VALUES
  ('Double Side Tape 3M', 8),
  ('Double Side Tape Structural', 14);

INSERT INTO glass_master (name, glass_type, thickness_mm, weight_per_sqft_kg, rate_per_sqft) VALUES
  ('Clear 5mm', 'clear', 5, 1.2, 65),
  ('Clear 8mm', 'clear', 8, 1.9, 85),
  ('Toughened 12mm', 'toughened', 12, 2.9, 130),
  ('Double Glazed 24mm', 'double_glazed', 24, 5.8, 280),
  ('Frosted 6mm', 'frosted', 6, 1.4, 75),
  ('Laminated 8.38mm', 'laminated', 8.38, 2.0, 150);

INSERT INTO glass_bead_master (name, min_thickness_mm, max_thickness_mm, weight_per_metre_kg, rate_per_metre) VALUES
  ('Bead 4-6mm', 0, 6.5, 0.15, 70),
  ('Bead 7-9mm', 6.5, 9.5, 0.2, 90),
  ('Bead 10-14mm', 9.5, 14, 0.28, 120),
  ('Bead 20-26mm', 14, 30, 0.4, 180);

INSERT INTO accessory_master (name, unit, rate) VALUES
  ('Silicone Sealant Tube', 'pcs', 180),
  ('Weep Hole Cover', 'pcs', 5),
  ('End Cap', 'pcs', 15),
  ('Corner Key', 'pcs', 25);

INSERT INTO track_recommendation_rules (min_door_weight_kg, max_door_weight_kg, requires_heavy_duty_config, max_span_mm, recommended_track_id, priority) VALUES
  (0, NULL, 0, NULL, (SELECT id FROM track_master WHERE name = 'Light Duty Track'), 1),
  (0, NULL, 1, NULL, (SELECT id FROM track_master WHERE name = 'Heavy Duty Track'), 5),
  (200, NULL, NULL, NULL, (SELECT id FROM track_master WHERE name = 'Ultra Heavy Track'), 10);

INSERT INTO frame_recommendation_rules (min_height_mm, max_height_mm, min_width_mm, max_width_mm, min_total_weight_kg, recommended_frame_id, priority) VALUES
  (0, NULL, 0, NULL, 0, (SELECT id FROM frame_master WHERE name = 'Light Frame'), 1),
  (2400, NULL, 0, NULL, 0, (SELECT id FROM frame_master WHERE name = 'Medium Frame'), 6),
  (0, NULL, 0, NULL, 100, (SELECT id FROM frame_master WHERE name = 'Medium Frame'), 5),
  (3000, NULL, 0, NULL, 0, (SELECT id FROM frame_master WHERE name = 'Heavy Frame'), 11),
  (0, NULL, 0, NULL, 200, (SELECT id FROM frame_master WHERE name = 'Heavy Frame'), 10),
  (0, NULL, 0, NULL, 300, (SELECT id FROM frame_master WHERE name = 'Extra Heavy Frame'), 15);

INSERT INTO hinge_recommendation_rules (door_architecture_id, min_door_weight_kg, max_door_weight_kg, recommended_hinge_id, priority) VALUES
  ((SELECT id FROM door_architectures WHERE name = 'Openable'), 0, NULL, (SELECT id FROM hinge_master WHERE name = 'Concealed Hinge'), 1),
  ((SELECT id FROM door_architectures WHERE name = 'Openable'), 40, NULL, (SELECT id FROM hinge_master WHERE name = 'Heavy Duty Hinge'), 5),
  ((SELECT id FROM door_architectures WHERE name = 'Pivot'), 0, NULL, (SELECT id FROM hinge_master WHERE name = 'Pivot Hinge'), 1),
  ((SELECT id FROM door_architectures WHERE name = 'Bi-Fold'), 0, NULL, (SELECT id FROM hinge_master WHERE name = 'Normal Hinge'), 1),
  ((SELECT id FROM door_architectures WHERE name = 'French'), 0, NULL, (SELECT id FROM hinge_master WHERE name = 'Concealed Hinge'), 1);

INSERT INTO floor_spring_master (name, spring_type, max_capacity_kg, rate_per_unit) VALUES
  ('Floor Pivot', 'floor_pivot', 60, 800),
  ('Hydraulic Floor Spring', 'hydraulic_floor_spring', 120, 2200),
  ('Top Pivot', 'top_pivot', 60, 350),
  ('Bottom Pivot', 'bottom_pivot', 60, 350);

INSERT INTO pricing_rules (waste_percent, margin_percent) VALUES (5, 18);

INSERT INTO floor_spring_recommendation_rules (door_architecture_id, min_door_weight_kg, max_door_weight_kg, recommended_floor_spring_id, priority) VALUES
  ((SELECT id FROM door_architectures WHERE name = 'Pivot'), 0, NULL, (SELECT id FROM floor_spring_master WHERE name = 'Floor Pivot'), 1),
  ((SELECT id FROM door_architectures WHERE name = 'Pivot'), 60, NULL, (SELECT id FROM floor_spring_master WHERE name = 'Hydraulic Floor Spring'), 5);

INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation)
  SELECT m.name || ' requires ' || arch.value, m.subject_table, m.id, 'door_architectures', arch2.id, 'requires'
  FROM (
    SELECT id, name, applicable_door_types, 'lock_master' AS subject_table FROM lock_master
    UNION ALL
    SELECT id, name, applicable_door_types, 'handle_master' AS subject_table FROM handle_master
  ) m
  CROSS JOIN LATERAL jsonb_array_elements_text(m.applicable_door_types::jsonb) AS arch(value)
  JOIN door_architectures arch2 ON arch2.name = arch.value
  WHERE m.name != 'Shower Handle';

INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation) VALUES
  ('Shower Handle requires Shower Cubicle', 'handle_master', (SELECT id FROM handle_master WHERE name = 'Shower Handle'), 'system_types', (SELECT id FROM system_types WHERE name = 'Shower Cubicle'), 'requires'),
  ('Shower Handle requires Fixed Glass', 'handle_master', (SELECT id FROM handle_master WHERE name = 'Shower Handle'), 'system_types', (SELECT id FROM system_types WHERE name = 'Fixed Glass'), 'requires'),
  ('Pivot Hinge excludes Sliding', 'hinge_master', (SELECT id FROM hinge_master WHERE name = 'Pivot Hinge'), 'door_architectures', (SELECT id FROM door_architectures WHERE name = 'Sliding'), 'excludes'),
  ('Hidden Handle requires Slimflow Slide-60', 'handle_master', (SELECT id FROM handle_master WHERE name = 'Hidden Handle'), 'profile_series', (SELECT id FROM profile_series WHERE name = 'Slimflow Slide-60'), 'requires'),
  ('Concealed Hinge requires Slimflow Case-45', 'hinge_master', (SELECT id FROM hinge_master WHERE name = 'Concealed Hinge'), 'profile_series', (SELECT id FROM profile_series WHERE name = 'Slimflow Case-45'), 'requires');

INSERT INTO hardware_set_master (name, hinge_id, floor_spring_id, handle_id, lock_id, rate_per_set) VALUES
  ('Sliding Economy Set', NULL, NULL, (SELECT id FROM handle_master WHERE name = 'Profile Handle'), (SELECT id FROM lock_master WHERE name = 'Sliding Lock'), 450),
  ('Sliding Premium Set', NULL, NULL, (SELECT id FROM handle_master WHERE name = 'Pull Handle'), (SELECT id FROM lock_master WHERE name = 'Magnetic Lock'), 850),
  ('Openable Standard Set', (SELECT id FROM hinge_master WHERE name = 'Concealed Hinge'), NULL, (SELECT id FROM handle_master WHERE name = 'Square Handle'), (SELECT id FROM lock_master WHERE name = 'Cylinder Lock'), 700),
  ('Openable Heavy Duty Set', (SELECT id FROM hinge_master WHERE name = 'Heavy Duty Hinge'), NULL, (SELECT id FROM handle_master WHERE name = 'Square Handle'), (SELECT id FROM lock_master WHERE name = 'Dead Lock'), 1400),
  ('Pivot Door Set', NULL, (SELECT id FROM floor_spring_master WHERE name = 'Floor Pivot'), (SELECT id FROM handle_master WHERE name = 'D Handle'), (SELECT id FROM lock_master WHERE name = 'Glass Door Lock'), 1600);

INSERT INTO hardware_set_recommendation_rules (door_architecture_id, profile_series_id, min_door_weight_kg, max_door_weight_kg, recommended_hardware_set_id, priority) VALUES
  ((SELECT id FROM door_architectures WHERE name = 'Sliding'), NULL, 0, 40, (SELECT id FROM hardware_set_master WHERE name = 'Sliding Economy Set'), 1),
  ((SELECT id FROM door_architectures WHERE name = 'Sliding'), NULL, 40, NULL, (SELECT id FROM hardware_set_master WHERE name = 'Sliding Premium Set'), 5),
  ((SELECT id FROM door_architectures WHERE name = 'Openable'), NULL, 0, 40, (SELECT id FROM hardware_set_master WHERE name = 'Openable Standard Set'), 1),
  ((SELECT id FROM door_architectures WHERE name = 'Openable'), NULL, 40, NULL, (SELECT id FROM hardware_set_master WHERE name = 'Openable Heavy Duty Set'), 5),
  ((SELECT id FROM door_architectures WHERE name = 'Pivot'), NULL, 0, NULL, (SELECT id FROM hardware_set_master WHERE name = 'Pivot Door Set'), 1);

INSERT INTO rate_master (id, data) VALUES (1, '{
  "currency": "INR",
  "profileRatePerKg": 320,
  "profileWeightPerMetreKg": 1.6,
  "barLengthM": 6,
  "glassRatePerSqft": 85,
  "acpRatePerSqft": 110,
  "wpcRatePerSqft": 95,
  "hardwareSetRate": 450,
  "hingeRate": 60,
  "fastenerRatePerUnit": 4,
  "fastenersPerMetre": 3,
  "labourRatePerSqft": 35,
  "wastePercent": 5,
  "marginPercent": 18
}'::jsonb);
