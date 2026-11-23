import { useTranslation } from '@/i18n'
import { createFileRoute } from '@tanstack/react-router'
import { FeedbackList } from '@/components/settings/feedback-list'
import { OutlookSettings } from '@/components/settings/outlook-settings'

export const Route = createFileRoute('/einstellungen')({
  validateSearch: (search: Record<string, unknown>): { outlook?: string } => ({
    outlook: typeof search.outlook === 'string' ? search.outlook : undefined,
  }),
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()
  const { outlook } = Route.useSearch()
  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('navigation.settings')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.description')}</p>
      </div>
      <OutlookSettings result={outlook} />
      <FeedbackList />
    </div>
  )
}
