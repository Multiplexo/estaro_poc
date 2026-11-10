import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useInquiryDetail } from '@/hooks/use-inquiry-detail'

export function InquiryBreadcrumbs({ inquiryId, isReview, isRules }: {
  inquiryId: string; isReview: boolean; isRules: boolean
}) {
  const { t } = useTranslation()
  const { detail } = useInquiryDetail(inquiryId)
  const name = detail?.customerName || detail?.title || t('inquiries.singular')

  return <>
    <Link to="/" className="text-muted-foreground hover:text-foreground">{t('navigation.inquiries')}</Link>
    <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    {isReview || isRules ? <>
      <Link to="/anfragen/$inquiryId" params={{ inquiryId }} title={name} className="max-w-64 shrink-0 truncate text-muted-foreground hover:text-foreground">{name}</Link>
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      {isRules ? <>
        <Link to="/anfragen/$inquiryId/pruefung" params={{ inquiryId }} className="text-muted-foreground hover:text-foreground">{t('review.title')}</Link>
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </> : null}
      <span aria-current="page" className="font-medium">{isRules ? t('navigation.rules') : t('review.title')}</span>
    </> : <span aria-current="page" title={name} className="max-w-64 truncate font-medium">{name}</span>}
  </>
}
