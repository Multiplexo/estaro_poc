import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import logo from '@/assets/estaro-logo.svg'
import { RecentInquiries } from '@/components/inquiries/recent-inquiries'
import { SidebarNavigation } from '@/components/sidebar-navigation'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarTrigger } from '@/components/ui/sidebar'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

export function AppSidebar() {
  const { t } = useTranslation()
  const { closeMobile } = useSidebarNavigation()

  return (
    <Sidebar>
      <SidebarHeader className="relative border-b border-sidebar-border bg-sidebar px-6 py-6">
        <Link to="/" aria-label={t('navigation.overview')} onClick={closeMobile} className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring">
          <img src={logo} alt="Estaro" width={886} height={210} className="h-auto w-44" />
        </Link>
        <SidebarTrigger className="absolute top-7 right-2 size-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden" aria-label={t('navigation.close')} />
      </SidebarHeader>
      <SidebarContent className="gap-5 px-3 pt-5 pb-6">
        <SidebarNavigation />
        <RecentInquiries />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-6 py-5">
        <p className="text-xs font-medium text-white">Ihr Anfrage-Workspace</p>
        <p className="mt-1 text-xs text-sidebar-foreground">Alles im Blick. Bis ins Detail.</p>
      </SidebarFooter>
    </Sidebar>
  )
}
