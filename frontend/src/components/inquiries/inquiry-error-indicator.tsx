import { useTranslation } from '@/i18n'
import { CircleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'

export function InquiryErrorIndicator({ message }: { message: string }) {
  const { t } = useTranslation()
  return <Popover>
    <PopoverTrigger render={<Button variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label={t('common.showErrorDetails')} />}>
      <CircleAlertIcon aria-hidden="true" />
    </PopoverTrigger>
    <span role="status" className="sr-only">{t('common.errorDetailsHint')}</span>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-4">
      <PopoverTitle className="text-destructive">{t('common.errorDetails')}</PopoverTitle>
      <p className="max-h-56 overflow-y-auto text-sm whitespace-pre-wrap break-words">{message}</p>
    </PopoverContent>
  </Popover>
}
