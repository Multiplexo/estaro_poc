import i18n, { useTranslation } from '@/i18n'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { useIsAdmin } from '@/hooks/use-current-user'
import { useDisconnectOutlook, useOutlookConnection } from '@/hooks/use-outlook-connection'

export function OutlookSettings({ result }: { result?: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const connection = useOutlookConnection()
  const disconnect = useDisconnectOutlook()
  const isAdmin = useIsAdmin()
  const error = connectionError(result)
  const status = connection.data

  return (
    <Card>
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Mail aria-hidden="true" className="size-5" />
        </div>
        <CardTitle>{t('settings.outlook.title')}</CardTitle>
        <CardDescription>
          {t('settings.outlook.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {connection.isPending ? <p role="status" className="text-sm text-muted-foreground">{t('settings.outlook.checking')}</p> : null}
        {connection.isError ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">{connection.error.message}</p>
            <Button variant="outline" disabled={connection.isFetching} onClick={() => void connection.refetch()}>{t('navigation.retry')}</Button>
          </div>
        ) : null}
        {status && !connection.isError ? (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <dt className="text-muted-foreground">{t('settings.outlook.connection')}</dt>
              <dd className={status.connected ? 'font-medium text-emerald-700' : 'font-medium'}>{status.connected ? t('settings.outlook.configured') : t('settings.outlook.disconnected')}</dd>
              <dt className="text-muted-foreground">{t('settings.outlook.automaticFetch')}</dt>
              <dd className="font-medium">{status.fetch_enabled ? t('common.enabled') : t('common.disabled')}</dd>
              <dt className="text-muted-foreground">{t('settings.outlook.fetchInterval')}</dt>
              <dd className="font-medium">{t('settings.outlook.intervalSeconds', { count: status.fetch_interval_seconds })}</dd>
            </dl>
            {result === 'connected' && status.connected ? <p role="status" className="text-sm text-emerald-700">{t('settings.outlook.connectedSuccess')}</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {!status.configured ? <p className="text-sm text-muted-foreground">{t('settings.outlook.configurationError')}</p> : null}
            {!status.fetch_enabled ? <p className="text-sm text-muted-foreground">{t('settings.outlook.fetchDisabled')}</p> : null}
            {isAdmin ? <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" disabled={!status.configured || disconnect.isPending} onClick={() => window.location.assign(api.instance.getUri({ url: '/auth/login' }))}>
                <MicrosoftLogo />
                {status.connected ? t('settings.outlook.reconnect') : t('settings.outlook.connect')}
              </Button>
              {status.connected ? <Button type="button" variant="destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>{disconnect.isPending ? t('settings.outlook.disconnecting') : t('settings.outlook.disconnect')}</Button> : null}
            </div> : <p className="text-sm text-muted-foreground">{t('session.adminOnly')}</p>}
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
    case 'state': return i18n.t('settings.outlook.expiredError')
    case 'denied': return i18n.t('settings.outlook.deniedError')
    case 'offline_access': return i18n.t('settings.outlook.offlineAccessError')
    case 'configuration': return i18n.t('settings.outlook.configurationError')
    default: return i18n.t('settings.outlook.connectionError')
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
