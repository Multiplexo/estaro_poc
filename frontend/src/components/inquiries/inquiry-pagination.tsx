import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { PAGE_SIZE } from '@/hooks/use-inquiries'

type InquiryPaginationProps = {
  page: number
  total?: number
  isPlaceholderData: boolean
  onPageChange: Dispatch<SetStateAction<number>>
}

export function InquiryPagination({ page, total, isPlaceholderData, onPageChange }: InquiryPaginationProps) {
  const pageCount = total === undefined ? undefined : Math.ceil(total / PAGE_SIZE)

  if (page === 0 && (pageCount ?? 0) <= 1) return null

  return (
    <nav aria-label="Anfragenseiten" className="flex items-center justify-end gap-3">
      <Button
        variant="outline"
        disabled={page === 0 || isPlaceholderData}
        onClick={() => onPageChange((current) => current - 1)}
      >
        Zurück
      </Button>
      <span className="text-sm">
        Seite {page + 1}
        {pageCount !== undefined && page < pageCount ? ` von ${pageCount}` : null}
      </span>
      <Button
        variant="outline"
        disabled={pageCount === undefined || page + 1 >= pageCount || isPlaceholderData}
        onClick={() => onPageChange((current) => current + 1)}
      >
        Weiter
      </Button>
    </nav>
  )
}
