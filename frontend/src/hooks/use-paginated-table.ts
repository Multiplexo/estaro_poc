import { useTranslation } from '@/i18n'
import { useQuery } from '@tanstack/react-query'
import { useTable, type PaginationState } from '@tanstack/react-table'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { dataTableFeatures, type DataTableColumns } from '@/lib/data-table'
import { filterMasterData, type PaginatedResource } from '@/lib/master-data'
import { loadAll } from '@/lib/inquiry-api'

const emptyRows: never[] = []

export function usePaginatedTable<T extends { id?: string | number | null }>(
  resource: PaginatedResource<T>,
  columns: DataTableColumns<T>,
) {
  const { i18n } = useTranslation()
  const api = useApi()
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const { pageIndex, pageSize } = pagination
  const term = useDeferredValue(search.trim().toLocaleLowerCase(i18n.language))
  const selectResults = useCallback((items: T[]) => filterMasterData(items, term), [term])
  const results = useQuery({
    queryKey: [resource.queryKey],
    queryFn: ({ signal }) => loadAll((query) => resource.load(api, query, { signal })),
    staleTime: 60_000,
    select: selectResults,
  })
  const data = useMemo(() => results.data ? {
    total: results.data.length,
    items: results.data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
  } : undefined, [results.data, pageIndex, pageSize])
  const query = { ...results, data }
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
    search,
    setSearch: (value: string) => {
      setSearch(value)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
    },
    table,
    query,
    rows: table.getRowModel().rows,
    columnWidths,
    tableWidth: columnWidths.reduce((total, width) => total + width, 0),
  }
}
