import { useTranslation } from '@/i18n'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ReviewGroupAction({ confirmed, disabled, onConfirm, label }: { confirmed: boolean; disabled: boolean; onConfirm: () => void; label: string }) {
  const { t } = useTranslation()
  return <Button size="sm" variant={confirmed ? 'ghost' : 'outline'} aria-label={confirmed ? t('review.groupChecked', { label }) : t('review.confirmGroup', { label })} disabled={disabled || confirmed} onClick={onConfirm}><Check aria-hidden="true" />{confirmed ? t('common.checked') : t('review.confirmAllInSection')}</Button>
}
