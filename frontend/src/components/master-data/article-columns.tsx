import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from '@/lib/data-table'
import type { Article } from '@/lib/master-data'

const helper = createColumnHelper<typeof dataTableFeatures, Article>()
const quantityFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 })

function formatQuantity(value: string | null | undefined): string {
  if (value == null) return '–'
  // FastAPI's Decimal strings retain their precision when passed directly to Intl.
  return quantityFormat.format(value as `${number}`)
}

export const articleColumns = helper.columns([
  helper.accessor('article_number', { meta: { width: 140 }, header: 'Artikelnummer' }),
  helper.accessor('variant', { meta: { width: 100 }, header: 'Variante', cell: (info) => info.getValue() || '–' }),
  helper.accessor('matchcode', { meta: { width: 220 }, header: 'Matchcode' }),
  helper.accessor('description_1', { meta: { width: 320 }, header: 'Bezeichnung 1' }),
  helper.accessor('description_2', { meta: { width: 320 }, header: 'Bezeichnung 2' }),
  helper.accessor('sales_unit_code', { meta: { width: 180 }, header: 'Verkaufseinheit (Code)' }),
  helper.accessor('sales_unit_name', { meta: { width: 200 }, header: 'Verkaufseinheit' }),
  helper.accessor('stock_quantity', { meta: { width: 130 }, header: 'Lagerbestand', cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('weight_kg', { meta: { width: 130 }, header: 'Gewicht (kg)', cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('stock_unit_code', { meta: { width: 180 }, header: 'Lagereinheit (Code)' }),
  helper.accessor('stock_unit_name', { meta: { width: 150 }, header: 'Lagereinheit' }),
  helper.accessor('article_group_code', { meta: { width: 180 }, header: 'Artikelgruppe (Code)' }),
  helper.accessor('article_group_name', { meta: { width: 260 }, header: 'Artikelgruppe' }),
  helper.accessor('is_active', { meta: { width: 90 }, header: 'Status', cell: (info) => info.getValue() ? 'Aktiv' : 'Inaktiv' }),
  helper.accessor('commodity_code', { meta: { width: 150 }, header: 'Warennummer' }),
  helper.accessor('main_supplier_code', { meta: { width: 160 }, header: 'Hauptlieferant' }),
  helper.accessor('main_storage_location', { meta: { width: 180 }, header: 'Hauptlagerplatz' }),
  helper.accessor('has_memo', { meta: { width: 90 }, header: 'Memo', cell: (info) => info.getValue() ? 'Ja' : 'Nein' }),
  helper.accessor('manufacturer', { meta: { width: 200 }, header: 'Hersteller' }),
  helper.accessor('quantity_calculation_code', { meta: { width: 220 }, header: 'Mengenberechnung (Code)' }),
  helper.accessor('quantity_calculation_name', { meta: { width: 240 }, header: 'Mengenberechnung' }),
  helper.accessor('is_saleable', { meta: { width: 110 }, header: 'Verkauf', cell: (info) => info.getValue() ? 'Ja' : 'Nein' }),
  helper.accessor('is_purchasable', { meta: { width: 140 }, header: 'Beschaffung', cell: (info) => info.getValue() ? 'Ja' : 'Nein' }),
  helper.accessor('tax_class_code', { meta: { width: 170 }, header: 'Steuerklasse (Code)' }),
  helper.accessor('tax_class_name', { meta: { width: 200 }, header: 'Steuerklasse' }),
  helper.accessor('batch_requirement', { meta: { width: 170 }, header: 'Chargenpflicht' }),
  helper.accessor('batch_selection_code', { meta: { width: 200 }, header: 'Chargenauswahl (Code)' }),
  helper.accessor('batch_selection_name', { meta: { width: 220 }, header: 'Chargenauswahl' }),
  helper.accessor('intrastat_net_mass_kg', { meta: { width: 260 }, header: 'Intrastat Eigenmasse (kg)', cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('is_exotic', { meta: { width: 90 }, header: 'Exot', cell: (info) => info.getValue() == null ? '–' : info.getValue() ? 'Ja' : 'Nein' }),
])
