export interface SchematicFeature {
  id: string
  label: string
  shape: 'arch' | 'custom'
  position: 'top' | 'middle' | 'bottom'
}

export interface SchematicInput {
  widthMm: number | null
  heightMm: number | null
  frameWidthMm: number | null
  frameThicknessMm: number | null
  glassThicknessMm: number | null
  mullionCount: number
  transomCount: number
  features: SchematicFeature[]
}

// Vertical fraction (0 = top, 1 = bottom) of the inner opening a manually
// tagged feature is centered at — a rough visual placement, not a measurement.
const POSITION_FRACTION: Record<SchematicFeature['position'], number> = {
  top: 0.18,
  middle: 0.5,
  bottom: 0.82,
}

const VB_W = 480
const VB_H = 420
const PAD_LEFT = 70
const PAD_TOP = 20
const PAD_RIGHT = 20
const PAD_BOTTOM = 60

/**
 * Deterministic 2D elevation schematic drawn to scale from confirmed
 * dimensions — plain geometry (no model/inference), so it doubles as a
 * visual sanity check that the extracted numbers are actually right.
 * Frame thickness/glass thickness are depth (Z-axis) values a 2D elevation
 * can't show, so they're listed as text instead of drawn.
 */
export function DrawingSchematic({ input }: { input: SchematicInput }) {
  const {
    widthMm,
    heightMm,
    frameWidthMm,
    frameThicknessMm,
    glassThicknessMm,
    mullionCount,
    transomCount,
    features,
  } = input

  if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700">
        Confirm Width and Height to see the scaled schematic.
      </div>
    )
  }

  const availableW = VB_W - PAD_LEFT - PAD_RIGHT
  const availableH = VB_H - PAD_TOP - PAD_BOTTOM
  const scale = Math.min(availableW / widthMm, availableH / heightMm)
  const drawW = widthMm * scale
  const drawH = heightMm * scale
  const originX = PAD_LEFT + (availableW - drawW) / 2
  const originY = PAD_TOP + (availableH - drawH) / 2

  const rawInset = frameWidthMm ? frameWidthMm * scale : 0
  const inset = Math.min(rawInset, drawW / 2 - 2, drawH / 2 - 2, 40)
  const innerX = originX + inset
  const innerY = originY + inset
  const innerW = drawW - 2 * inset
  const innerH = drawH - 2 * inset

  const mullionLines = Array.from({ length: Math.max(mullionCount, 0) }, (_, i) => {
    const x = innerX + (innerW * (i + 1)) / (mullionCount + 1)
    return { x, y1: innerY, y2: innerY + innerH }
  })
  const transomLines = Array.from({ length: Math.max(transomCount, 0) }, (_, i) => {
    const y = innerY + (innerH * (i + 1)) / (transomCount + 1)
    return { y, x1: innerX, x2: innerX + innerW }
  })

  const archFeatures = features.filter((f) => f.shape === 'arch')
  const arches = archFeatures.map((f) => {
    const fraction = POSITION_FRACTION[f.position]
    const baseY = innerY + innerH * fraction
    const archWidth = innerW * 0.7
    const archHeight = Math.min(innerH * 0.16, archWidth * 0.4)
    const cx = innerX + innerW / 2
    const x0 = cx - archWidth / 2
    const x1 = cx + archWidth / 2
    // Fan/arch shape: a shallow arc between two points, drawn with an SVG
    // elliptical-arc path — a rough visual placeholder for the manually
    // tagged feature, not a traced measurement of the actual sketch.
    const path = `M ${x0} ${baseY} A ${archWidth / 2} ${archHeight} 0 0 1 ${x1} ${baseY}`
    return { ...f, path, labelX: cx, labelY: baseY - archHeight - 6 }
  })

  const dimY = originY + drawH + 24
  const dimX = originX - 24

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full rounded border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {/* outer frame (aluminium section) */}
        <rect x={originX} y={originY} width={drawW} height={drawH} fill="#d4d4d8" stroke="#27272a" strokeWidth={2} />
        {/* inner glass area */}
        <rect x={innerX} y={innerY} width={innerW} height={innerH} fill="#cfe8fa" stroke="#27272a" strokeWidth={1.5} />

        {mullionLines.map((m, i) => (
          <line key={`mullion-${i}`} x1={m.x} y1={m.y1} x2={m.x} y2={m.y2} stroke="#27272a" strokeWidth={4} />
        ))}
        {transomLines.map((t, i) => (
          <line key={`transom-${i}`} x1={t.x1} y1={t.y} x2={t.x2} y2={t.y} stroke="#27272a" strokeWidth={4} />
        ))}

        {arches.map((a) => (
          <g key={a.id}>
            <path d={a.path} fill="#fef3c7" stroke="#b45309" strokeWidth={1.5} strokeDasharray="4 2" />
            <text x={a.labelX} y={a.labelY} textAnchor="middle" fontSize={10} fill="#b45309">
              {a.label}
            </text>
          </g>
        ))}

        {/* width dimension */}
        <line x1={originX} y1={dimY} x2={originX + drawW} y2={dimY} stroke="#71717a" strokeWidth={1} />
        <line x1={originX} y1={dimY - 5} x2={originX} y2={dimY + 5} stroke="#71717a" strokeWidth={1} />
        <line x1={originX + drawW} y1={dimY - 5} x2={originX + drawW} y2={dimY + 5} stroke="#71717a" strokeWidth={1} />
        <text x={originX + drawW / 2} y={dimY + 20} textAnchor="middle" fontSize={13} fill="currentColor">
          {widthMm.toLocaleString()} mm
        </text>

        {/* height dimension */}
        <line x1={dimX} y1={originY} x2={dimX} y2={originY + drawH} stroke="#71717a" strokeWidth={1} />
        <line x1={dimX - 5} y1={originY} x2={dimX + 5} y2={originY} stroke="#71717a" strokeWidth={1} />
        <line x1={dimX - 5} y1={originY + drawH} x2={dimX + 5} y2={originY + drawH} stroke="#71717a" strokeWidth={1} />
        <text
          x={dimX - 10}
          y={originY + drawH / 2}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
          transform={`rotate(-90 ${dimX - 10} ${originY + drawH / 2})`}
        >
          {heightMm.toLocaleString()} mm
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        {frameWidthMm && <span>Frame width: {frameWidthMm} mm</span>}
        {frameThicknessMm && <span>Frame thickness: {frameThicknessMm} mm (depth, not shown in elevation)</span>}
        {glassThicknessMm && <span>Glass: {glassThicknessMm} mm</span>}
        <span>Mullions: {mullionCount}</span>
        <span>Transoms: {transomCount}</span>
        {features
          .filter((f) => f.shape === 'custom')
          .map((f) => (
            <span key={f.id}>Feature ({f.position}): {f.label}</span>
          ))}
      </div>
    </div>
  )
}
