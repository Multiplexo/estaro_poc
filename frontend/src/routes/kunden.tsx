import { useTranslation } from '@/i18n'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '@/components/data-table'
import { customerColumns } from '@/components/master-data/customer-columns'
import { customersResource } from '@/lib/master-data'

export const Route = createFileRoute('/kunden')({ component: CustomersPage })

function CustomersPage() {
  const { t } = useTranslation()
  return (
    <section className="space-y-6">
      <header className="page-heading"><div className="space-y-2">
        <p className="page-eyebrow">{t('masterData.eyebrow')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('navigation.customers')}</h1>
        <p className="text-sm text-muted-foreground">{t('masterData.customersDescription')}</p>
      </div></header>
      <DataTable resource={customersResource} columns={customerColumns} caption={t('matching.customerSource')} emptyMessage={t('masterData.noCustomers')} searchLabel={t('masterData.searchCustomers')} searchPlaceholder={t('masterData.customerSearchPlaceholder')} />
    </section>
  )
}
