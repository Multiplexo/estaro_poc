import { useTranslation } from '@/i18n'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '@/components/data-table'
import { articleColumns } from '@/components/master-data/article-columns'
import { articlesResource } from '@/lib/master-data'

export const Route = createFileRoute('/artikel')({ component: ArticlesPage })

function ArticlesPage() {
  const { t } = useTranslation()
  return (
    <section className="space-y-6">
      <header className="page-heading"><div className="space-y-2">
        <p className="page-eyebrow">{t('masterData.eyebrow')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('navigation.articles')}</h1>
        <p className="text-sm text-muted-foreground">{t('masterData.articlesDescription')}</p>
      </div></header>
      <DataTable resource={articlesResource} columns={articleColumns} caption={t('matching.articleSource')} emptyMessage={t('masterData.noArticles')} searchLabel={t('masterData.searchArticles')} searchPlaceholder={t('masterData.articleSearchPlaceholder')} />
    </section>
  )
}
