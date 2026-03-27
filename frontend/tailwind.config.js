/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#e8f7ee',
          100: '#d1eedd',
          200: '#a3ddbc',
          300: '#75cb9b',
          400: '#47ba7a',
          500: '#19a959',
          600: '#00A651', /* Huynh Thy Green (Mapped to primary class 'blue') */
          700: '#026835', /* HT Dark Green */
          800: '#014925',
          900: '#012a15',
        },
        orange: {
          500: '#FF6600',
          600: '#e65c00',
        }
      },
      fontFamily: {
        sans: ['Roboto', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'md': '4px',
        'lg': '6px',
        'xl': '8px', 
        /* Flattening extreme curves to match B2B Industrial strictness */
      }
    },
  },
  plugins: [],
}
