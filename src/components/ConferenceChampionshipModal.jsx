import { useState, useEffect } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import {
  createConferenceChampionshipSheet,
  readConferenceChampionshipsFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl
} from '../services/sheetsService'

export default function ConferenceChampionshipModal({ isOpen, onClose, onSave, currentYear, teamColors }) {
  const { currentDynasty, updateDynasty } = useDynasty()
  const { user, signOut, refreshSession } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [showDeletedNote, setShowDeletedNote] = useState(false)
  const [retryCount, setRetryCount] = useState(0) // Used to trigger sheet creation retry

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Create a CC sheet when modal opens if user is authenticated
  useEffect(() => {
    const createSheet = async () => {
      if (isOpen && user && !sheetId && !creatingSheet) {
        // Check if we have an existing CC sheet for this year
        const existingSheetId = currentDynasty?.conferenceChampionshipSheetId
        if (existingSheetId) {
          setSheetId(existingSheetId)
          return
        }

        setCreatingSheet(true)
        try {
          console.log('📝 Creating Conference Championship sheet...')

          // Check if user played in a CC game this year - if so, exclude their conference
          const userCCGame = currentDynasty?.games?.find(
            g => g.isConferenceChampionship && g.year === currentYear
          )
          const excludeConference = userCCGame ? currentDynasty?.conference : null
          if (excludeConference) {
            console.log(`Excluding ${excludeConference} from sheet - user already played CC game`)
          }

          const sheetInfo = await createConferenceChampionshipSheet(
            currentDynasty?.teamName || 'Dynasty',
            currentYear,
            excludeConference
          )
          setSheetId(sheetInfo.spreadsheetId)

          // Save sheet ID to dynasty
          await updateDynasty(currentDynasty.id, {
            conferenceChampionshipSheetId: sheetInfo.spreadsheetId
          })

          console.log('✅ Conference Championship sheet ready')
        } catch (error) {
          console.error('Failed to create CC sheet:', error)
        } finally {
          setCreatingSheet(false)
        }
      }
    }

    createSheet()
  }, [isOpen, user, sheetId, creatingSheet, currentDynasty?.id, retryCount])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeletedNote(false)
    }
  }, [isOpen])

  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      const championships = await readConferenceChampionshipsFromSheet(sheetId)
      console.log('Conference Championships read from sheet:', championships)

      await onSave(championships)
      console.log('Conference Championships saved successfully')

      onClose()
    } catch (error) {
      alert('Failed to sync from Google Sheets. Make sure data is properly formatted.')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      const championships = await readConferenceChampionshipsFromSheet(sheetId)
      await onSave(championships)

      // Delete the sheet
      console.log('🗑️ Deleting CC sheet...')
      await deleteGoogleSheet(sheetId)

      // Clear sheet ID from dynasty
      await updateDynasty(currentDynasty.id, {
        conferenceChampionshipSheetId: null
      })

      setSheetId(null)
      console.log('✅ CC sheet deleted')

      setShowDeletedNote(true)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (error) {
      alert('Failed to sync from Google Sheets.')
      console.error(error)
    } finally {
      setDeletingSheet(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId, 'Conference Championships') : null
  const isLoading = creatingSheet

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={handleClose}
    >
      <div
        className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col p-6"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            Conference Championship Week
          </h2>
          <button
            onClick={handleClose}
            className="hover:opacity-70"
            style={{ color: teamColors.primary }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div
                className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
                style={{
                  borderColor: teamColors.primary,
                  borderTopColor: 'transparent'
                }}
              />
              <p className="text-lg font-semibold" style={{ color: teamColors.primary }}>
                Creating Conference Championship Sheet...
              </p>
              <p className="text-sm mt-2" style={{ color: teamColors.primary, opacity: 0.7 }}>
                Setting up conferences and team dropdowns
              </p>
            </div>
          </div>
        ) : showDeletedNote ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 rounded-lg" style={{ backgroundColor: teamColors.primary }}>
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke={teamColors.secondary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xl font-bold mb-2" style={{ color: teamColors.secondary }}>
                Saved & Sheet Deleted!
              </p>
              <p className="text-sm" style={{ color: teamColors.secondary, opacity: 0.9 }}>
                Conference Championship data saved to your dynasty.
              </p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="mb-3 flex gap-3 flex-wrap">
              <button
                onClick={handleSyncAndDelete}
                disabled={syncing || deletingSheet}
                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                style={{
                  backgroundColor: teamColors.primary,
                  color: teamColors.secondary
                }}
              >
                {deletingSheet ? 'Saving...' : '✓ Save & Move to Trash'}
              </button>
              <button
                onClick={handleSyncFromSheet}
                disabled={syncing || deletingSheet}
                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm border-2"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: teamColors.primary,
                  color: teamColors.primary
                }}
              >
                {syncing ? 'Syncing...' : 'Save & Keep Sheet'}
              </button>
            </div>

            <div className="flex-1 border-4 rounded-lg overflow-hidden" style={{ borderColor: teamColors.primary }}>
              <iframe
                src={embedUrl}
                className="w-full h-full"
                frameBorder="0"
                title="Conference Championships Google Sheet"
              />
            </div>

            <div className="text-xs mt-2 space-y-1" style={{ color: teamColors.primary, opacity: 0.6 }}>
              <p><strong>Columns:</strong> Conference | Team 1 | Team 2 | Team 1 Score | Team 2 Score</p>
              <p>Fill in the teams playing in each conference championship game and their scores.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg mb-4" style={{ color: teamColors.primary }}>
                Your session has expired. Click below to refresh.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={async () => {
                    setRefreshing(true)
                    try {
                      const success = await refreshSession()
                      if (success) {
                        // Trigger sheet creation retry
                        setRetryCount(c => c + 1)
                      }
                    } catch (e) {
                      console.error('Refresh failed:', e)
                    }
                    setRefreshing(false)
                  }}
                  disabled={refreshing}
                  className="px-4 py-2 rounded font-semibold transition-colors"
                  style={{
                    backgroundColor: teamColors.primary,
                    color: teamColors.primaryText || '#fff',
                    opacity: refreshing ? 0.7 : 1
                  }}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh Session'}
                </button>
                <button
                  onClick={signOut}
                  className="px-4 py-2 rounded font-semibold transition-colors border"
                  style={{
                    borderColor: teamColors.primary,
                    color: teamColors.primary,
                    backgroundColor: 'transparent'
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
