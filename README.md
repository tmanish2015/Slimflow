# Slimflow — AI Drawing Recognition Engine (MVP)

Extracts dimensions from aluminium fabrication drawings (window/door/shopfront
elevations) and turns them into a deterministic BOM. First slice of the full
10-step spec, scoped to: upload → preprocess → OCR/vector-text dimension
extraction → human review/correction → BOM generation.

## Stack

- `frontend/` — React 19 + Vite + TS + Tailwind v4, hand-rolled shadcn-style
  primitives (the shadcn CLI has a workspace-detection bug in this environment;
  components were added by hand following the same conventions).
- `backend/` — Node + TS + Express. No native/compiled dependencies by design
  (this machine has no Python/build toolchain for node-gyp), so:
  - `sharp` — raster preprocessing (greyscale, contrast, denoise, sharpen, upscale)
  - `tesseract.js` — OCR (pure WASM, no system Tesseract binary needed)
  - `pdfjs-dist` (legacy Node build) — vector text extraction from PDFs, and
    page rasterization via `@napi-rs/canvas` (prebuilt binary, no node-gyp)
    for scanned/photographed PDFs with no text layer
  - Data is stored as flat JSON files under `backend/data/` (no DB server) —
    fine for MVP volume; swap for Supabase/Postgres when this graduates
    beyond a single machine.

## Running locally

```
cd backend && npm install && npm run dev   # http://localhost:8787
cd frontend && npm install && npm run dev  # http://localhost:5173 (proxies /api, /uploads, /processed)
```

## What's implemented (Steps 1, 2, 3, 5, 7, partial 10)

- Upload PDF/JPG/PNG/TIFF/WEBP, or take a photo on mobile (camera capture input).
- PDF: extracts embedded vector text directly when present (accurate — this is
  the "AutoCAD PDF" case); falls back to rasterize + OCR for scanned PDFs.
- Images: sharp preprocessing pipeline, then Tesseract OCR with per-word
  bounding boxes.
- Deterministic, rule-based dimension classifier (regex + keyword + position
  heuristics — no ML/generative model) for Width, Height, Frame size, Glass
  thickness, Mullion/Transom counts, declared drawing units. Every result
  carries a confidence score and `confirmed: false`, so nothing reaches the
  BOM without a human check.
- OCR noise filtering: drops low-confidence words and oversized garbage
  bounding boxes (Tesseract occasionally emits a low-confidence "word" whose
  box spans most of the page).
- Review UI: shows the preprocessed image, an editable table of every
  detected dimension (add/remove/edit/confirm), before BOM generation.
- BOM generator: profile bars/weight/cost, net glass area, hardware,
  fasteners, waste %, labour, margin — all formulas disclosed per-line in
  the UI. Rates are editable via the "Rate master" page.

## Explicitly deferred (per MVP scope decision)

- Step 4: ML object-type classification (sliding window vs. casement vs. door, etc.)
- Step 6: scale-from-one-known-measurement proportional recalculation
- Step 8: cut list with barcodes/QR/machine numbers
- Step 9: manufacturing/assembly/exploded-view drawing generation
- Full Step 2 perspective correction / deskew (needs contour + homography analysis)
- DWG/DXF/IFC/BIM/Revit/SolidWorks/Fusion/SketchUp integration

## Known bugs fixed during initial verification

Documented here since they'd otherwise be invisible from the code alone:
- Dimension-number regex required ≥2 digits, so single-digit values (e.g.
  "8mm" glass) never matched — widened to allow 1+ digits.
- Unit detection (`mm`/`cm`/`in`) took the *first* unit-like word in a line,
  which false-positived on the word "in" inside phrases like "ALL DIMENSIONS
  ARE IN MM". Fixed to take the *last* match instead.
- Word-to-line grouping compared each token against a line's running average
  Y position, which could drift and chain unrelated rows together; switched
  to a fixed per-line anchor. A related issue: an OCR garbage token with an
  abnormally large bounding box could inflate its own matching tolerance and
  falsely attach to a distant, unrelated line — token height is now clamped
  before being used in the tolerance calculation, and OCR words are filtered
  by confidence and max size before reaching the parser.
