import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import logo from '@/assets/estaro-logo.png'
import { RecentInquiries } from '@/components/inquiries/recent-inquiries'
import { SidebarNavigation } from '@/components/sidebar-navigation'
import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from '@/components/ui/sidebar'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

export function AppSidebar() {
  const { t } = useTranslation()
  const { closeMobile } = useSidebarNavigation()

  return (
    <Sidebar>
      <SidebarHeader className="relative px-5 pt-7 pb-5">
        <Link to="/" aria-label={t('navigation.overview')} onClick={closeMobile} className="w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring">
          <img src={logo} alt="Estaro" className="h-auto w-44" width={887} height={210} />
        </Link>
        <SidebarTrigger className="absolute top-7 right-2 size-9 md:hidden" aria-label={t('navigation.close')} />
      </SidebarHeader>
      <SidebarContent className="px-2 pb-6">
        <SidebarNavigation />
        <RecentInquiries />
      </SidebarContent>
    </Sidebar>
  )
}
