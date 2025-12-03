import { useState, useRef, useEffect } from 'react'
import { getTeamColors } from '../data/teamColors'
import { getTeamLogo } from '../data/teams'

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  required = false,
  teamColors = { primary: '#ea580c', secondary: '#FFFFFF' }
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm])

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    setIsOpen(true)
  }

  const handleOptionClick = (option) => {
    onChange(option)
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          handleOptionClick(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearchTerm('')
        inputRef.current?.blur()
        break
      default:
        break
    }
  }

  const displayValue = value || searchTerm

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label 
          className="block text-sm font-medium mb-2"
          style={{ color: teamColors.primary }}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {value && getTeamLogo(value) && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <img
              src={getTeamLogo(value)}
              alt={`${value} logo`}
              className="w-6 h-6 object-contain"
            />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-2 border-2 rounded-lg focus:ring-2 focus:outline-none transition-colors"
          style={{
            borderColor: `${teamColors.primary}40`,
            paddingLeft: value && getTeamLogo(value) ? '2.75rem' : '1rem',
            paddingRight: '2.75rem'
          }}
          autoComplete="off"
          required={required}
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: teamColors.primary }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div 
          className="absolute z-10 w-full mt-1 bg-white border-2 rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{ borderColor: `${teamColors.primary}40` }}
        >
          {filteredOptions.map((option, index) => {
            const optionColors = getTeamColors(option)
            const logoUrl = getTeamLogo(option)
            const isHighlighted = index === highlightedIndex
            const isSelected = value === option

            return (
              <div
                key={option}
                onClick={() => handleOptionClick(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className="px-4 py-2 cursor-pointer transition-colors flex items-center gap-3"
                style={{
                  backgroundColor: isHighlighted ? optionColors.primary : isSelected ? `${optionColors.primary}20` : 'white',
                  color: isHighlighted ? optionColors.secondary : 'inherit'
                }}
              >
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={`${option} logo`}
                    className="w-8 h-8 object-contain"
                  />
                )}
                <span className={isSelected ? 'font-medium' : ''}>
                  {option}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {isOpen && searchTerm && filteredOptions.length === 0 && (
        <div 
          className="absolute z-10 w-full mt-1 bg-white border-2 rounded-lg shadow-lg p-4 text-center text-gray-500"
          style={{ borderColor: `${teamColors.primary}40` }}
        >
          No teams found matching "{searchTerm}"
        </div>
      )}
    </div>
  )
}
