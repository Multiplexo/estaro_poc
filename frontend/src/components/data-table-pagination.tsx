import { useTranslation } from '@/i18n'
import type { RowData } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import type { PaginatedTable } from '@/lib/data-table'

type DataTablePaginationProps<T extends RowData> = {
  table: PaginatedTable<T>
  disabled: boolean
}

export function DataTablePagination<T extends RowData>({ table, disabled }: DataTablePaginationProps<T>) {
  const { t } = useTranslation()
  const { pageIndex, pageSize } = table.state.pagination

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t p-4">
      <label className="flex items-center gap-2 text-sm">
        {t('table.rowsPerPage')}
        <select
          className="h-8 rounded-md border bg-background px-2"
          value={pageSize}
          disabled={disabled}
          onChange={(event) => table.setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })}
        >
          {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('table.pagination', { count: table.getRowCount(), page: table.getPageCount() === 0 ? 0 : pageIndex + 1, total: table.getPageCount() })}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={disabled || !table.getCanPreviousPage()} onClick={() => table.previousPage()}>
          {t('common.previous')}
        </Button>
        <Button variant="outline" disabled={disabled || !table.getCanNextPage()} onClick={() => table.nextPage()}>
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}
