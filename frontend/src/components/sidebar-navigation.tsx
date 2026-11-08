import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import { FolderOpen, ListChecks, Package, Settings, UsersRound } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

const managementLinks = [
  { titleKey: 'navigation.customers', to: '/kunden', icon: UsersRound },
  { titleKey: 'navigation.articles', to: '/artikel', icon: Package },
  { titleKey: 'navigation.rules', to: '/regeln', icon: ListChecks },
  { titleKey: 'navigation.settings', to: '/einstellungen', icon: Settings },
] as const

export function SidebarNavigation() {
  const { t } = useTranslation()
  const { pathname, closeMobile } = useSidebarNavigation()

  return (
    <nav aria-label={t('navigation.main')}>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-11 gap-3 text-sm"
                isActive={pathname === '/' || pathname.startsWith('/anfragen/')}
                render={<Link to="/" activeOptions={{ exact: true }} onClick={closeMobile} />}
              >
                <FolderOpen aria-hidden="true" className="size-5!" />
                <span>{t('navigation.inquiries')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel className="mb-1 font-normal">{t('navigation.management')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {managementLinks.map(({ titleKey, to, icon: Icon }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  className="h-11 gap-3 text-sm"
                  isActive={pathname === to}
                  render={<Link to={to} search={{}} onClick={closeMobile} />}
                >
                  <Icon aria-hidden="true" className="size-5!" />
                  <span>{t(titleKey)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  )
}
