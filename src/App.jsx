import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Camera from './pages/Camera'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import Gallery from './pages/Gallery'
import Login from './pages/Login'
import Layout from './components/Layout'
import { EventProvider, useEvents } from './context/EventContext'
import { AuthProvider, useAuth } from './context/AuthContext'

function RouteGuard({ children }) {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { currentEvent } = useEvents()
  
  // Allow access to login page
  if (location.pathname === '/login') {
    return children
  }
  
  // If admin is logged in, allow access to events page
  if (isAuthenticated && location.pathname === '/events') {
    return children
  }
  
  // If no event selected and not on login page, redirect to login
  if (!currentEvent && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }
  
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Layout>
            <RouteGuard>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/camera" element={<Camera />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </RouteGuard>
          </Layout>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <EventProvider>
        <Router>
          <AppRoutes />
        </Router>
      </EventProvider>
    </AuthProvider>
  )
}

export default App
