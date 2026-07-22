import { db } from './db.js'

export interface CompatibilityRuleRow {
  id: number
  rule_name: string
  subject_table: string
  subject_id: number
  constraint_table: string
  constraint_id: number
  relation: 'requires' | 'excludes'
  active: number
}

export interface CompatibilityResult {
  allowed: boolean
  reasons: string[]
}

/** Current selections keyed by constraint_table name, so a rule's
 * constraint_table tells us which slot of the in-progress configuration to
 * compare against (e.g. constraint_table 'door_architectures' -> selection.door_architectures). */
export type Selection = Partial<Record<string, number | null>>

/**
 * Step 17 — compatibility engine. Reads compatibility_rules (admin-editable
 * data, not application logic) and decides whether `subjectId` in
 * `subjectTable` is allowed given the rest of the in-progress configuration.
 *
 * Semantics:
 * - `excludes` rows are absolute — a single match disallows the subject,
 *   regardless of anything else ("Sliding Lock cannot be selected for
 *   Openable Door").
 * - `requires` rows are OR'd within the same constraint_table (a lock
 *   naming three compatible architectures needs only one to match) but
 *   AND'd across different constraint_tables (a rule constraining both
 *   system_type and door_architecture must satisfy both). A subject with no
 *   `requires` rows at all has no requirement — it's allowed by default,
 *   subject only to `excludes`.
 */
export function evaluateCompatibility(subjectTable: string, subjectId: number, selection: Selection): CompatibilityResult {
  const rules = db
    .prepare(
      `SELECT * FROM compatibility_rules WHERE subject_table = ? AND subject_id = ? AND active = 1`,
    )
    .all(subjectTable, subjectId) as unknown as CompatibilityRuleRow[]

  const reasons: string[] = []

  const excludeRules = rules.filter((r) => r.relation === 'excludes')
  for (const rule of excludeRules) {
    const selected = selection[rule.constraint_table]
    if (selected != null && selected === rule.constraint_id) {
      reasons.push(rule.rule_name)
    }
  }
  if (reasons.length > 0) return { allowed: false, reasons }

  const requireRules = rules.filter((r) => r.relation === 'requires')
  const byConstraintTable = new Map<string, CompatibilityRuleRow[]>()
  for (const rule of requireRules) {
    const list = byConstraintTable.get(rule.constraint_table) ?? []
    list.push(rule)
    byConstraintTable.set(rule.constraint_table, list)
  }

  for (const [constraintTable, tableRules] of byConstraintTable) {
    const selected = selection[constraintTable]
    const satisfied = selected != null && tableRules.some((r) => r.constraint_id === selected)
    if (!satisfied) {
      reasons.push(`requires ${constraintTable.replace('_', ' ')}: ${tableRules.map((r) => r.rule_name).join(' or ')}`)
    }
  }

  return { allowed: reasons.length === 0, reasons }
}

/** Evaluates every row of `table` against the given selection — used to
 * render a "these are your compatible options" list rather than checking
 * one subject at a time. */
export function filterCompatible<T extends { id: number; name: string }>(
  table: string,
  selection: Selection,
): (T & { allowed: boolean; reasons: string[] })[] {
  const rows = db.prepare(`SELECT * FROM ${table}`).all() as unknown as T[]
  return rows.map((row) => ({ ...row, ...evaluateCompatibility(table, row.id, selection) }))
}
