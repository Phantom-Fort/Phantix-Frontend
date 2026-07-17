import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  total: number
  offset: number
  limit: number
  onChange: (offset: number) => void
}

export function Pagination({ total, offset, limit, onChange }: PaginationProps) {
  if (total <= limit) return null

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)
  const startItem = offset + 1
  const endItem = Math.min(offset + limit, total)

  return (
    <div className="flex items-center justify-between px-6 py-3 text-sm text-muted-foreground">
      <span>{startItem}–{endItem} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(offset - limit)}
          disabled={offset === 0}
          className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onChange((page - 1) * limit)}
            className={`w-7 h-7 rounded text-xs font-medium ${
              page === currentPage ? 'bg-brand-700 text-white' : 'hover:bg-accent'
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onChange(offset + limit)}
          disabled={offset + limit >= total}
          className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
