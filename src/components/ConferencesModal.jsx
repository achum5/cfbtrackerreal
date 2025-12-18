import { useState, useEffect } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import {
  createConferencesSheet,
  readConferencesFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl
} from '../services/sheetsService'

export default function ConferencesModal({ isOpen, onClose, onSave, teamColors }) {
  const { currentDynasty, updateDynasty } = useDynasty()
  const { user, signOut, refreshSession } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [showDeletedNote, setShowDeletedNote] = useState(false)

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

  // Create Conferences sheet when modal opens
  useEffect(() => {
    const createSheet = async () => {
      if (isOpen && user && !sheetId && !creatingSheet) {
        // Check if we have an existing conferences sheet
        const existingSheetId = currentDynasty?.conferencesSheetId
        if (existingSheetId) {
          setSheetId(existingSheetId)
          return
        }

        setCreatingSheet(true)
        try {
          console.log('Creating Conferences sheet...')

          const sheetInfo = await createConferencesSheet(
            currentDynasty?.teamName || 'Dynasty',
            currentDynasty?.currentYear || new Date().getFullYear()
          )
          setSheetId(sheetInfo.spreadsheetId)

          // Save sheet ID to dynasty
          await updateDynasty(currentDynasty.id, {
            conferencesSheetId: sheetInfo.spreadsheetId,
            conferencesSheetUrl: sheetInfo.spreadsheetUrl
          })

          console.log('Conferences sheet ready')
        } catch (error) {
          console.error('Failed to create conferences sheet:', error)
        } finally {
          setCreatingSheet(false)
        }
      }
    }

    createSheet()
  }, [isOpen, user, sheetId, creatingSheet, currentDynasty?.id])

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
      const conferences = await readConferencesFromSheet(sheetId)
      console.log('Conferences read from sheet:', conferences)

      await onSave(conferences)
      console.log('Conferences saved successfully')

      onClose()
    } catch (error) {
      alert('Failed to sync from Google Sheets.')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      const conferences = await readConferencesFromSheet(sheetId)
      await onSave(conferences)

      // Delete the sheet
      console.log('Deleting conferences sheet...')
      await deleteGoogleSheet(sheetId)

      // Clear sheet ID from dynasty
      await updateDynasty(currentDynasty.id, {
        conferencesSheetId: null,
        conferencesSheetUrl: null
      })

      setSheetId(null)
      console.log('Conferences sheet deleted')

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

  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId, 'Conferences') : null
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
            Custom Conferences
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
                Creating Conferences Sheet...
              </p>
              <p className="text-sm mt-2" style={{ color: teamColors.primary, opacity: 0.7 }}>
                Setting up default EA CFB 26 conference alignment
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
                Conference alignment saved to your dynasty.
              </p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="mb-3">
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleSyncAndDelete}
                  disabled={syncing || deletingSheet}
                  className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                  style={{
                    backgroundColor: teamColors.primary,
                    color: teamColors.secondary
                  }}
                >
                  {deletingSheet ? 'Saving...' : 'Save & Move to Trash'}
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
            </div>

            <div className="flex-1 border-4 rounded-lg overflow-hidden" style={{ borderColor: teamColors.primary }}>
              <iframe
                src={embedUrl}
                className="w-full h-full"
                frameBorder="0"
                title="Conference Alignment Google Sheet"
              />
            </div>

            <div className="text-xs mt-2 space-y-1" style={{ color: teamColors.primary, opacity: 0.6 }}>
              <p><strong>Columns:</strong> Each conference (alphabetically) with teams listed below</p>
              <p>Pre-filled with EA CFB 26 default alignment. Edit team placements as needed for your dynasty.</p>
              <p>Use team abbreviations from the dropdown (e.g., BAMA, OSU, UGA).</p>
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
                      await refreshSession()
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
