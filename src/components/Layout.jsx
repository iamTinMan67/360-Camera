import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Camera, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, isAuthenticated } = useAuth()
  const isCameraPage = location.pathname === '/camera'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const loginTo = '/login'
  const loginState = undefined

  // Camera pages should be truly fullscreen (no sticky nav / constrained main container).
  if (isCameraPage) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="min-h-screen feminine-gradient">
      <nav className="bg-white/80 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-pink-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[60px]">
            <Link
              to="/"
              className="flex items-center space-x-2 group"
            >
              <Camera className="h-8 w-8 text-purple-500 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-2xl font-bold text-purple-600">360 Camera</span>
            </Link>
            
            <div className="flex items-center gap-3">
              {!isAuthenticated ? (
                <Link
                  to={loginTo}
                  state={loginState}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-purple-600 hover:bg-purple-100 transition-all duration-300 hover:shadow-md"
                  title="Login"
                >
                  <span className="font-medium">Login</span>
                </Link>
              ) : (
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-purple-600 hover:bg-purple-100 transition-all duration-300 hover:shadow-md"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline font-medium">Logout</span>
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
