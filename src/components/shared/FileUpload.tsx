import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, formatApiError } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Upload, File, X, Loader2, CheckCircle2 } from 'lucide-react'

interface FileUploadProps {
  endpoint: string
  accept?: string
  maxSizeMB?: number
  label?: string
  extraFields?: Record<string, string>
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

export function FileUpload({
  endpoint,
  accept = '*',
  maxSizeMB = 200,
  label = 'Upload file',
  extraFields = {},
  onSuccess,
  onError,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [done, setDone] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      const formData = new FormData()
      formData.append('file', file)
      Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v))
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      onSuccess?.(data)
      setFile(null)
      setDone(true)
      toastSuccess('Upload complete')
      if (inputRef.current) inputRef.current.value = ''
    },
    onError: (err: any) => {
      const msg = formatApiError(err, 'Upload failed')
      toastError(msg)
      onError?.(msg)
    },
  })

  const handleFile = (f: File | null) => {
    setDone(false)
    if (!f) return
    const maxBytes = maxSizeMB * 1024 * 1024
    if (f.size > maxBytes) {
      toastError(`File exceeds ${maxSizeMB} MB limit`)
      return
    }
    setFile(f)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFile(e.dataTransfer.files[0])
        }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-brand-300 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <File className="h-4 w-4 text-brand-700" />
            <span className="font-medium truncate max-w-[200px]">{file.name}</span>
            <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <Upload className="h-6 w-6 mb-1" />
            <span className="font-medium">{label}</span>
            <span className="text-xs">or drag and drop (max {maxSizeMB} MB)</span>
          </div>
        )}
      </div>

      {file && (
        <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending} className="w-full">
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-1.5 h-4 w-4" /> Upload {file.name}
            </>
          )}
        </Button>
      )}

      {done && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          Ready for next file
        </div>
      )}
    </div>
  )
}
