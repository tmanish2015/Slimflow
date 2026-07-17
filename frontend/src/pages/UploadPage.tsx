import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type DrawingRecord } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_TONE: Record<DrawingRecord['status'], 'neutral' | 'green' | 'amber' | 'red'> = {
  uploaded: 'neutral',
  processing: 'amber',
  needs_review: 'amber',
  ready: 'green',
  failed: 'red',
}

export function UploadPage() {
  const navigate = useNavigate()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<DrawingRecord[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.listDrawings().then(setRecent).catch(() => {})
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setIsUploading(true)
      try {
        const drawing = await api.uploadDrawing(file)
        navigate(`/drawings/${drawing.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [navigate],
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Drawing Recognition Engine
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Upload a dimensioned drawing (PDF, JPG, PNG, TIFF) or take a photo. We&apos;ll extract
          dimensions automatically — you confirm before it feeds the BOM.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void handleFile(file)
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragging
            ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800'
            : 'border-neutral-300 dark:border-neutral-700'
        }`}
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Drag &amp; drop a drawing here, or
        </p>
        <div className="flex gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
            {isUploading ? 'Uploading…' : 'Choose file'}
          </Button>
          <Button variant="outline" onClick={() => cameraInputRef.current?.click()} disabled={isUploading}>
            Take photo
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/tiff,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Recent uploads
          </h2>
          <div className="flex flex-col gap-2">
            {recent.map((d) => (
              <Card
                key={d.id}
                className="cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600"
                onClick={() => navigate(`/drawings/${d.id}`)}
              >
                <CardContent className="flex items-center justify-between p-3">
                  <span className="truncate text-sm text-neutral-800 dark:text-neutral-200">
                    {d.originalFilename}
                  </span>
                  <Badge tone={STATUS_TONE[d.status]}>{d.status.replace('_', ' ')}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
