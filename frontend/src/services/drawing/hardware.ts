import type { HardwareItem } from './store'
import type { RateMaster } from './rateMaster'

// One hinge per ~700mm of panel height, minimum 2 — a named, editable
// assumption, not a measurement.
const HINGE_SPACING_MM = 700
const MIN_HINGES = 2

/**
 * Deterministic dimension-driven hardware suggestion — computed from
 * confirmed height only, never invented. Seeds the editable hardware list
 * so a fabricator reviews/corrects quantities before the final cost roll-up.
 */
export function suggestHardware(heightMm: number, rates: RateMaster): HardwareItem[] {
  const hingeCount = Math.max(MIN_HINGES, Math.ceil(heightMm / HINGE_SPACING_MM))
  return [
    {
      id: crypto.randomUUID(),
      label: 'Handle/lock set',
      quantity: 1,
      unitCost: rates.hardwareSetRate,
      notes: 'default 1 per unit — increase for multiple openable panels',
    },
    {
      id: crypto.randomUUID(),
      label: 'Hinges',
      quantity: hingeCount,
      unitCost: rates.hingeRate,
      notes: `1 per ~${HINGE_SPACING_MM}mm height, min ${MIN_HINGES} — edit if this isn't a hinged panel`,
    },
  ]
}
