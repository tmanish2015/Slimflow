import { db } from './db.js'

/**
 * Seeds representative master data for every table so the recommendation
 * rules (Steps 3, 7, 8, 9) have something real to evaluate against. Idempotent
 * — skips entirely if system_types already has rows, so restarts don't
 * duplicate data or clobber admin edits made through a future admin UI.
 */
export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as n FROM system_types').get() as { n: number }
  if (count.n > 0) return

  const insertMany = (sql: string, rows: unknown[][]) => {
    const stmt = db.prepare(sql)
    for (const row of rows) stmt.run(...(row as never[]))
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

  insertMany(
    'INSERT INTO door_architectures (name, description, uses_track, uses_hinges) VALUES (?, ?, ?, ?)',
    [
      ['Openable', 'Side-hinged swing', 0, 1],
      ['Sliding', 'Horizontal sliding panels on a track', 1, 0],
      ['Fixed', 'Non-operable', 0, 0],
      ['Bi-Fold', 'Folding panel set', 1, 1],
      ['Pivot', 'Rotates on a top/bottom pivot point, not side hinges', 0, 1],
      ['French', 'Paired hinged doors opening from the centre', 0, 1],
      ['Pocket Door', 'Slides into a wall cavity', 1, 0],
    ],
  )

  // total_panels/is_heavy_duty seeded per the spec's ">= 1+3 => Heavy Track"
  // rule, but these are just data rows — an admin can override any of them.
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

  insertMany('INSERT INTO profile_finishes (name, price_multiplier, swatch_hex) VALUES (?, ?, ?)', [
    ['Black', 1.0, '#1a1a1a'],
    ['Brush Gold', 1.15, '#b08d57'],
    ['Rose Gold', 1.15, '#b76e79'],
    ['Grey', 1.0, '#808080'],
    ['Champagne', 1.1, '#d4b896'],
    ['Silver', 1.0, '#c0c0c0'],
    ['White', 1.0, '#ffffff'],
    ['Wood Finish', 1.25, '#8b5a2b'],
    ['Custom RAL', 1.2, '#888888'],
  ])

  insertMany('INSERT INTO profile_series (name, system_type_id, description) VALUES (?, ?, ?)', [
    ['Slimflow Slide-60', 2, '60mm sliding door/window series'],
    ['Slimflow Case-45', 1, '45mm casement/openable series'],
  ])

  insertMany(
    'INSERT INTO profile_roles (name, orientation, scaling_rule, fixed_qty) VALUES (?, ?, ?, ?)',
    [
      ['Top Profile', 'horizontal', 'fixed', 1],
      ['Bottom Profile', 'horizontal', 'fixed', 1],
      ['Left Profile', 'vertical', 'fixed', 1],
      ['Right Profile', 'vertical', 'fixed', 1],
      ['Centre Divider', 'vertical', 'per_divider', 0],
      ['Horizontal Divider', 'horizontal', 'fixed', 0],
      // Glass Bead/Clip/Cover Profile quantities genuinely depend on
      // per-panel glass sizing (Step 15/16, not yet built) — seeded as a
      // fixed placeholder qty of 1 so the role exists end-to-end without
      // pretending to a precision this phase doesn't compute yet.
      ['Glass Bead', 'vertical', 'fixed', 1],
      ['Clip', 'vertical', 'fixed', 1],
      ['Cover Profile', 'horizontal', 'fixed', 1],
    ],
  )

  insertMany(
    'INSERT INTO profiles (series_id, role_id, name, weight_per_metre_kg, rate_per_kg) VALUES (?, ?, ?, ?, ?)',
    [
      // Slimflow Slide-60 (series_id 1)
      [1, 1, 'Slide-60 Top Track Profile', 1.8, 320],
      [1, 2, 'Slide-60 Bottom Track Profile', 2.0, 320],
      [1, 3, 'Slide-60 Left Jamb', 1.6, 320],
      [1, 4, 'Slide-60 Right Jamb', 1.6, 320],
      [1, 5, 'Slide-60 Centre Divider', 1.7, 320],
      [1, 7, 'Slide-60 Glass Bead', 0.3, 320],
      [1, 8, 'Slide-60 Interlock Clip', 0.1, 320],
      [1, 9, 'Slide-60 Cover Cap', 0.5, 320],
      // Slimflow Case-45 (series_id 2)
      [2, 1, 'Case-45 Top Profile', 1.3, 320],
      [2, 2, 'Case-45 Bottom Profile', 1.4, 320],
      [2, 3, 'Case-45 Left Jamb', 1.2, 320],
      [2, 4, 'Case-45 Right Jamb', 1.2, 320],
      [2, 5, 'Case-45 Mullion', 1.3, 320],
      [2, 7, 'Case-45 Glass Bead', 0.25, 320],
      [2, 8, 'Case-45 Clip', 0.1, 320],
      [2, 9, 'Case-45 Cover Cap', 0.4, 320],
    ],
  )

  insertMany(
    'INSERT INTO track_master (name, duty_class, max_capacity_kg, max_span_mm, rate_per_metre) VALUES (?, ?, ?, ?, ?)',
    [
      ['Light Duty Track', 'light', 40, 1500, 180],
      ['Medium Duty Track', 'medium', 80, 2200, 260],
      ['Heavy Duty Track', 'heavy', 150, 3000, 380],
      ['Ultra Heavy Track', 'ultra_heavy', 300, 4000, 520],
      ['Soft Close Track', 'soft_close', 100, 2500, 450],
    ],
  )

  insertMany(
    'INSERT INTO frame_master (name, duty_class, max_capacity_kg, rate_per_metre) VALUES (?, ?, ?, ?)',
    [
      ['Light Frame', 'light', 60, 150],
      ['Medium Frame', 'medium', 120, 220],
      ['Heavy Frame', 'heavy', 200, 310],
      ['Extra Heavy Frame', 'extra_heavy', 350, 420],
    ],
  )

  insertMany(
    'INSERT INTO hinge_master (name, hinge_type, max_capacity_kg, rate_per_unit) VALUES (?, ?, ?, ?)',
    [
      ['Normal Hinge', 'normal', 25, 40],
      ['Concealed Hinge', 'concealed', 40, 120],
      ['Pivot Hinge', 'pivot', 80, 350],
      ['Hydraulic Hinge', 'hydraulic', 60, 500],
      ['Soft Close Hinge', 'soft_close', 45, 280],
      ['Heavy Duty Hinge', 'heavy_duty', 100, 600],
    ],
  )

  insertMany(
    'INSERT INTO handle_master (name, handle_type, applicable_door_types, rate_per_unit) VALUES (?, ?, ?, ?)',
    [
      ['Square Handle', 'square', JSON.stringify(['Openable', 'Sliding', 'Fixed']), 350],
      ['Round Handle', 'round', JSON.stringify(['Openable']), 300],
      ['Pull Handle', 'pull', JSON.stringify(['Sliding', 'Openable']), 450],
      ['D Handle', 'd_handle', JSON.stringify(['Openable']), 400],
      ['Flush Handle', 'flush', JSON.stringify(['Sliding', 'Pocket Door']), 250],
      ['Shower Handle', 'shower', JSON.stringify(['Fixed']), 600],
      ['Hidden Handle', 'hidden', JSON.stringify(['Sliding', 'Pocket Door']), 500],
      ['Profile Handle', 'profile', JSON.stringify(['Sliding']), 200],
    ],
  )

  insertMany(
    'INSERT INTO lock_master (name, lock_type, applicable_door_types, rate_per_unit) VALUES (?, ?, ?, ?)',
    [
      ['Sliding Lock', 'sliding', JSON.stringify(['Sliding']), 300],
      ['Mortise Lock', 'mortise', JSON.stringify(['Openable', 'French']), 450],
      ['Cylinder Lock', 'cylinder', JSON.stringify(['Openable']), 350],
      ['Dead Lock', 'dead_lock', JSON.stringify(['Openable']), 400],
      ['Magnetic Lock', 'magnetic', JSON.stringify(['Sliding', 'Fixed']), 550],
      ['Glass Door Lock', 'glass_door', JSON.stringify(['Pivot', 'Fixed']), 700],
    ],
  )

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

  insertMany(
    'INSERT INTO glass_master (name, glass_type, thickness_mm, weight_per_sqft_kg, rate_per_sqft) VALUES (?, ?, ?, ?, ?)',
    [
      ['Clear 5mm', 'clear', 5, 1.2, 65],
      ['Clear 8mm', 'clear', 8, 1.9, 85],
      ['Toughened 12mm', 'toughened', 12, 2.9, 130],
      ['Double Glazed 24mm', 'double_glazed', 24, 5.8, 280],
      ['Frosted 6mm', 'frosted', 6, 1.4, 75],
      ['Laminated 8.38mm', 'laminated', 8.38, 2.0, 150],
    ],
  )

  insertMany('INSERT INTO accessory_master (name, unit, rate) VALUES (?, ?, ?)', [
    ['Silicone Sealant Tube', 'pcs', 180],
    ['Weep Hole Cover', 'pcs', 5],
    ['End Cap', 'pcs', 15],
    ['Corner Key', 'pcs', 25],
  ])

  // --- Recommendation rule bands (Steps 3, 7, 8, 9) ---
  // track ids: 1 Light, 2 Medium, 3 Heavy, 4 Ultra Heavy, 5 Soft Close
  insertMany(
    'INSERT INTO track_recommendation_rules (min_door_weight_kg, max_door_weight_kg, requires_heavy_duty_config, max_span_mm, recommended_track_id, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [
      [0, null, 0, null, 1, 1], // not a heavy-duty panel config -> Light
      [0, null, 1, null, 3, 5], // heavy-duty panel config (>=1+3 etc.) -> Heavy
      [200, null, null, null, 4, 10], // very heavy regardless of config -> Ultra Heavy
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
  // Sliding/Fixed/Pocket Door intentionally have no rows -> no hinge recommended (correct: sliding uses rollers, not hinges).
  insertMany(
    'INSERT INTO hinge_recommendation_rules (door_architecture_id, min_door_weight_kg, max_door_weight_kg, recommended_hinge_id, priority) VALUES (?, ?, ?, ?, ?)',
    [
      [1, 0, null, 2, 1], // Openable, default -> Concealed
      [1, 40, null, 6, 5], // Openable, heavy -> Heavy Duty
      [5, 0, null, 3, 1], // Pivot architecture -> Pivot hinge
      [4, 0, null, 1, 1], // Bi-Fold -> Normal
      [6, 0, null, 2, 1], // French -> Concealed
    ],
  )
}
