/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        blueprint: {
          950: "#050B14",
          900: "#0A1628",
          800: "#101F35",
          700: "#1B2E4A",
          600: "#2A415F",
          500: "#3E5C82",
          line: "#1E3450",
        },
        ink: {
          100: "#EDEFF2",
          300: "#B7C2D0",
          500: "#8CA0B8",
        },
        signal: {
          DEFAULT: "#FFA200",
          dim: "#C97D00",
          soft: "#FFC85C",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgba(30,52,80,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(30,52,80,0.55) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
    },
  },
  plugins: [],
};
