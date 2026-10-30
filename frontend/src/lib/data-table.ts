import { metaHelper, rowPaginationFeature, tableFeatures, type ReactTable, type RowData, type TableOptions } from '@tanstack/react-table'

export const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  columnMeta: metaHelper<{ width: number }>(),
})

export type DataTableColumns<T extends RowData> = TableOptions<typeof dataTableFeatures, T>['columns']
export type PaginatedTable<T extends RowData> = ReactTable<typeof dataTableFeatures, T>
