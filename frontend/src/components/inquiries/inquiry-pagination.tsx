import { useTranslation } from '@/i18n'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { PAGE_SIZE } from '@/lib/inquiry-overview'

type InquiryPaginationProps = {
  page: number
  total?: number
  isPlaceholderData: boolean
  onPageChange: Dispatch<SetStateAction<number>>
}

export function InquiryPagination({ page, total, isPlaceholderData, onPageChange }: InquiryPaginationProps) {
  const { t } = useTranslation()
  const pageCount = total === undefined ? undefined : Math.ceil(total / PAGE_SIZE)

  if (page === 0 && (pageCount ?? 0) <= 1) return null

  return (
    <nav aria-label={t('inquiries.paginationLabel')} className="flex items-center justify-end gap-3">
      <Button
        variant="outline"
        disabled={page === 0 || isPlaceholderData}
        onClick={() => onPageChange((current) => current - 1)}
      >
        {t('common.previous')}
      </Button>
      <span className="text-sm">
        {pageCount !== undefined && page < pageCount ? t('source.pageOf', { number: page + 1, total: pageCount }) : t('source.page', { number: page + 1 })}
      </span>
      <Button
        variant="outline"
        disabled={pageCount === undefined || page + 1 >= pageCount || isPlaceholderData}
        onClick={() => onPageChange((current) => current + 1)}
      >
        {t('common.next')}
      </Button>
    </nav>
  )
}
