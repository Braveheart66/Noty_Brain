/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        "page-edge": "0 12px 30px rgba(20, 10, 0, 0.18)",
        "paper-lift": "0 8px 18px rgba(20, 10, 0, 0.16)",
      },
    },
  },
  plugins: [],
};
