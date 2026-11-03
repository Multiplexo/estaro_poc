import { useTranslation } from '@/i18n'
import { AlertTriangle } from 'lucide-react'
import type { ArticleDetail, CustomerDetail } from '@/lib/inquiry-models'

type DetailRow = [label: string, value: string | null | undefined]

function DetailSection({ title, rows }: { title: string; rows: DetailRow[] }) {
  const { t } = useTranslation()
  return <section className="space-y-3">
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <dl className="space-y-2.5 text-sm">
      {rows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-4">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 break-words whitespace-pre-wrap text-foreground">{value || <span className="text-muted-foreground" aria-label={t('common.notStored')}>—</span>}</dd>
      </div>)}
    </dl>
  </section>
}

function decimal(value: string): string {
  const [integer, fraction] = value.split('.')
  const trimmed = fraction?.replace(/0+$/, '')
  return trimmed ? `${integer},${trimmed}` : integer
}

function ArticleInformation({ candidate }: { candidate: ArticleDetail }) {
  const { t } = useTranslation()
  return <>
    <DetailSection title={t('masterData.technical')} rows={[
      [t('masterData.description'), candidate.description_1], [t('masterData.descriptionExtra'), candidate.description_2],
      [t('masterData.articleGroup'), candidate.article_group_name], [t('masterData.manufacturer'), candidate.manufacturer],
    ]} />
    <DetailSection title={t('masterData.stockAndUnits')} rows={[
      [t('masterData.stock'), `${decimal(candidate.stock_quantity)} ${candidate.stock_unit_name ?? candidate.stock_unit_code ?? ''}`],
      [t('masterData.salesUnit'), candidate.sales_unit_name ?? candidate.sales_unit_code], [t('masterData.weight'), `${decimal(candidate.weight_kg)} kg`],
      [t('masterData.batchRequirement'), candidate.batch_requirement],
    ]} />
    <details className="group rounded-lg border px-4">
      <summary className="cursor-pointer py-3 text-sm font-medium text-foreground">{t('masterData.more')}</summary>
      <div className="space-y-3 pb-4"><DetailSection title={t('masterData.logistics')} rows={[
        [t('masterData.matchcode'), candidate.matchcode], [t('masterData.quantityCalculation'), candidate.quantity_calculation_name ?? candidate.quantity_calculation_code],
        [t('masterData.batchSelection'), candidate.batch_selection_name ?? candidate.batch_selection_code], [t('masterData.storage'), candidate.main_storage_location],
        [t('masterData.supplier'), candidate.main_supplier_code], [t('masterData.commodity'), candidate.commodity_code],
        [t('masterData.netMass'), candidate.intrastat_net_mass_kg ? `${decimal(candidate.intrastat_net_mass_kg)} kg` : null],
      ]} />{candidate.has_memo ? <p className="text-xs text-muted-foreground">{t('masterData.memo')}</p> : null}</div>
    </details>
    <p className="text-xs leading-relaxed text-muted-foreground">{t('masterData.technicalHint')}</p>
  </>
}

function CustomerInformation({ candidate }: { candidate: CustomerDetail }) {
  const { t } = useTranslation()
  return <>
    <DetailSection title={t('masterData.addressAndContact')} rows={[
      [t('masterData.nameAddition'), candidate.name_addition], [t('masterData.city'), [candidate.postal_code, candidate.city].filter(Boolean).join(' ')],
      [t('masterData.country'), candidate.country_name], [t('masterData.phone'), candidate.phone], [t('masterData.vatId'), candidate.vat_id],
    ]} />
    <DetailSection title={t('masterData.conditions')} rows={[
      [t('masterData.paymentTerms'), candidate.payment_terms_name ?? candidate.payment_terms_code], [t('masterData.currency'), candidate.currency_name ?? candidate.currency_code],
      [t('masterData.customerGroup'), candidate.customer_group_name],
    ]} />
    <details className="rounded-lg border px-4">
      <summary className="cursor-pointer py-3 text-sm font-medium text-foreground">{t('masterData.more')}</summary>
      <div className="pb-4"><DetailSection title={t('masterData.administration')} rows={[
        [t('masterData.matchcode'), candidate.matchcode], [t('masterData.priceList'), candidate.price_list_name ?? candidate.price_list_code],
        [t('masterData.discountList'), candidate.discount_list_name ?? candidate.discount_list_code], [t('masterData.language'), candidate.language_name ?? candidate.language_code],
      ]} /></div>
    </details>
  </>
}

export function CandidateDetails({ candidate }: { candidate: ArticleDetail | CustomerDetail }) {
  const { t } = useTranslation()
  const article = 'article_number' in candidate
  const warnings = [
    !candidate.is_active ? t('common.inactive') : null,
    !article && candidate.delivery_blocked ? t('common.deliveryBlocked') : null,
    article && !candidate.is_saleable ? t('masterData.notSaleable') : null,
    article && !candidate.is_purchasable ? t('masterData.notPurchasable') : null,
  ].filter(Boolean)
  return <div className="space-y-6">
    {warnings.length ? <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{warnings.join(' · ')}</p> : null}
    {article ? <ArticleInformation candidate={candidate} /> : <CustomerInformation candidate={candidate} />}
  </div>
}
