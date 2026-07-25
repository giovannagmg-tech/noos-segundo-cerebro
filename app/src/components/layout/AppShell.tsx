import { NavLink, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from './ThemeToggle'

const fase1Nav = [
  { to: '/notes', label: 'Notas' },
  { to: '/graph', label: 'Grafo' },
  { to: '/tags', label: 'Tags' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/capture', label: 'Captura rápida' },
]

const fase2Nav = [
  { to: '/tasks', label: 'Tarefas', end: true },
  { to: '/tasks/eisenhower', label: 'Eisenhower' },
  { to: '/projects', label: 'Projetos' },
  { to: '/habits', label: 'Hábitos' },
  { to: '/goals', label: 'Metas' },
  { to: '/metrics', label: 'Métricas' },
  { to: '/rewards', label: 'Recompensas' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/calendar', label: 'Calendário' },
  { to: '/insights', label: 'Insights' },
  { to: '/settings', label: 'Configurações' },
]

export function AppShell() {
  const { session } = useAuth()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo size={22} className="px-2 py-1" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Conhecimento</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {fase1Nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => (isActive ? 'font-medium text-sidebar-primary' : '')}
                      >
                        {item.label}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Produtividade</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {fase2Nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => (isActive ? 'font-medium text-sidebar-primary' : '')}
                      >
                        {item.label}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <Logo size={18} className="sm:hidden" />
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
              {session?.user.email}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
