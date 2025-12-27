import { useState, useEffect } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { generateShareCode } from '../services/dynastyService'
import { getContrastTextColor } from '../utils/colorUtils'

export default function ShareDynastyModal({ isOpen, onClose, teamColors, dynasty: dynastyProp }) {
  const { currentDynasty: contextDynasty, updateDynasty } = useDynasty()
  // Use prop dynasty if provided (from Home page), otherwise use context dynasty (from Sidebar)
  const dynasty = dynastyProp || contextDynasty
  const [isPublic, setIsPublic] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  useEffect(() => {
    if (dynasty) {
      setIsPublic(dynasty.isPublic || false)
      setShareCode(dynasty.shareCode || '')
    }
  }, [dynasty])

  const handleToggleSharing = async () => {
    if (!dynasty) return

    setLoading(true)
    try {
      const newIsPublic = !isPublic

      // If enabling sharing for the first time, generate a share code
      let newShareCode = shareCode
      if (newIsPublic && !shareCode) {
        newShareCode = generateShareCode()
      }

      await updateDynasty(dynasty.id, {
        isPublic: newIsPublic,
        shareCode: newShareCode
      })

      setIsPublic(newIsPublic)
      setShareCode(newShareCode)
    } catch (error) {
      console.error('Error toggling sharing:', error)
      alert('Failed to update sharing settings')
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = shareCode ? `${window.location.origin}/view/${shareCode}` : ''

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: teamColors.primary }}
        >
          <h2 className="text-xl font-bold" style={{ color: primaryBgText }}>
            Share Dynasty
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10"
            style={{ color: primaryBgText }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="mb-6" style={{ color: secondaryBgText }}>
            Share your dynasty with viewers! They'll be able to see your schedule, roster, stats, and more in read-only mode.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-black/10 mb-6">
            <div>
              <div className="font-semibold" style={{ color: secondaryBgText }}>
                Public Sharing
              </div>
              <div className="text-sm opacity-70" style={{ color: secondaryBgText }}>
                {isPublic ? 'Anyone with the link can view' : 'Only you can access this dynasty'}
              </div>
            </div>
            <button
              onClick={handleToggleSharing}
              disabled={loading}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                loading ? 'opacity-50' : ''
              }`}
              style={{
                backgroundColor: isPublic ? teamColors.primary : '#374151'
              }}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  isPublic ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Share Link */}
          {isPublic && shareCode && (
            <div className="space-y-3">
              <label className="block text-sm font-medium" style={{ color: secondaryBgText }}>
                Share Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-4 py-3 rounded-lg bg-black/10 text-sm font-mono"
                  style={{ color: secondaryBgText }}
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 rounded-lg font-semibold transition-all"
                  style={{
                    backgroundColor: copied ? '#22c55e' : teamColors.primary,
                    color: primaryBgText
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-sm opacity-60" style={{ color: secondaryBgText }}>
                Viewers will see your dynasty data but cannot make any changes.
              </p>
            </div>
          )}

          {/* Info for YouTubers */}
          <div className="mt-6 p-4 rounded-lg border-2 border-dashed" style={{ borderColor: teamColors.primary }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎥</span>
              <div>
                <div className="font-semibold mb-1" style={{ color: secondaryBgText }}>
                  Perfect for Content Creators
                </div>
                <div className="text-sm opacity-70" style={{ color: secondaryBgText }}>
                  Put this link in your video descriptions so viewers can follow along with your dynasty series!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
