import { useState, useEffect } from 'react'
import ScheduleSpreadsheet from './ScheduleSpreadsheet'
import { getSheetEmbedUrl, readScheduleFromSheet, readRosterFromSheet } from '../services/sheetsService'
import { useDynasty } from '../context/DynastyContext'

export default function ScheduleEntryModal({ isOpen, onClose, onSave, onRosterSave, currentYear, teamColors }) {
  const { currentDynasty } = useDynasty()
  const [syncing, setSyncing] = useState(false)

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSave = async (schedule) => {
    try {
      await onSave(schedule)
      onClose()
    } catch (error) {
      alert('Failed to save schedule.')
      console.error(error)
    }
  }

  const handleSyncFromSheet = async () => {
    if (!currentDynasty?.googleSheetId) return

    setSyncing(true)
    try {
      // Sync both schedule and roster
      const schedule = await readScheduleFromSheet(currentDynasty.googleSheetId)
      console.log('Schedule read from sheet:', schedule)

      const roster = await readRosterFromSheet(currentDynasty.googleSheetId)
      console.log('Roster read from sheet:', roster)

      // Save both
      await onSave(schedule)
      console.log('Schedule saved successfully')

      await onRosterSave(roster)
      console.log('Roster saved successfully')

      onClose()
    } catch (error) {
      alert('Failed to sync from Google Sheets. Make sure you have edit access and data is properly formatted.')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  if (!isOpen) return null

  const hasGoogleSheet = currentDynasty?.googleSheetId
  const embedUrl = hasGoogleSheet ? getSheetEmbedUrl(currentDynasty.googleSheetId, 'Schedule') : null

  console.log('ScheduleEntryModal - hasGoogleSheet:', hasGoogleSheet)
  console.log('ScheduleEntryModal - googleSheetId:', currentDynasty?.googleSheetId)
  console.log('ScheduleEntryModal - embedUrl:', embedUrl)

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col p-6"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            Schedule and Roster Entry
          </h2>
          <button
            onClick={onClose}
            className="hover:opacity-70"
            style={{ color: teamColors.primary }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {hasGoogleSheet ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="mb-3">
              <button
                onClick={handleSyncFromSheet}
                disabled={syncing}
                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                style={{
                  backgroundColor: teamColors.primary,
                  color: teamColors.secondary
                }}
              >
                {syncing ? 'Syncing...' : '✓ Sync & Save'}
              </button>
            </div>

            <div className="flex-1 border-4 rounded-lg overflow-hidden" style={{ borderColor: teamColors.primary }}>
              <iframe
                src={embedUrl}
                className="w-full h-full"
                frameBorder="0"
                title="Schedule Google Sheet"
              />
            </div>

            <div className="text-xs mt-2 space-y-1" style={{ color: teamColors.primary, opacity: 0.6 }}>
              <p><strong>Schedule Tab:</strong> Week | User Team | CPU Team | Site</p>
              <p><strong>Roster Tab:</strong> Name | Position | Class | Dev Trait | Overall Rating</p>
            </div>
          </div>
        ) : (
          <ScheduleSpreadsheet
            teamColors={teamColors}
            currentYear={currentYear}
            onSave={handleSave}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  )
}
