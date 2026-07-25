import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Toaster } from '@/components/ui/sonner'
import Login from '@/pages/Login'
import Notes from '@/pages/Notes'
import NoteDetail from '@/pages/NoteDetail'
import Graph from '@/pages/Graph'
import Tags from '@/pages/Tags'
import Pomodoro from '@/pages/Pomodoro'
import Capture from '@/pages/Capture'
import Tasks from '@/pages/Tasks'
import TasksEisenhower from '@/pages/TasksEisenhower'
import Projects from '@/pages/Projects'
import ProjectDetail from '@/pages/ProjectDetail'
import Habits from '@/pages/Habits'
import Goals from '@/pages/Goals'
import Metrics from '@/pages/Metrics'
import Rewards from '@/pages/Rewards'
import Agenda from '@/pages/Agenda'
import CalendarPage from '@/pages/Calendar'
import Insights from '@/pages/Insights'
import Settings from '@/pages/Settings'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/notes" element={<Notes />} />
              <Route path="/notes/:id" element={<NoteDetail />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/pomodoro" element={<Pomodoro />} />
              <Route path="/capture" element={<Capture />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/eisenhower" element={<TasksEisenhower />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/habits" element={<Habits />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/notes" replace />} />
            <Route path="*" element={<Navigate to="/notes" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
