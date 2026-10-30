import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useRecentInquiries } from '@/hooks/use-recent-inquiries'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

export function RecentInquiries() {
  const { t } = useTranslation()
  const query = useRecentInquiries()
  const { pathname, closeMobile } = useSidebarNavigation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel render={<h2 />} className="mb-1 font-normal">
        {t('navigation.recent')}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {query.isPending ? (
          <div role="status" className="space-y-3 px-2 py-3">
            <span className="sr-only">{t('navigation.recentLoading')}</span>
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : null}
        {query.isError ? (
          <div className="space-y-2 px-2 py-2">
            <p role="alert" className="text-xs text-muted-foreground">
              {t('navigation.recentError')}
            </p>
            <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
              {t('navigation.retry')}
            </Button>
          </div>
        ) : null}
        {query.data?.items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{t('navigation.noInquiries')}</p>
        ) : null}
        <SidebarMenu className="gap-1" aria-label={t('navigation.recent')}>
          {query.data?.items.map((inquiry) => {
            const title = inquiry.documents[0]?.filename ?? t('navigation.inquiry', { id: inquiry.id.slice(0, 8) })

            return (
              <SidebarMenuItem key={inquiry.id}>
                <SidebarMenuButton
                  className="h-10 font-normal"
                  title={title}
                  isActive={pathname === `/anfragen/${inquiry.id}` || pathname.startsWith(`/anfragen/${inquiry.id}/`)}
                  render={<Link to="/anfragen/$inquiryId" params={{ inquiryId: inquiry.id }} onClick={closeMobile} />}
                >
                  <span>{title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
