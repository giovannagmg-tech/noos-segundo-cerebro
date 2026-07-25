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
