import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/i18n'
import type { InquiryFieldMatch } from '@/lib/generated/Api'
import type { InquiryFieldSource } from '@/lib/inquiry-table-data'

export function AutomaticFieldSource({ source, match }: { source: InquiryFieldSource; match?: InquiryFieldMatch }) {
  const { t } = useTranslation()
  return <div className="mt-2 whitespace-normal text-xs">
    <Badge variant="secondary" className="h-auto max-w-full whitespace-normal text-left" title={t(source === 'extraction' ? 'matching.automaticExtraction' : match?.origin === 'manual' ? 'matching.manualAssignment' : 'matching.automaticAssignment')}>
      <Sparkles aria-hidden="true" className="shrink-0" />{t(source === 'extraction' ? 'matching.extractionSource' : source === 'customer' ? 'matching.customerSource' : 'matching.articleSource')}
    </Badge>
  </div>
}
