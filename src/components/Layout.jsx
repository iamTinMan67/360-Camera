import { Link, useNavigate } from 'react-router-dom'
import { Camera, LogOut, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { logout, isAuthenticated } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-yellow-100">
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Camera className="h-8 w-8 text-purple-500" />
              <span className="text-2xl font-bold text-purple-600">360 Camera</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated && (
                <Link
                  to="/events"
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Events"
                >
                  <Calendar className="h-5 w-5" />
                  <span className="hidden sm:inline">Events</span>
                </Link>
              )}
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
