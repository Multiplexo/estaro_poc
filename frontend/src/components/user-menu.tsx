import { useTranslation } from '@/i18n'
import { LogOut, UserRound } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useCurrentUser } from '@/hooks/use-current-user'

export function UserMenu() {
  const { t } = useTranslation()
  const api = useApi()
  const user = useCurrentUser().data
  if (!user) return null

  return (
    <div className="mt-auto flex items-center gap-3 border-t border-sidebar-border px-3 pt-4 text-sm">
      <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.is_admin ? t('session.roleAdmin') : t('session.roleUser')}</p>
      </div>
      <a
        href={api.instance.getUri({ url: '/session/logout' })}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"
        aria-label={t('session.logout')}
        title={t('session.logout')}
      >
        <LogOut aria-hidden="true" className="size-4" />
      </a>
    </div>
  )
}
