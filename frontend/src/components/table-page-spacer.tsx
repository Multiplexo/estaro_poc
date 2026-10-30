import { TableCell, TableRow } from '@/components/ui/table'

type TablePageSpacerProps = {
  pageSize: number
  total: number
  rowCount: number
  rowHeight: number
  colSpan: number
}

export function TablePageSpacer({ pageSize, total, rowCount, rowHeight, colSpan }: TablePageSpacerProps) {
  const missingRows = Math.min(pageSize, total) - rowCount
  if (missingRows <= 0) return null

  return (
    <TableRow aria-hidden="true" className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0" style={{ height: missingRows * rowHeight }} />
    </TableRow>
  )
}
