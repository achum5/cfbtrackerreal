import ScheduleSpreadsheet from './ScheduleSpreadsheet'

export default function ScheduleEntryModal({ isOpen, onClose, onSave, currentYear, teamColors }) {
  const handleSave = (schedule) => {
    onSave(schedule)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6"
        style={{ backgroundColor: teamColors.secondary }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            Schedule Entry - Spreadsheet View
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

        <ScheduleSpreadsheet
          teamColors={teamColors}
          currentYear={currentYear}
          onSave={handleSave}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
