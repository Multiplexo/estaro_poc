import { useTranslation } from '@/i18n'
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function NotFound() {
  const { t } = useTranslation()
  return <div className="space-y-4"><h1 className="text-2xl font-semibold">{t('navigation.notFound')}</h1><Link to="/" className="underline">{t('navigation.home')}</Link></div>
}

function RootLayout() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const section = pathname.startsWith('/kunden') ? 'Kunden' : pathname.startsWith('/artikel') ? 'Artikel' : pathname.startsWith('/regeln') ? 'Regeln' : pathname.startsWith('/einstellungen') ? 'Einstellungen' : 'Anfragen'
  return (
    <TooltipProvider>
      <SidebarProvider>
        <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-3 focus-visible:font-medium focus-visible:outline-2 focus-visible:outline-blue-600">{t('navigation.skipToContent')}</a>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4 md:px-7">
            <SidebarTrigger className="size-9" aria-label={t('navigation.toggleSidebar')} title={t('navigation.toggleSidebar')} />
            <span aria-hidden="true" className="h-5 w-px bg-border" />
            <nav aria-label="Brotkrümelnavigation" className="flex min-w-0 items-center gap-2 text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground">Arbeitsbereich</Link>
              <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="truncate font-medium">{section}</span>
            </nav>
          </header>
          <div id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1920px] min-w-0 scroll-mt-4 px-4 py-6 focus-visible:outline-2 focus-visible:outline-blue-600 md:px-7 xl:px-9 xl:py-8">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
