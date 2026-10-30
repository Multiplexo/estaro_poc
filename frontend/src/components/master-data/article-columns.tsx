import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from '@/lib/data-table'
import type { Article } from '@/lib/master-data'

const helper = createColumnHelper<typeof dataTableFeatures, Article>()
const quantityFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 })

function formatQuantity(value: string) {
  // FastAPI's Decimal strings retain their precision when passed directly to Intl.
  return quantityFormat.format(value as `${number}`)
}

export const articleColumns = helper.columns([
  helper.accessor('article_number', { meta: { width: 140 }, header: 'Artikelnummer' }),
  helper.accessor('variant', { meta: { width: 100 }, header: 'Variante', cell: (info) => info.getValue() || '–' }),
  helper.accessor('matchcode', { meta: { width: 220 }, header: 'Matchcode' }),
  helper.accessor('description_1', { meta: { width: 320 },
    header: 'Bezeichnung',
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate">{row.original.description_1 ?? '–'}</p>
        {row.original.description_2 ? <p className="truncate text-muted-foreground" title={row.original.description_2}>{row.original.description_2}</p> : null}
      </div>
    ),
  }),
  helper.accessor('article_group_name', { meta: { width: 260 }, header: 'Artikelgruppe' }),
  helper.accessor('stock_quantity', { meta: { width: 130 }, header: 'Lagerbestand', cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('stock_unit_name', { meta: { width: 130 }, header: 'Lagereinheit' }),
  helper.accessor('weight_kg', { meta: { width: 130 }, header: 'Gewicht (kg)', cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('is_active', { meta: { width: 90 }, header: 'Status', cell: (info) => info.getValue() ? 'Aktiv' : 'Inaktiv' }),
])
