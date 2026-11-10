import { useTranslation } from '@/i18n'
import { GitCompareArrows, LayoutGrid, Table2 } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export function InquiryViewTabs({ review = false }: { review?: boolean }) {
  const { t } = useTranslation()
  const triggerClassName = review ? 'min-h-10 flex-none px-2 @min-[30rem]:px-3 [&_svg]:hidden @min-[30rem]:[&_svg]:block' : 'min-h-8 px-3'
  return <TabsList aria-label={t('inquiries.detailViewLabel')} variant={review ? 'line' : 'default'} className={review ? 'h-auto! min-h-11 max-w-full justify-start gap-0 @min-[30rem]:gap-2' : 'h-auto! min-h-10 max-w-full flex-wrap justify-start gap-y-1'}>
    <TabsTrigger value="overview" className={triggerClassName}><LayoutGrid aria-hidden="true" />{review ? t('jobs.extraction') : t('common.overview')}</TabsTrigger>
    {review ? <TabsTrigger value="matching" className={triggerClassName}><GitCompareArrows aria-hidden="true" />{t('jobs.matching')}</TabsTrigger> : null}
    <TabsTrigger value="table" aria-label={review ? t('review.requestSection') : undefined} className={triggerClassName}><Table2 aria-hidden="true" />{review ? <><span className="hidden @min-[30rem]:inline">{t('review.requestSection')}</span><span className="@min-[30rem]:hidden">{t('common.data')}</span></> : t('inquiries.allData')}</TabsTrigger>
  </TabsList>
}
