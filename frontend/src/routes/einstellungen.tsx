import { createFileRoute } from '@tanstack/react-router'
import { OutlookSettings } from '@/components/settings/outlook-settings'

export const Route = createFileRoute('/einstellungen')({
  validateSearch: (search: Record<string, unknown>): { outlook?: string } => ({
    outlook: typeof search.outlook === 'string' ? search.outlook : undefined,
  }),
  component: SettingsPage,
})

function SettingsPage() {
  const { outlook } = Route.useSearch()
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Richte die Outlook-Verbindung für den automatischen E-Mail-Abruf ein.</p>
      </div>
      <OutlookSettings result={outlook} />
    </div>
  )
}
