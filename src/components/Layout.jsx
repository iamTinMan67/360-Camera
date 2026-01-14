import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Camera, LogOut, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, isAuthenticated } = useAuth()
  const isCameraPage = location.pathname === '/camera' || location.pathname.startsWith('/camera?')
  const [searchParams] = useSearchParams()
  const mode = isCameraPage ? (searchParams.get('mode') || 'photo') : null

  const handleLogout = () => {
    logout()
    navigate(isCameraPage ? '/login?next=/events' : '/login', {
      state: isCameraPage ? { backgroundLocation: location } : undefined
    })
  }

  const loginTo = isCameraPage ? '/login?next=/events' : '/login'
  const loginState = isCameraPage ? { backgroundLocation: location } : undefined

  return (
    <div className="min-h-screen feminine-gradient">
      <nav className="bg-white/80 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-pink-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[60px]">
            <Link
              to={isCameraPage && !isAuthenticated ? '/login?next=/events' : '/'}
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

      {isCameraPage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ height: '100px', paddingTop: '15px', paddingBottom: '15px' }}>
          <div className="card" style={{ height: '75px', paddingTop: '15px', paddingBottom: '15px' }}>
            <div className="flex items-center justify-between mb-6">
              <Link
                to={isAuthenticated ? '/' : '/login?next=/events'}
                className="text-green-600 hover:text-green-700 text-2xl font-semibold leading-[30px] transition-all duration-300"
              >
                ← Back
              </Link>
              <h1 className="text-3xl font-bold text-center flex-1 max-w-[638px] mx-auto text-purple-600">
                {mode === 'video' ? '360 Video' : 'Photo Booth'}
              </h1>
              <div className="w-16" />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
