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
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">Fase 1 — Conhecimento</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="truncate text-sm text-muted-foreground">{session?.user.email}</span>
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
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
