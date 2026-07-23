import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, Camera } from 'lucide-react'
import { api, type DrawingRecord } from '~/lib/api'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'

const STATUS_VARIANT: Record<DrawingRecord['status'], 'outline' | 'warning' | 'success' | 'destructive'> = {
  uploaded: 'outline',
  processing: 'warning',
  needs_review: 'warning',
  ready: 'success',
  failed: 'destructive',
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6 pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Drawing Recognition Engine</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
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
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-14 text-center transition-colors',
          isDragging ? 'border-foreground/40 bg-muted/50' : 'border-border',
        )}
      >
        <UploadCloud className="size-9 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">Drag &amp; drop a drawing here, or</p>
        <div className="flex gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
            {isUploading ? 'Uploading…' : 'Choose file'}
          </Button>
          <Button variant="outline" onClick={() => cameraInputRef.current?.click()} disabled={isUploading}>
            <Camera className="size-4" /> Take photo
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Recent uploads</h2>
          <div className="flex flex-col gap-2">
            {recent.map((d) => (
              <Card
                key={d.id}
                size="sm"
                className="cursor-pointer transition-colors hover:ring-foreground/20"
                onClick={() => navigate(`/drawings/${d.id}`)}
              >
                <CardContent className="flex items-center justify-between">
                  <span className="truncate text-sm">{d.originalFilename}</span>
                  <Badge variant={STATUS_VARIANT[d.status]}>{d.status.replace('_', ' ')}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
