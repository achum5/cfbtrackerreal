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
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔐 Auth state changed:', user ? `Logged in as ${user.email}` : 'Not logged in')
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
            console.log('✅ Access token restored from localStorage')
          } else {
            // Token expired, clear it
            localStorage.removeItem('google_access_token')
            localStorage.removeItem('google_token_expiry')
            console.log('⚠️ Access token expired, cleared from localStorage')
          }
        }
      }
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      // Always use popup flow - it works on both desktop and mobile
      // signInWithRedirect is broken on Safari 16.1+, Firefox 109+, Chrome 115+
      // due to third-party storage blocking
      console.log('🔐 Starting Google sign-in with popup...')
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
      // Handle popup blocked error with a helpful message
      if (error.code === 'auth/popup-blocked') {
        console.error('❌ Popup was blocked. Please allow popups for this site.')
        throw new Error('Sign-in popup was blocked. Please allow popups for this site and try again.')
      }
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('ℹ️ User closed the sign-in popup')
        return null // User cancelled, don't throw
      }
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
