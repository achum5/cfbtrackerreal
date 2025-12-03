/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'team': {
          'primary': 'var(--team-primary, #ea580c)',
          'secondary': 'var(--team-secondary, #FFFFFF)',
          'tertiary': 'var(--team-tertiary, #fed7aa)',
        }
      }
    },
  },
  plugins: [],
}
