import { NavLink, Outlet } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'

const fase1Nav = [
  { to: '/notes', label: 'Notas' },
  { to: '/graph', label: 'Grafo' },
  { to: '/tags', label: 'Tags' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/capture', label: 'Captura rápida' },
]

export function AppShell() {
  const { session } = useAuth()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="px-2 py-1 text-lg font-semibold tracking-tight">Noos</span>
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
        </SidebarContent>
        <SidebarFooter>
          <div className="flex flex-col gap-1 px-2 py-1 text-xs text-muted-foreground">
            <span className="truncate">{session?.user.email}</span>
            <button
              className="text-left underline-offset-2 hover:underline"
              onClick={() => supabase.auth.signOut()}
            >
              Sair
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">Fase 1 — Conhecimento</span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
