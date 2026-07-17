import { Card, CardContent } from '@/components/ui/card'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Pagination } from '@/components/shared/Pagination'
import type { LucideIcon } from 'lucide-react'

interface Column {
  key: string
  label: string
  width?: string
  className?: string
  render: (item: any) => React.ReactNode
}

interface DataTableProps {
  columns: Column[]
  data: any[]
  total?: number
  offset?: number
  limit?: number
  isLoading?: boolean
  isEmpty?: boolean
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  error?: string | null
  onRetry?: () => void
  onPageChange?: (offset: number) => void
  keyExtractor: (item: any) => string | number
}

export function DataTable({
  columns,
  data,
  total = 0,
  offset = 0,
  limit = 30,
  isLoading,
  isEmpty,
  emptyIcon,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  error,
  onRetry,
  onPageChange,
  keyExtractor,
}: DataTableProps) {
  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState title="Failed to load data" message={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <TableSkeleton rows={5} cols={columns.length} />
        </CardContent>
      </Card>
    )
  }

  if (isEmpty || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </CardContent>
      </Card>
    )
  }

  const colWidths = columns.map((c) => c.width || '1fr').join(' ')

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          <div className="grid px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b" style={{ gridTemplateColumns: colWidths }}>
            {columns.map((col) => (
              <span key={col.key} className={col.className}>{col.label}</span>
            ))}
          </div>
          {data.map((item) => (
            <div
              key={keyExtractor(item)}
              className="grid px-6 py-3 text-sm items-center hover:bg-muted/50 transition-colors"
              style={{ gridTemplateColumns: colWidths }}
            >
              {columns.map((col) => (
                <div key={col.key} className={`${col.className || ''} border-r last:border-r-0 pr-4 last:pr-0`}>
                  {col.render(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
        {onPageChange && <Pagination total={total} offset={offset} limit={limit} onChange={onPageChange} />}
      </CardContent>
    </Card>
  )
}
