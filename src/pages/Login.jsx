import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Login() {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      console.log('👤 User detected in Login page, navigating to home...')
      navigate('/')
    }
  }, [user, navigate])

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle()
      // Navigate if sign-in was successful
      // Returns null if user closed popup (not an error)
      if (result) {
        navigate('/')
      }
    } catch (error) {
      console.error('Sign in failed:', error)
      alert(error.message || 'Failed to sign in. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              CFB Dynasty Tracker
            </h1>
          </div>

          {/* Personal Message */}
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 mb-8">
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Hey! I'm a huge fan of CFB dynasty mode, but honestly it drives me crazy that there's no way to track your history inside the game. Like, I want to see how my players developed over the years, look back at championship seasons, track career stats... all that stuff.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                So I built this. It's basically a way to keep a record of everything that matters in your dynasty - schedules, rosters, player progression, game results, all of it. No more forgetting who won the Heisman 3 years ago or what that legendary QB's stats were.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Big shoutout to Reddit user{' '}
                <a
                  href="https://www.reddit.com/user/FireButchJones"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 underline"
                >
                  u/FireButchJones
                </a>
                {' '}for the inspiration. Their spreadsheet tracking setup was genius and gave me the idea to make this tool.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Login to your google account below. This gives you the ability to easily add in data to your league using embedded google sheets which I found to be by far the most efficient way to use this.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Also it entirely runs in the cloud using Google Firebase! So once you are logged into your google account, your dynasty will be saved device to device.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed">
                I hope you enjoy!
              </p>
            </div>
          </div>

          {/* Sign In Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Ready to track your dynasty?
              </h2>
              <p className="text-gray-600 text-sm">
                Sign in with Google to get started
              </p>
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-xl px-6 py-4 font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-lg transition-all shadow-md"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Your data is stored securely and synced across all your devices
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
