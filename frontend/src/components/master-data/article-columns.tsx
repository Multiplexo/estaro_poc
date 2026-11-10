import i18n from '@/i18n'
import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from '@/lib/data-table'
import type { Article } from '@/lib/master-data'

const helper = createColumnHelper<typeof dataTableFeatures, Article>()

function formatQuantity(value: string | null | undefined): string {
  if (value == null) return '–'
  // FastAPI's Decimal strings retain their precision when passed directly to Intl.
  return new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(value as `${number}`)
}

export const articleColumns = helper.columns([
  helper.accessor('article_number', { meta: { width: 140 }, header: () => i18n.t('masterData.columns.article_number') }),
  helper.accessor('variant', { meta: { width: 100 }, header: () => i18n.t('masterData.columns.variant'), cell: (info) => info.getValue() || '–' }),
  helper.accessor('matchcode', { meta: { width: 220 }, header: () => i18n.t('masterData.matchcode') }),
  helper.accessor('description_1', { meta: { width: 320 }, header: () => i18n.t('masterData.columns.description_1') }),
  helper.accessor('description_2', { meta: { width: 320 }, header: () => i18n.t('masterData.columns.description_2') }),
  helper.accessor('sales_unit_code', { meta: { width: 180 }, header: () => i18n.t('masterData.columns.sales_unit_code') }),
  helper.accessor('sales_unit_name', { meta: { width: 200 }, header: () => i18n.t('masterData.salesUnit') }),
  helper.accessor('stock_quantity', { meta: { width: 130 }, header: () => i18n.t('masterData.columns.stock_quantity'), cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('weight_kg', { meta: { width: 130 }, header: () => i18n.t('masterData.columns.weight_kg'), cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('stock_unit_code', { meta: { width: 180 }, header: () => i18n.t('masterData.columns.stock_unit_code') }),
  helper.accessor('stock_unit_name', { meta: { width: 150 }, header: () => i18n.t('masterData.columns.stock_unit_name') }),
  helper.accessor('article_group_code', { meta: { width: 180 }, header: () => i18n.t('masterData.columns.article_group_code') }),
  helper.accessor('article_group_name', { meta: { width: 260 }, header: () => i18n.t('masterData.articleGroup') }),
  helper.accessor('is_active', { meta: { width: 90 }, header: () => i18n.t('masterData.columns.is_active'), cell: (info) => info.getValue() ? i18n.t('common.active') : i18n.t('common.inactive') }),
  helper.accessor('commodity_code', { meta: { width: 150 }, header: () => i18n.t('masterData.commodity') }),
  helper.accessor('main_supplier_code', { meta: { width: 160 }, header: () => i18n.t('masterData.supplier') }),
  helper.accessor('main_storage_location', { meta: { width: 180 }, header: () => i18n.t('masterData.columns.main_storage_location') }),
  helper.accessor('has_memo', { meta: { width: 90 }, header: () => i18n.t('masterData.columns.has_memo'), cell: (info) => info.getValue() ? i18n.t('common.yes') : i18n.t('common.no') }),
  helper.accessor('manufacturer', { meta: { width: 200 }, header: () => i18n.t('masterData.manufacturer') }),
  helper.accessor('quantity_calculation_code', { meta: { width: 220 }, header: () => i18n.t('masterData.columns.quantity_calculation_code') }),
  helper.accessor('quantity_calculation_name', { meta: { width: 240 }, header: () => i18n.t('masterData.quantityCalculation') }),
  helper.accessor('is_saleable', { meta: { width: 110 }, header: () => i18n.t('masterData.columns.is_saleable'), cell: (info) => info.getValue() ? i18n.t('common.yes') : i18n.t('common.no') }),
  helper.accessor('is_purchasable', { meta: { width: 140 }, header: () => i18n.t('masterData.columns.is_purchasable'), cell: (info) => info.getValue() ? i18n.t('common.yes') : i18n.t('common.no') }),
  helper.accessor('tax_class_code', { meta: { width: 170 }, header: () => i18n.t('masterData.columns.tax_class_code') }),
  helper.accessor('tax_class_name', { meta: { width: 200 }, header: () => i18n.t('masterData.columns.tax_class_name') }),
  helper.accessor('batch_requirement', { meta: { width: 170 }, header: () => i18n.t('masterData.batchRequirement') }),
  helper.accessor('batch_selection_code', { meta: { width: 200 }, header: () => i18n.t('masterData.columns.batch_selection_code') }),
  helper.accessor('batch_selection_name', { meta: { width: 220 }, header: () => i18n.t('masterData.batchSelection') }),
  helper.accessor('intrastat_net_mass_kg', { meta: { width: 260 }, header: () => i18n.t('masterData.columns.intrastat_net_mass_kg'), cell: (info) => formatQuantity(info.getValue()) }),
  helper.accessor('is_exotic', { meta: { width: 90 }, header: () => i18n.t('masterData.columns.is_exotic'), cell: (info) => info.getValue() == null ? '–' : info.getValue() ? i18n.t('common.yes') : i18n.t('common.no') }),
])
