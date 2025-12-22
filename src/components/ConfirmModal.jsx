export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonColor = "#ef4444",
  confirmButtonTextColor = "#ffffff"
}) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    // Don't auto-close - let parent handle closing via onConfirm if needed
    // This allows multi-step confirmations (e.g., favorited dynasty delete)
  }

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center p-4" style={{ margin: 0 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          {title}
        </h2>

        <p className="text-gray-600 mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors"
            style={{
              backgroundColor: confirmButtonColor,
              color: confirmButtonTextColor
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
