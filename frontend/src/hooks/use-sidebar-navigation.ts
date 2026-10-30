import { useRouterState } from '@tanstack/react-router'
import { useSidebar } from '@/hooks/use-sidebar'

export function useSidebarNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { setOpenMobile } = useSidebar()

  return {
    pathname,
    closeMobile: () => setOpenMobile(false),
  }
}
