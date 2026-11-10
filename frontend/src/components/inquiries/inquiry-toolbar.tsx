import { useTranslation } from '@/i18n'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { InboxSort, InboxStatus, InquiryInboxController } from '@/hooks/use-inquiry-inbox'

export function InquiryToolbar({ inbox }: { inbox: InquiryInboxController }) {
  const { t } = useTranslation()
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="relative w-full min-w-0 sm:w-80">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" name="inquiry-search" autoComplete="off" aria-label={t('inquiries.searchLabel')} placeholder={t('inquiries.searchPlaceholder')} maxLength={200} value={inbox.search} onChange={(event) => inbox.setSearch(event.target.value)} className="h-10 bg-card pl-9" />
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <NativeSelect className="rounded-lg bg-card [&_select]:h-10" name="inquiry-status" aria-label={t('common.filterByStatus')} value={inbox.status} onChange={(event) => inbox.setStatus(event.target.value as InboxStatus)}>
        <NativeSelectOption value="all">{t('common.allStatuses')}</NativeSelectOption>
        <NativeSelectOption value="new">{t('inquiries.status.new')}</NativeSelectOption>
        <NativeSelectOption disabled value="in_review">{t('inquiries.status.in_review')}</NativeSelectOption>
        <NativeSelectOption disabled value="reviewed">{t('common.checked')}</NativeSelectOption>
      </NativeSelect>
      <NativeSelect className="rounded-lg bg-card [&_select]:h-10" name="inquiry-sort" aria-label={t('inquiries.sortLabel')} value={inbox.sort} onChange={(event) => inbox.setSort(event.target.value as InboxSort)}>
        <NativeSelectOption value="newest">{t('inquiries.sort.newest')}</NativeSelectOption>
        <NativeSelectOption value="oldest">{t('inquiries.sort.oldest')}</NativeSelectOption>
        <NativeSelectOption value="customer">{t('inquiries.sort.customer')}</NativeSelectOption>
      </NativeSelect>
      </div>
    </div>
  </div>
}
