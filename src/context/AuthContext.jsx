import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is already logged in (from sessionStorage)
  useEffect(() => {
    const authStatus = sessionStorage.getItem('isAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      // Try to import auth.js, fallback to environment variables or example file
      let ADMIN_CREDENTIALS
      try {
        const authModule = await import('../config/auth.js')
        ADMIN_CREDENTIALS = authModule.ADMIN_CREDENTIALS
      } catch (importError) {
        // If auth.js doesn't exist, use environment variables or fallback to example
        ADMIN_CREDENTIALS = {
          username: import.meta.env.VITE_ADMIN_USERNAME || 'Sal@sb',
          password: import.meta.env.VITE_ADMIN_PASSWORD || 'sal@SB'
        }
      }
      
      if (
        username === ADMIN_CREDENTIALS.username &&
        password === ADMIN_CREDENTIALS.password
      ) {
        setIsAuthenticated(true)
        sessionStorage.setItem('isAuthenticated', 'true')
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('isAuthenticated')
  }

  const value = {
    isAuthenticated,
    isLoading,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
