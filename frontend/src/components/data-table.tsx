import type { RowData } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { DataTablePagination } from '@/components/data-table-pagination'
import { TablePageSpacer } from '@/components/table-page-spacer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaginatedTable } from '@/hooks/use-paginated-table'
import type { DataTableColumns } from '@/lib/data-table'
import type { PaginatedResource } from '@/lib/master-data'

type DataTableProps<T extends RowData> = {
  resource: PaginatedResource<T>
  columns: DataTableColumns<T>
  caption: string
  emptyMessage: string
  searchLabel: string
  searchPlaceholder: string
}

export function DataTable<T extends { id?: string | number | null }>({ resource, columns, caption, emptyMessage, searchLabel, searchPlaceholder }: DataTableProps<T>) {
  const { search, setSearch, table, query, rows, columnWidths, tableWidth } = usePaginatedTable(resource, columns)

  return (
    <div className="space-y-3">
      <div className="relative w-full sm:max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name={`${resource.queryKey}-search`}
          autoComplete="off"
          spellCheck={false}
          aria-label={searchLabel}
          placeholder={searchPlaceholder}
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 bg-card pl-9"
        />
      </div>
      {query.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <p>{query.error.message}</p>
          <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Erneut versuchen</Button>
        </div>
      ) : null}
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {query.isFetching ? 'Daten werden geladen …' : null}
      </p>
      <div className="workspace-panel" aria-busy={query.isFetching}>
        <Table className="table-fixed" style={{ minWidth: tableWidth }}>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <colgroup>
            {columnWidths.map((width, index) => <col key={index} style={{ width: `${width / tableWidth * 100}%` }} />)}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} scope="col">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? rows.map((row) => (
              <TableRow key={row.id} className="h-[72px]">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="truncate" title={typeof cell.getValue() === 'string' ? String(cell.getValue()) : undefined}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground" style={{ height: Math.max(96, Math.min(table.state.pagination.pageSize, query.data?.total ?? table.state.pagination.pageSize) * 72) }}>
                  {query.isPending ? 'Daten werden geladen …' : query.isError ? 'Daten konnten nicht geladen werden.' : search.trim() ? 'Keine passenden Einträge gefunden.' : emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows.length > 0 ? (
              <TablePageSpacer
                pageSize={table.state.pagination.pageSize}
                total={table.getRowCount()}
                rowCount={rows.length}
                rowHeight={72}
                colSpan={columns.length}
              />
            ) : null}
          </TableBody>
        </Table>
        <DataTablePagination table={table} disabled={query.isFetching} />
      </div>
    </div>
  )
}
