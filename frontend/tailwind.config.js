/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      maxWidth: {
        '6xl': '72rem',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
