import { useTranslation } from '@/i18n'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
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
  return (
    <TooltipProvider>
      <SidebarProvider>
        <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-3 focus-visible:font-medium focus-visible:outline-2 focus-visible:outline-blue-600">{t('navigation.skipToContent')}</a>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-12 shrink-0 items-center border-b px-4 md:px-6">
            <SidebarTrigger className="size-9" aria-label={t('navigation.toggleSidebar')} title={t('navigation.toggleSidebar')} />
          </header>
          <div id="main-content" tabIndex={-1} className="w-full scroll-mt-4 px-4 py-5 focus-visible:outline-2 focus-visible:outline-blue-600 md:px-6 xl:px-8">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
