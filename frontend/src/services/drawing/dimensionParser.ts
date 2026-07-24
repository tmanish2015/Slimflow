import type { DimensionKind, ExtractedDimension } from './store'

export interface RawToken {
  text: string
  x: number
  y: number
  width: number
  height: number
}

interface Line {
  text: string
  y: number
  anchorY: number
  tokens: RawToken[]
}

// Group 1 = English unit word (needs \b since JS \b only recognizes ASCII
// word characters); group 2 = Devanagari unit word (no \b — see note by
// KEYWORD_RULES below on why that would silently never match).
const UNIT_RE = /\b(mm|cm|m|in|inch|inches|ft|feet|foot)\b|(मिमी|सेमी|मीटर|इंच|फ़ीट|फीट)/gi
// Fabrication sketches commonly mark inches/feet with prime symbols instead
// of spelling the unit out (90" = 90 inches, 6' = 6 feet) — a straight or
// curly quote directly after a number, not a standalone word, so it needs
// its own check rather than folding into UNIT_RE's word-boundary matching.
const QUOTE_UNIT_RE = /(\d)\s*(['’])(?!')|(\d)\s*(["”])/g
const PLAIN_NUMBER_RE = /(\d[\d,]{0,6})(?:\.\d+)?/g
const FRAME_XY_RE = /(\d{1,4})\s*[xX×]\s*(\d{1,4})/
const RATIO_RE = /\b(\d{1,3})\s*:\s*(\d{1,4})\b/
const PLAUSIBLE_MIN_MM = 50
const PLAUSIBLE_MAX_MM = 8000

/** Groups word tokens into text lines by y-overlap so multi-word phrases
 * like "WIDTH = 1800" or "FRAME 40X80" can be read as one unit instead of
 * isolated numbers, since OCR/PDF text order alone doesn't preserve layout. */
function groupIntoLines(tokens: RawToken[]): Line[] {
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: Line[] = []

  for (const token of sorted) {
    const centerY = token.y + token.height / 2
    const tolerance = Math.min(Math.max(token.height, 8), 60) * 0.6
    const line = lines.find((l) => Math.abs(l.anchorY - centerY) < tolerance)
    if (line) {
      line.tokens.push(token)
      line.y = line.tokens.reduce((sum, t) => sum + t.y + t.height / 2, 0) / line.tokens.length
    } else {
      lines.push({ text: '', y: centerY, anchorY: centerY, tokens: [token] })
    }
  }

  for (const line of lines) {
    line.tokens.sort((a, b) => a.x - b.x)
    line.text = line.tokens.map((t) => t.text).join(' ')
  }
  return lines
}

function unitFromText(text: string): 'mm' | 'cm' | 'in' | 'ft' | null {
  // Word-based ("90 mm") and prime-symbol ("90"") units can both appear —
  // whichever comes last in the line wins, same convention as before for
  // the word-only case (the real unit label almost always trails the
  // number it belongs to).
  const candidates: { index: number; unit: 'mm' | 'cm' | 'in' | 'ft' }[] = []

  for (const m of text.matchAll(UNIT_RE)) {
    if (m[1]) {
      const u = m[1].toLowerCase()
      if (u === 'mm') candidates.push({ index: m.index, unit: 'mm' })
      else if (u === 'cm' || u === 'm') candidates.push({ index: m.index, unit: 'cm' })
      else if (u === 'in' || u.startsWith('inch')) candidates.push({ index: m.index, unit: 'in' })
      else if (u === 'ft' || u === 'feet' || u === 'foot') candidates.push({ index: m.index, unit: 'ft' })
    } else if (m[2]) {
      const u = m[2]
      if (u === 'मिमी') candidates.push({ index: m.index, unit: 'mm' })
      else if (u === 'सेमी' || u === 'मीटर') candidates.push({ index: m.index, unit: 'cm' })
      else if (u === 'इंच') candidates.push({ index: m.index, unit: 'in' })
      else if (u === 'फ़ीट' || u === 'फीट') candidates.push({ index: m.index, unit: 'ft' })
    }
  }
  for (const m of text.matchAll(QUOTE_UNIT_RE)) {
    candidates.push({ index: m.index, unit: m[2] ? 'ft' : 'in' })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.index - b.index)
  return candidates[candidates.length - 1].unit
}

export function toMillimetres(value: number, unit: 'mm' | 'cm' | 'in' | 'ft' | null): number {
  if (unit === 'cm') return value * 10
  if (unit === 'in') return value * 25.4
  if (unit === 'ft') return value * 304.8
  return value
}

function bboxForTokens(tokens: RawToken[]): ExtractedDimension['bbox'] {
  if (tokens.length === 0) return null
  const x0 = Math.min(...tokens.map((t) => t.x))
  const y0 = Math.min(...tokens.map((t) => t.y))
  const x1 = Math.max(...tokens.map((t) => t.x + t.width))
  const y1 = Math.max(...tokens.map((t) => t.y + t.height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

function makeDimension(
  kind: DimensionKind,
  label: string,
  rawText: string,
  value: number | null,
  unit: 'mm' | 'cm' | 'in' | 'ft' | null,
  confidence: number,
  source: 'vector-pdf' | 'ocr',
  tokens: RawToken[],
): ExtractedDimension {
  return {
    id: crypto.randomUUID(),
    kind,
    label,
    rawText,
    value,
    unit,
    confidence,
    source,
    bbox: bboxForTokens(tokens),
    confirmed: false,
  }
}

// Devanagari terms are matched without \b — JS's \b only recognizes ASCII
// [A-Za-z0-9_] as "word" characters, so a boundary between a space and a
// Devanagari letter never fires and \b-wrapped Devanagari alternatives would
// silently never match. Plain substring alternation is safe here: these are
// distinct multi-character words, not single letters that could collide
// with unrelated text.
const KEYWORD_RULES: { kind: DimensionKind; label: string; re: RegExp }[] = [
  { kind: 'width', label: 'Overall Width', re: /\b(overall\s*width|o\/w|width|wd)\b|चौड़ाई/i },
  { kind: 'height', label: 'Overall Height', re: /\b(overall\s*height|o\/h|height|ht)\b|ऊंचाई|ऊँचाई|लंबाई/i },
  { kind: 'glass_thickness', label: 'Glass Thickness', re: /\bglass\b|कांच|शीशा/i },
  { kind: 'mullion_count', label: 'Mullions', re: /\bmullion|मलियन/i },
  { kind: 'transom_count', label: 'Transoms', re: /\btransom/i },
]

/**
 * Deterministic, rule-based dimension classifier — no ML/generative model.
 * Every match is a plain regex + position heuristic, and every result comes
 * back with `confirmed: false` so the review UI forces a human check before
 * anything reaches the BOM.
 */
export function parseDimensions(tokens: RawToken[], source: 'vector-pdf' | 'ocr'): ExtractedDimension[] {
  const lines = groupIntoLines(tokens)
  const results: ExtractedDimension[] = []
  const claimedTokenIds = new Set<RawToken>()

  const declaredUnit = (() => {
    for (const line of lines) {
      if (/all\s+dim(ensions)?.*\bin\b/i.test(line.text)) {
        const u = unitFromText(line.text)
        if (u) return u
      }
    }
    return null
  })()
  if (declaredUnit) {
    results.push(makeDimension('drawing_unit', 'Drawing Units', declaredUnit, null, declaredUnit, 0.7, source, []))
  }

  for (const line of lines) {
    const ratioMatch = line.text.match(RATIO_RE)
    if (ratioMatch && /scale/i.test(line.text)) {
      results.push(makeDimension('scale', 'Scale', line.text.trim(), null, null, 0.6, source, line.tokens))
      line.tokens.forEach((t) => claimedTokenIds.add(t))
      continue
    }

    const frameMatch = line.text.match(FRAME_XY_RE)
    if (frameMatch && /frame/i.test(line.text)) {
      const [, a, b] = frameMatch
      results.push(makeDimension('frame', 'Frame Width', line.text.trim(), Number(a), 'mm', 0.65, source, line.tokens))
      results.push(makeDimension('frame', 'Frame Thickness', line.text.trim(), Number(b), 'mm', 0.65, source, line.tokens))
      line.tokens.forEach((t) => claimedTokenIds.add(t))
      continue
    }

    const rule = KEYWORD_RULES.find((r) => r.re.test(line.text))
    if (!rule) continue

    const numberMatch = line.text.match(PLAIN_NUMBER_RE)
    if (!numberMatch) continue
    const value = Number(numberMatch[0].replace(/,/g, ''))
    const unit = unitFromText(line.text) ?? declaredUnit
    results.push(makeDimension(rule.kind, rule.label, line.text.trim(), value, unit, 0.8, source, line.tokens))
    line.tokens.forEach((t) => claimedTokenIds.add(t))
  }

  // Fallback: bare, unlabeled numbers in a plausible opening-size range.
  // Convention (not a measurement): largest = width, next-largest = height.
  const hasWidth = results.some((r) => r.kind === 'width')
  const hasHeight = results.some((r) => r.kind === 'height')
  if (!hasWidth || !hasHeight) {
    const candidates: { value: number; tokens: RawToken[]; unit: 'mm' | 'cm' | 'in' | 'ft' | null }[] = []
    for (const line of lines) {
      if (line.tokens.some((t) => claimedTokenIds.has(t))) continue
      if (FRAME_XY_RE.test(line.text)) continue
      const matches = [...line.text.matchAll(PLAIN_NUMBER_RE)]
      for (const m of matches) {
        const value = Number(m[0].replace(/,/g, ''))
        const unit = unitFromText(line.text) ?? declaredUnit
        const mm = toMillimetres(value, unit)
        if (mm >= PLAUSIBLE_MIN_MM && mm <= PLAUSIBLE_MAX_MM) {
          candidates.push({ value, tokens: line.tokens, unit })
        }
      }
    }
    candidates.sort((a, b) => toMillimetres(b.value, b.unit) - toMillimetres(a.value, a.unit))
    if (!hasWidth && candidates[0]) {
      results.push(
        makeDimension('width', 'Overall Width (guessed)', String(candidates[0].value), candidates[0].value, candidates[0].unit, 0.35, source, candidates[0].tokens),
      )
    }
    if (!hasHeight && candidates[1]) {
      results.push(
        makeDimension('height', 'Overall Height (guessed)', String(candidates[1].value), candidates[1].value, candidates[1].unit, 0.35, source, candidates[1].tokens),
      )
    }
  }

  return results
}
