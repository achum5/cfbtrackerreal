import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'

// Detect if we're on a mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

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
    let unsubscribe = () => {}

    const initAuth = async () => {
      try {
        // Set explicit persistence to ensure auth state persists on mobile
        console.log('🔧 Setting auth persistence to LOCAL')
        await setPersistence(auth, browserLocalPersistence)

        // Check for redirect result (for mobile sign-in)
        console.log('🔍 Checking for redirect result...')
        const result = await getRedirectResult(auth)
        if (result) {
          console.log('✅ Sign-in redirect completed', result.user.email)

          // Get the OAuth access token from redirect
          const credential = GoogleAuthProvider.credentialFromResult(result)
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken)
            result.user.accessToken = credential.accessToken

            // Store token in localStorage with 1 hour expiry
            localStorage.setItem('google_access_token', credential.accessToken)
            localStorage.setItem('google_token_expiry', (Date.now() + 3600000).toString())

            console.log('✅ OAuth access token captured from redirect')
          }
        } else {
          console.log('ℹ️ No redirect result found (normal page load)')
        }
      } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
          console.error('❌ Redirect/persistence error:', error)
        }
      }

      // Set up auth state listener
      unsubscribe = onAuthStateChanged(auth, (user) => {
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
    }

    initAuth()

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      // Ensure persistence is set before sign-in
      await setPersistence(auth, browserLocalPersistence)

      // Use redirect on mobile devices, popup on desktop
      if (isMobileDevice()) {
        console.log('📱 Mobile device detected, using redirect flow')
        await signInWithRedirect(auth, googleProvider)
        // The redirect will happen, result handled in useEffect
        return
      }

      // Desktop - use popup flow
      console.log('💻 Desktop detected, using popup flow')
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
