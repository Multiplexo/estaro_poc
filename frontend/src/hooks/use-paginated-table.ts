import { useQuery } from '@tanstack/react-query'
import { useTable, type PaginationState } from '@tanstack/react-table'
import { useCallback, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { dataTableFeatures, type DataTableColumns } from '@/lib/data-table'
import type { PaginatedResource } from '@/lib/master-data'
import { loadAll } from '@/lib/inquiry-api'

const emptyRows: never[] = []

export function usePaginatedTable<T extends { id?: string | number | null }>(
  resource: PaginatedResource<T>,
  columns: DataTableColumns<T>,
) {
  const api = useApi()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const { pageIndex, pageSize } = pagination
  const selectPage = useCallback((items: T[]) => ({
    total: items.length,
    items: items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
  }), [pageIndex, pageSize])
  const query = useQuery({
    queryKey: [resource.queryKey],
    queryFn: ({ signal }) => loadAll((query) => resource.load(api, query, { signal })),
    staleTime: 60_000,
    select: selectPage,
  })
  const table = useTable({
    features: dataTableFeatures,
    data: query.data?.items ?? emptyRows,
    columns,
    getRowId: (row, index) => String(row.id ?? index),
    rowCount: query.data?.total ?? 0,
    manualPagination: true,
    state: { pagination },
    onPaginationChange: setPagination,
  })

  const tableColumns = table.getAllLeafColumns()
  const columnWidths = tableColumns.map((column) => column.columnDef.meta?.width ?? 160)

  return {
    table,
    query,
    rows: table.getRowModel().rows,
    columnWidths,
    tableWidth: columnWidths.reduce((total, width) => total + width, 0),
  }
}
