import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // AMTA brand color and its accent companions. Use as bg-maroon,
        // text-maroon-700, border-maroon-200, etc.
        maroon: {
          50: "#fbf3f4",
          100: "#f0dee1",
          200: "#e3c0c5",
          300: "#d098a0",
          400: "#b96b75",
          500: "#a04451",
          600: "#82303d",
          700: "#70172a", // the canonical AMTA maroon
          800: "#5a1424",
          900: "#46101c",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Inter var"',
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
