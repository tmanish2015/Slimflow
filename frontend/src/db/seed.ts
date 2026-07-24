import { query, queryOne, run } from './engine'

/**
 * Seeds representative master data for every table so the recommendation
 * rules have something real to evaluate against. Idempotent — skips
 * entirely if system_types already has rows, so reloads don't duplicate
 * data or clobber admin edits made through the admin UI. Ported unchanged
 * from the app's original (pre-Postgres) seed.ts.
 */
export function seedIfEmpty(): void {
  const count = queryOne<{ n: number }>('SELECT COUNT(*) as n FROM system_types')
  if (count && count.n > 0) return

  const insertMany = (sql: string, rows: unknown[][]) => {
    for (const row of rows) run(sql, row)
  }

  insertMany('INSERT INTO system_types (name, description) VALUES (?, ?)', [
    ['Openable Door', 'Hinged single/double door leaf'],
    ['Sliding Door', 'Horizontally sliding door panels'],
    ['Sliding Window', 'Horizontally sliding window panels'],
    ['Openable Window', 'Hinged/casement window'],
    ['Fixed Glass', 'Non-operable glazed panel'],
    ['Partition', 'Internal glazed partition wall'],
    ['Shower Cubicle', 'Frameless/semi-framed shower enclosure'],
    ['Wardrobe Door', 'Sliding/hinged wardrobe shutter'],
    ['Kitchen Door', 'Kitchen shutter/cabinet door'],
    ['Shop Front', 'Storefront glazing system'],
    ['Curtain Wall', 'Structural facade glazing'],
    ['Pergola', 'Outdoor aluminium structure'],
    ['Custom Structure', 'Anything not covered above'],
  ])

  insertMany('INSERT INTO door_architectures (name, description, uses_track, uses_hinges) VALUES (?, ?, ?, ?)', [
    ['Openable', 'Side-hinged swing', 0, 1],
    ['Sliding', 'Horizontal sliding panels on a track', 1, 0],
    ['Fixed', 'Non-operable', 0, 0],
    ['Bi-Fold', 'Folding panel set', 1, 1],
    ['Pivot', 'Rotates on a top/bottom pivot point, not side hinges', 0, 1],
    ['French', 'Paired hinged doors opening from the centre', 0, 1],
    ['Pocket Door', 'Slides into a wall cavity', 1, 0],
  ])

  insertMany(
    'INSERT INTO panel_configurations (code, label, total_panels, track_count, is_heavy_duty) VALUES (?, ?, ?, ?, ?)',
    [
      ['1+1', '1+1 (1 fixed + 1 sliding)', 2, 2, 0],
      ['1+2', '1+2 (1 fixed + 2 sliding)', 3, 2, 0],
      ['1+3', '1+3 (1 fixed + 3 sliding)', 4, 2, 1],
      ['2+2', '2+2', 4, 2, 1],
      ['2+3', '2+3', 5, 2, 1],
      ['2+4', '2+4', 6, 2, 1],
      ['3_track', '3 Track', 3, 3, 1],
      ['4_track', '4 Track', 4, 4, 1],
      ['6_track', '6 Track', 6, 6, 1],
      ['custom', 'Custom', 1, 1, 0],
    ],
  )

  insertMany('INSERT INTO finish_price_groups (name, multiplier) VALUES (?, ?)', [
    ['Standard RAL', 1.0],
    ['Designer RAL', 1.1],
    ['Metallic RAL', 1.15],
    ['Bespoke RAL', 1.2],
    ['Textured/Wood RAL', 1.25],
  ])
  const groupId = (name: string): number => queryOne<{ id: number }>('SELECT id FROM finish_price_groups WHERE name = ?', [name])!.id

  insertMany('INSERT INTO profile_finishes (name, group_id, swatch_hex) VALUES (?, ?, ?)', [
    ['Black', groupId('Standard RAL'), '#1a1a1a'],
    ['Brush Gold', groupId('Metallic RAL'), '#b08d57'],
    ['Rose Gold', groupId('Metallic RAL'), '#b76e79'],
    ['Grey', groupId('Standard RAL'), '#808080'],
    ['Champagne', groupId('Designer RAL'), '#d4b896'],
    ['Silver', groupId('Standard RAL'), '#c0c0c0'],
    ['White', groupId('Standard RAL'), '#ffffff'],
    ['Wood Finish', groupId('Textured/Wood RAL'), '#8b5a2b'],
    ['Custom RAL', groupId('Bespoke RAL'), '#888888'],
  ])

  insertMany('INSERT INTO profile_series (name, system_type_id, description) VALUES (?, ?, ?)', [
    ['Slimflow Slide-60', 2, '60mm sliding door/window series'],
    ['Slimflow Case-45', 1, '45mm casement/openable series'],
  ])

  insertMany('INSERT INTO profile_roles (name, orientation, scaling_rule, fixed_qty) VALUES (?, ?, ?, ?)', [
    ['Top Profile', 'horizontal', 'fixed', 1],
    ['Bottom Profile', 'horizontal', 'fixed', 1],
    ['Left Profile', 'vertical', 'fixed', 1],
    ['Right Profile', 'vertical', 'fixed', 1],
    ['Centre Divider', 'vertical', 'per_divider', 0],
    ['Horizontal Divider', 'horizontal', 'fixed', 0],
    ['Glass Bead', 'vertical', 'fixed', 1],
    ['Clip', 'vertical', 'fixed', 1],
    ['Cover Profile', 'horizontal', 'fixed', 1],
  ])

  insertMany('INSERT INTO profiles (series_id, role_id, name, weight_per_metre_kg, rate_per_kg) VALUES (?, ?, ?, ?, ?)', [
    [1, 1, 'Slide-60 Top Track Profile', 1.8, 320],
    [1, 2, 'Slide-60 Bottom Track Profile', 2.0, 320],
    [1, 3, 'Slide-60 Left Jamb', 1.6, 320],
    [1, 4, 'Slide-60 Right Jamb', 1.6, 320],
    [1, 5, 'Slide-60 Centre Divider', 1.7, 320],
    [1, 7, 'Slide-60 Glass Bead', 0.3, 320],
    [1, 8, 'Slide-60 Interlock Clip', 0.1, 320],
    [1, 9, 'Slide-60 Cover Cap', 0.5, 320],
    [2, 1, 'Case-45 Top Profile', 1.3, 320],
    [2, 2, 'Case-45 Bottom Profile', 1.4, 320],
    [2, 3, 'Case-45 Left Jamb', 1.2, 320],
    [2, 4, 'Case-45 Right Jamb', 1.2, 320],
    [2, 5, 'Case-45 Mullion', 1.3, 320],
    [2, 7, 'Case-45 Glass Bead', 0.25, 320],
    [2, 8, 'Case-45 Clip', 0.1, 320],
    [2, 9, 'Case-45 Cover Cap', 0.4, 320],
  ])

  insertMany('INSERT INTO track_master (name, duty_class, max_capacity_kg, max_span_mm, rate_per_metre) VALUES (?, ?, ?, ?, ?)', [
    ['Light Duty Track', 'light', 40, 1500, 180],
    ['Medium Duty Track', 'medium', 80, 2200, 260],
    ['Heavy Duty Track', 'heavy', 150, 3000, 380],
    ['Ultra Heavy Track', 'ultra_heavy', 300, 4000, 520],
    ['Soft Close Track', 'soft_close', 100, 2500, 450],
  ])

  insertMany('INSERT INTO frame_master (name, duty_class, max_capacity_kg, rate_per_metre) VALUES (?, ?, ?, ?)', [
    ['Light Frame', 'light', 60, 150],
    ['Medium Frame', 'medium', 120, 220],
    ['Heavy Frame', 'heavy', 200, 310],
    ['Extra Heavy Frame', 'extra_heavy', 350, 420],
  ])

  insertMany('INSERT INTO hinge_master (name, hinge_type, max_capacity_kg, rate_per_unit) VALUES (?, ?, ?, ?)', [
    ['Normal Hinge', 'normal', 25, 40],
    ['Concealed Hinge', 'concealed', 40, 120],
    ['Pivot Hinge', 'pivot', 80, 350],
    ['Hydraulic Hinge', 'hydraulic', 60, 500],
    ['Soft Close Hinge', 'soft_close', 45, 280],
    ['Heavy Duty Hinge', 'heavy_duty', 100, 600],
  ])

  insertMany('INSERT INTO handle_master (name, handle_type, applicable_door_types, rate_per_unit) VALUES (?, ?, ?, ?)', [
    ['Square Handle', 'square', JSON.stringify(['Openable', 'Sliding', 'Fixed']), 350],
    ['Round Handle', 'round', JSON.stringify(['Openable']), 300],
    ['Pull Handle', 'pull', JSON.stringify(['Sliding', 'Openable', 'Pivot']), 450],
    ['D Handle', 'd_handle', JSON.stringify(['Openable', 'Pivot']), 400],
    ['Flush Handle', 'flush', JSON.stringify(['Sliding', 'Pocket Door']), 250],
    ['Shower Handle', 'shower', JSON.stringify(['Fixed']), 600],
    ['Hidden Handle', 'hidden', JSON.stringify(['Sliding', 'Pocket Door']), 500],
    ['Profile Handle', 'profile', JSON.stringify(['Sliding']), 200],
  ])

  insertMany('INSERT INTO lock_master (name, lock_type, applicable_door_types, rate_per_unit) VALUES (?, ?, ?, ?)', [
    ['Sliding Lock', 'sliding', JSON.stringify(['Sliding']), 300],
    ['Mortise Lock', 'mortise', JSON.stringify(['Openable', 'French']), 450],
    ['Cylinder Lock', 'cylinder', JSON.stringify(['Openable']), 350],
    ['Dead Lock', 'dead_lock', JSON.stringify(['Openable']), 400],
    ['Magnetic Lock', 'magnetic', JSON.stringify(['Sliding', 'Fixed']), 550],
    ['Glass Door Lock', 'glass_door', JSON.stringify(['Pivot', 'Fixed']), 700],
  ])

  insertMany('INSERT INTO connector_master (name, connector_type, rate_per_unit) VALUES (?, ?, ?)', [
    ['Frame Connector', 'frame', 80],
    ['Divider Connector', 'divider', 90],
    ['90 Degree Connector', 'corner', 60],
    ['135 Degree Connector', 'corner', 70],
    ['T Connector', 'junction', 65],
    ['L Connector', 'junction', 55],
    ['Corner Connector', 'corner', 50],
    ['Expansion Connector', 'expansion', 100],
    ['Hidden Connector', 'hidden', 120],
  ])

  insertMany('INSERT INTO seal_master (name, rate_per_metre) VALUES (?, ?)', [
    ['EPDM Seal', 12],
    ['Wool Pile Seal', 15],
    ['Silicone Seal', 18],
  ])

  insertMany('INSERT INTO tape_master (name, rate_per_sqft) VALUES (?, ?)', [
    ['Double Side Tape 3M', 8],
    ['Double Side Tape Structural', 14],
  ])

  insertMany('INSERT INTO glass_master (name, glass_type, thickness_mm, weight_per_sqft_kg, rate_per_sqft) VALUES (?, ?, ?, ?, ?)', [
    ['Clear 5mm', 'clear', 5, 1.2, 65],
    ['Clear 8mm', 'clear', 8, 1.9, 85],
    ['Toughened 12mm', 'toughened', 12, 2.9, 130],
    ['Double Glazed 24mm', 'double_glazed', 24, 5.8, 280],
    ['Frosted 6mm', 'frosted', 6, 1.4, 75],
    ['Laminated 8.38mm', 'laminated', 8.38, 2.0, 150],
  ])

  insertMany('INSERT INTO glass_bead_master (name, min_thickness_mm, max_thickness_mm, weight_per_metre_kg, rate_per_metre) VALUES (?, ?, ?, ?, ?)', [
    ['Bead 4-6mm', 0, 6.5, 0.15, 70],
    ['Bead 7-9mm', 6.5, 9.5, 0.2, 90],
    ['Bead 10-14mm', 9.5, 14, 0.28, 120],
    ['Bead 20-26mm', 14, 30, 0.4, 180],
  ])

  insertMany('INSERT INTO accessory_master (name, unit, rate) VALUES (?, ?, ?)', [
    ['Silicone Sealant Tube', 'pcs', 180],
    ['Weep Hole Cover', 'pcs', 5],
    ['End Cap', 'pcs', 15],
    ['Corner Key', 'pcs', 25],
  ])

  // track ids: 1 Light, 2 Medium, 3 Heavy, 4 Ultra Heavy, 5 Soft Close
  insertMany(
    'INSERT INTO track_recommendation_rules (min_door_weight_kg, max_door_weight_kg, requires_heavy_duty_config, max_span_mm, recommended_track_id, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [
      [0, null, 0, null, 1, 1],
      [0, null, 1, null, 3, 5],
      [200, null, null, null, 4, 10],
    ],
  )

  // frame ids: 1 Light, 2 Medium, 3 Heavy, 4 Extra Heavy
  insertMany(
    'INSERT INTO frame_recommendation_rules (min_height_mm, max_height_mm, min_width_mm, max_width_mm, min_total_weight_kg, recommended_frame_id, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      [0, null, 0, null, 0, 1, 1],
      [2400, null, 0, null, 0, 2, 6],
      [0, null, 0, null, 100, 2, 5],
      [3000, null, 0, null, 0, 3, 11],
      [0, null, 0, null, 200, 3, 10],
      [0, null, 0, null, 300, 4, 15],
    ],
  )

  // hinge ids: 1 Normal, 2 Concealed, 3 Pivot, 4 Hydraulic, 5 Soft Close, 6 Heavy Duty
  // door_architecture ids: 1 Openable, 2 Sliding, 3 Fixed, 4 Bi-Fold, 5 Pivot, 6 French, 7 Pocket Door
  insertMany(
    'INSERT INTO hinge_recommendation_rules (door_architecture_id, min_door_weight_kg, max_door_weight_kg, recommended_hinge_id, priority) VALUES (?, ?, ?, ?, ?)',
    [
      [1, 0, null, 2, 1],
      [1, 40, null, 6, 5],
      [5, 0, null, 3, 1],
      [4, 0, null, 1, 1],
      [6, 0, null, 2, 1],
    ],
  )

  insertMany('INSERT INTO floor_spring_master (name, spring_type, max_capacity_kg, rate_per_unit) VALUES (?, ?, ?, ?)', [
    ['Floor Pivot', 'floor_pivot', 60, 800],
    ['Hydraulic Floor Spring', 'hydraulic_floor_spring', 120, 2200],
    ['Top Pivot', 'top_pivot', 60, 350],
    ['Bottom Pivot', 'bottom_pivot', 60, 350],
  ])

  run('INSERT INTO pricing_rules (waste_percent, margin_percent) VALUES (?, ?)', [5, 18])

  // floor_spring ids: 1 Floor Pivot, 2 Hydraulic Floor Spring, 3 Top Pivot, 4 Bottom Pivot
  // door_architecture id 5 = Pivot — the only architecture with floor springs in this model.
  insertMany(
    'INSERT INTO floor_spring_recommendation_rules (door_architecture_id, min_door_weight_kg, max_door_weight_kg, recommended_floor_spring_id, priority) VALUES (?, ?, ?, ?, ?)',
    [
      [5, 0, null, 1, 1],
      [5, 60, null, 2, 5],
    ],
  )

  seedCompatibilityRules()
  seedSeriesCompatibilityRules()
  seedHardwareSets()

  run('INSERT INTO rate_master (id, data) VALUES (1, ?)', [
    JSON.stringify({
      currency: 'INR',
      profileRatePerKg: 320,
      profileWeightPerMetreKg: 1.6,
      barLengthM: 6,
      glassRatePerSqft: 85,
      acpRatePerSqft: 110,
      wpcRatePerSqft: 95,
      hardwareSetRate: 450,
      hingeRate: 60,
      fastenerRatePerUnit: 4,
      fastenersPerMetre: 3,
      labourRatePerSqft: 35,
      wastePercent: 5,
      marginPercent: 18,
    }),
  ])
}

function idByName(table: string, name: string): number {
  const row = queryOne<{ id: number }>(`SELECT id FROM ${table} WHERE name = ?`, [name])
  if (!row) throw new Error(`Seed error: no row named "${name}" in ${table}`)
  return row.id
}

/** `requires` rows for the same subject are OR'd within one constraint_table
 * but AND'd across different constraint_tables; `excludes` rows are
 * absolute. See services/configurator/compatibility.ts for the evaluator. */
function seedCompatibilityRules() {
  for (const masterTable of ['lock_master', 'handle_master'] as const) {
    const rows = query<{ id: number; name: string; applicable_door_types: string }>(
      `SELECT id, name, applicable_door_types FROM ${masterTable}`,
    )
    for (const row of rows) {
      if (row.name === 'Shower Handle') continue
      const architectureNames = JSON.parse(row.applicable_door_types) as string[]
      for (const archName of architectureNames) {
        run(
          `INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`${row.name} requires ${archName}`, masterTable, row.id, 'door_architectures', idByName('door_architectures', archName), 'requires'],
        )
      }
    }
  }

  const showerHandleId = idByName('handle_master', 'Shower Handle')
  for (const systemType of ['Shower Cubicle', 'Fixed Glass']) {
    run(
      `INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`Shower Handle requires ${systemType}`, 'handle_master', showerHandleId, 'system_types', idByName('system_types', systemType), 'requires'],
    )
  }

  run(
    `INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'Pivot Hinge excludes Sliding',
      'hinge_master',
      idByName('hinge_master', 'Pivot Hinge'),
      'door_architectures',
      idByName('door_architectures', 'Sliding'),
      'excludes',
    ],
  )
}

/** Series-gated hardware: some hardware is physically tied to one profile's
 * section geometry, not just to a door architecture. */
function seedSeriesCompatibilityRules() {
  run(
    `INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'Hidden Handle requires Slimflow Slide-60',
      'handle_master',
      idByName('handle_master', 'Hidden Handle'),
      'profile_series',
      idByName('profile_series', 'Slimflow Slide-60'),
      'requires',
    ],
  )
  run(
    `INSERT INTO compatibility_rules (rule_name, subject_table, subject_id, constraint_table, constraint_id, relation)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'Concealed Hinge requires Slimflow Case-45',
      'hinge_master',
      idByName('hinge_master', 'Concealed Hinge'),
      'profile_series',
      idByName('profile_series', 'Slimflow Case-45'),
      'requires',
    ],
  )
}

/** OEM-style bundled hardware kits (hinge+floor-spring+handle+lock priced as
 * one SKU) plus the rule bands that pick one by architecture + door weight. */
function seedHardwareSets() {
  const hingeId = (name: string) => idByName('hinge_master', name)
  const floorSpringId = (name: string) => idByName('floor_spring_master', name)
  const handleId = (name: string) => idByName('handle_master', name)
  const lockId = (name: string) => idByName('lock_master', name)
  const insertSet = (row: unknown[]) =>
    run(
      `INSERT INTO hardware_set_master (name, hinge_id, floor_spring_id, handle_id, lock_id, rate_per_set)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row,
    )

  insertSet(['Sliding Economy Set', null, null, handleId('Profile Handle'), lockId('Sliding Lock'), 450])
  insertSet(['Sliding Premium Set', null, null, handleId('Pull Handle'), lockId('Magnetic Lock'), 850])
  insertSet(['Openable Standard Set', hingeId('Concealed Hinge'), null, handleId('Square Handle'), lockId('Cylinder Lock'), 700])
  insertSet(['Openable Heavy Duty Set', hingeId('Heavy Duty Hinge'), null, handleId('Square Handle'), lockId('Dead Lock'), 1400])
  insertSet(['Pivot Door Set', null, floorSpringId('Floor Pivot'), handleId('D Handle'), lockId('Glass Door Lock'), 1600])

  const archId = (name: string) => idByName('door_architectures', name)
  const setId = (name: string) => idByName('hardware_set_master', name)
  const insertRule = (row: unknown[]) =>
    run(
      `INSERT INTO hardware_set_recommendation_rules
        (door_architecture_id, profile_series_id, min_door_weight_kg, max_door_weight_kg, recommended_hardware_set_id, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row,
    )

  insertRule([archId('Sliding'), null, 0, 40, setId('Sliding Economy Set'), 1])
  insertRule([archId('Sliding'), null, 40, null, setId('Sliding Premium Set'), 5])
  insertRule([archId('Openable'), null, 0, 40, setId('Openable Standard Set'), 1])
  insertRule([archId('Openable'), null, 40, null, setId('Openable Heavy Duty Set'), 5])
  insertRule([archId('Pivot'), null, 0, null, setId('Pivot Door Set'), 1])
}
