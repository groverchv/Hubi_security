/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          DEFAULT: '#8FA28F',
          light: '#A7B9A7',
          dark: '#768B76',
        },
        mint: {
          DEFAULT: '#C4DFD2',
          light: '#DAEBE2',
          dark: '#A6CFBC',
        },
        sky: {
          DEFAULT: '#A3C4DC',
          light: '#C1D9EC',
          dark: '#85B0CE',
        },
        oat: {
          DEFAULT: '#EADDCE',
          light: '#F4ECE3',
          dark: '#DCCBBA',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'zen-sm': '0 2px 8px -2px rgba(143, 162, 143, 0.15)',
        'zen-md': '0 8px 24px -4px rgba(143, 162, 143, 0.20)',
        'zen-glow': '0 0 20px 2px rgba(196, 223, 210, 0.5)',
      },
    },
  },
  plugins: [],
}
