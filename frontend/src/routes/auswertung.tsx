import { useTranslation } from '@/i18n'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePilotMetrics, type CostMetrics, type PilotMetrics } from '@/hooks/use-pilot-metrics'

export const Route = createFileRoute('/auswertung')({
  component: MetricsPage,
})

function percent(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)} %` : '–'
}

function MetricsPage() {
  const { t } = useTranslation()
  const metrics = usePilotMetrics()

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('metrics.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('metrics.description')}</p>
      </div>
      {metrics.isPending ? <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {metrics.isError ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          {metrics.error.message}
          <Button variant="outline" onClick={() => void metrics.refetch()}>{t('navigation.retry')}</Button>
        </div>
      ) : null}
      {metrics.data ? (metrics.data.reviewed_inquiries === 0
        ? <p className="text-sm text-muted-foreground">{t('metrics.empty')}</p>
        : <MetricsContent data={metrics.data} />) : null}
      {metrics.data && metrics.data.costs.inquiries > 0 ? <CostsCard costs={metrics.data.costs} /> : null}
    </div>
  )
}

function euro(value: number | null): string {
  return value === null ? '–' : value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function tokens(value: number): string {
  return value.toLocaleString('de-DE')
}

function CostsCard({ costs }: { costs: CostMetrics }) {
  const { t } = useTranslation()
  const tiles = [
    { label: t('metrics.costs.perInquiry'), value: euro(costs.cost_per_inquiry_eur) },
    { label: t('metrics.costs.total'), value: euro(costs.cost_eur), detail: t('metrics.costs.inquiries', { count: costs.inquiries }) },
    { label: t('metrics.costs.tokensPerInquiry'), value: tokens(costs.input_tokens_per_inquiry), detail: t('metrics.costs.outputTokens', { count: costs.output_tokens_per_inquiry, formatted: tokens(costs.output_tokens_per_inquiry) }) },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('metrics.costs.title')}</CardTitle>
        <CardDescription>{costs.cost_eur === null ? t('metrics.costs.noPrices') : t('metrics.costs.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label}>
              <dt className="text-sm text-muted-foreground">{tile.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{tile.value}</dd>
              {tile.detail ? <dd className="text-xs text-muted-foreground">{tile.detail}</dd> : null}
            </div>
          ))}
        </dl>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('metrics.week')}</TableHead>
            <TableHead className="text-right">{t('metrics.costs.inquiriesColumn')}</TableHead>
            <TableHead className="text-right">{t('metrics.costs.inputTokens')}</TableHead>
            <TableHead className="text-right">{t('metrics.costs.outputTokensColumn')}</TableHead>
            <TableHead className="text-right">{t('metrics.costs.cost')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {costs.weekly.map((week) => (
              <TableRow key={week.week}>
                <TableCell>{week.week}</TableCell>
                <TableCell className="text-right tabular-nums">{week.inquiries}</TableCell>
                <TableCell className="text-right tabular-nums">{tokens(week.input_tokens)}</TableCell>
                <TableCell className="text-right tabular-nums">{tokens(week.output_tokens)}</TableCell>
                <TableCell className="text-right tabular-nums">{euro(week.cost_eur)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function MetricsContent({ data }: { data: PilotMetrics }) {
  const { t } = useTranslation()
  const tiles = [
    { label: t('metrics.reviewed'), value: String(data.reviewed_inquiries) },
    { label: t('metrics.withoutCorrection'), value: percent(data.without_correction, data.reviewed_inquiries), detail: `${data.without_correction} / ${data.reviewed_inquiries}` },
    { label: t('metrics.correctionsPerInquiry'), value: data.corrections_per_inquiry.toLocaleString('de-DE') },
    { label: t('metrics.articlesAutomatic'), value: percent(data.positions - data.articles_reassigned, data.positions), detail: t('metrics.articlesReassigned', { count: data.articles_reassigned }) },
    { label: t('metrics.customersAutomatic'), value: percent(data.reviewed_inquiries - data.customer_reassigned, data.reviewed_inquiries), detail: t('metrics.customersReassigned', { count: data.customer_reassigned }) },
  ]
  const corrected = data.corrections_by_field.filter((entry) => entry.corrections > 0)

  return <>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-1 py-4">
          <CardContent className="px-4">
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{tile.value}</dd>
            {tile.detail ? <dd className="text-xs text-muted-foreground">{tile.detail}</dd> : null}
          </CardContent>
        </Card>
      ))}
    </dl>

    <Card>
      <CardHeader>
        <CardTitle>{t('metrics.weeklyTitle')}</CardTitle>
        <CardDescription>{t('metrics.weeklyDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('metrics.week')}</TableHead>
            <TableHead className="text-right">{t('metrics.reviewed')}</TableHead>
            <TableHead className="text-right">{t('metrics.withoutCorrection')}</TableHead>
            <TableHead className="text-right">{t('metrics.correctionsPerInquiry')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.weekly.map((week) => (
              <TableRow key={week.week}>
                <TableCell>{week.week}</TableCell>
                <TableCell className="text-right tabular-nums">{week.reviewed_inquiries}</TableCell>
                <TableCell className="text-right tabular-nums">{percent(week.without_correction, week.reviewed_inquiries)}</TableCell>
                <TableCell className="text-right tabular-nums">{week.corrections_per_inquiry.toLocaleString('de-DE')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{t('metrics.fieldsTitle')}</CardTitle>
        <CardDescription>{t('metrics.fieldsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {corrected.length === 0 ? <p className="text-sm text-muted-foreground">{t('metrics.noFieldCorrections')}</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('metrics.group')}</TableHead>
              <TableHead>{t('metrics.field')}</TableHead>
              <TableHead className="text-right">{t('metrics.corrections')}</TableHead>
              <TableHead className="text-right">{t('metrics.rate')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {corrected.map((entry) => (
                <TableRow key={`${entry.group}-${entry.field}`}>
                  <TableCell>{t(`metrics.groups.${entry.group}`)}</TableCell>
                  <TableCell>{t(`fields.${entry.field}`, { defaultValue: entry.field })}</TableCell>
                  <TableCell className="text-right tabular-nums">{entry.corrections}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(entry.corrections, entry.reviewed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  </>
}
