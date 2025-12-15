import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)

      // Restore access token from localStorage if available
      if (user) {
        const storedToken = localStorage.getItem('google_access_token')
        const tokenExpiry = localStorage.getItem('google_token_expiry')

        if (storedToken && tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry)
          if (Date.now() < expiryTime) {
            setAccessToken(storedToken)
            user.accessToken = storedToken
          } else {
            // Token expired, clear it
            localStorage.removeItem('google_access_token')
            localStorage.removeItem('google_token_expiry')
          }
        }
      }
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)

      // Get the OAuth access token
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken)
        // Store in user object for easy access
        result.user.accessToken = credential.accessToken

        // Store token in localStorage with 1 hour expiry
        localStorage.setItem('google_access_token', credential.accessToken)
        localStorage.setItem('google_token_expiry', (Date.now() + 3600000).toString()) // 1 hour

        console.log('✅ OAuth access token captured and stored')
      }

      return result.user
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      // Clear stored tokens
      localStorage.removeItem('google_access_token')
      localStorage.removeItem('google_token_expiry')
      setAccessToken(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  const value = {
    user,
    accessToken,
    loading,
    signInWithGoogle,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
