import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Try to import auth.js, fallback to default credentials
      // Note: In a client-side app, credentials will be visible in the bundle
      let ADMIN_CREDENTIALS
      try {
        const authModule = await import('../config/auth.js')
        ADMIN_CREDENTIALS = authModule.ADMIN_CREDENTIALS
      } catch (importError) {
        // If auth.js doesn't exist (e.g., in Vercel build), use default fallback
        ADMIN_CREDENTIALS = {
          username: 'Sal@sb',
          password: 'sal@SB'
        }
      }
      
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const success = await login(username, password)
        if (success) {
          navigate('/events')
        } else {
          setError('Login failed. Please try again.')
        }
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      setError('Authentication error. Please check configuration.')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-purple-100 p-4 rounded-full">
              <Camera className="h-12 w-12 text-purple-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-purple-600 mb-2">360 Camera</h1>
          <p className="text-gray-600">Admin Login Required</p>
        </div>

        <div className="bg-yellow-50 rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="inline-block h-4 w-4 mr-2" />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Lock className="inline-block h-4 w-4 mr-2" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-lg"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Admin access required for delete operations
        </p>
      </div>
    </div>
  )
}
