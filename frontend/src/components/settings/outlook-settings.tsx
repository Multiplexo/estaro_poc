import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { useDisconnectOutlook, useOutlookConnection } from '@/hooks/use-outlook-connection'

export function OutlookSettings({ result }: { result?: string }) {
  const api = useApi()
  const connection = useOutlookConnection()
  const disconnect = useDisconnectOutlook()
  const error = connectionError(result)
  const status = connection.data

  return (
    <Card>
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Mail aria-hidden="true" className="size-5" />
        </div>
        <CardTitle>Microsoft Outlook</CardTitle>
        <CardDescription>
          Verbinde dein Microsoft-Konto, damit Estaro E-Mails und Anhänge aus deinem Posteingang abrufen kann.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {connection.isPending ? <p role="status" className="text-sm text-muted-foreground">Verbindung wird geprüft …</p> : null}
        {connection.isError ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">{connection.error.message}</p>
            <Button variant="outline" disabled={connection.isFetching} onClick={() => void connection.refetch()}>Erneut versuchen</Button>
          </div>
        ) : null}
        {status && !connection.isError ? (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <dt className="text-muted-foreground">Outlook-Verbindung</dt>
              <dd className={status.connected ? 'font-medium text-emerald-700' : 'font-medium'}>{status.connected ? 'Eingerichtet' : 'Nicht verbunden'}</dd>
              <dt className="text-muted-foreground">Automatischer Abruf</dt>
              <dd className="font-medium">{status.fetch_enabled ? 'Aktiviert' : 'Deaktiviert'}</dd>
              <dt className="text-muted-foreground">Abrufintervall</dt>
              <dd className="font-medium">{status.fetch_interval_seconds} Sekunden</dd>
            </dl>
            {result === 'connected' && status.connected ? <p role="status" className="text-sm text-emerald-700">Das Microsoft-Konto wurde für den E-Mail-Abruf verbunden.</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {!status.configured ? <p className="text-sm text-muted-foreground">Die Microsoft-Verbindung ist auf dem Server noch nicht vollständig eingerichtet.</p> : null}
            {!status.fetch_enabled ? <p className="text-sm text-muted-foreground">Der automatische Abruf ist aktuell in der Serverkonfiguration deaktiviert.</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" disabled={!status.configured || disconnect.isPending} onClick={() => window.location.assign(api.instance.getUri({ url: '/auth/login' }))}>
                <MicrosoftLogo />
                {status.connected ? 'Erneut mit Microsoft verbinden' : 'Mit Microsoft verbinden'}
              </Button>
              {status.connected ? <Button type="button" variant="destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>{disconnect.isPending ? 'Wird getrennt …' : 'Verbindung trennen'}</Button> : null}
            </div>
            {disconnect.error ? <p role="alert" className="text-sm text-destructive">{disconnect.error.message}</p> : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function connectionError(result?: string): string | undefined {
  if (!result || result === 'connected') return undefined
  switch (result) {
    case 'state': return 'Die Anmeldung ist abgelaufen. Bitte verbinde dein Konto erneut.'
    case 'denied': return 'Die Microsoft-Anmeldung wurde abgebrochen oder nicht freigegeben.'
    case 'offline_access': return 'Bitte erlaube den dauerhaften Outlook-Zugriff, damit E-Mails automatisch abgerufen werden können.'
    case 'configuration': return 'Die Microsoft-Verbindung ist auf dem Server noch nicht vollständig eingerichtet.'
    default: return 'Das Microsoft-Konto konnte nicht verbunden werden. Bitte versuche es erneut.'
  }
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 21 21" className="size-4">
      <path fill="#f25022" d="M0 0h10v10H0z" />
      <path fill="#7fba00" d="M11 0h10v10H11z" />
      <path fill="#00a4ef" d="M0 11h10v10H0z" />
      <path fill="#ffb900" d="M11 11h10v10H11z" />
    </svg>
  )
}
