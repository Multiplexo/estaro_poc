import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/einstellungen')({ component: SettingsPage })

function SettingsPage() {
  return <section className="mx-auto max-w-3xl space-y-6">
    <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
    <p className="text-muted-foreground">Die KI-Konfiguration wird im Backend verwaltet. Einstellungen können derzeit nicht über die Oberfläche geändert werden.</p>
  </section>
}
