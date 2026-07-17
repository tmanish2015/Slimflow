import { randomUUID } from 'node:crypto'
import type { HardwareItem } from '../store.js'
import type { RateMaster } from './rateMaster.js'

// Standard fabrication rule of thumb: one hinge per ~700mm of panel height,
// minimum 2 so even a short panel gets a top+bottom pair. This is a named,
// editable assumption, not a measurement — the review UI lets it be corrected
// per drawing (e.g. a heavier door needing 3 hinges at 600mm spacing).
const HINGE_SPACING_MM = 700
const MIN_HINGES = 2

/**
 * Deterministic dimension-driven hardware suggestion — computed from
 * confirmed height only (the one dimension hinge count reliably scales
 * with), never invented. Meant to seed the editable hardware list so a
 * fabricator reviews/corrects quantities before the final cost roll-up,
 * rather than the BOM silently assuming a flat "1 set" regardless of size.
 */
export function suggestHardware(heightMm: number, rates: RateMaster): HardwareItem[] {
  const hingeCount = Math.max(MIN_HINGES, Math.ceil(heightMm / HINGE_SPACING_MM))
  return [
    {
      id: randomUUID(),
      label: 'Handle/lock set',
      quantity: 1,
      unitCost: rates.hardwareSetRate,
      notes: 'default 1 per unit — increase for multiple openable panels',
    },
    {
      id: randomUUID(),
      label: 'Hinges',
      quantity: hingeCount,
      unitCost: rates.hingeRate,
      notes: `1 per ~${HINGE_SPACING_MM}mm height, min ${MIN_HINGES} — edit if this isn't a hinged panel`,
    },
  ]
}
