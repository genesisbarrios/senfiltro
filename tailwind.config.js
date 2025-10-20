/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
  extend: {
  colors: {
    blue: '#1976D2',
    aqua: '#00BCD4',
    lightBlue: '#E3F2FD',
    darkText: '#212121',
    green: '#43A047',
    red: "#e13b3bff"
    darkBg: '#121212',
  },
},

  },
  plugins: [],
}
