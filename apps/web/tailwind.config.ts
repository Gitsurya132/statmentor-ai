import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#f7f9fc",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3974e8",
          600: "#2762d4",
          700: "#204fab"
        },
        teal: {
          50: "#ecfdf9",
          500: "#13a78d",
          600: "#0d8874"
        },
        violet: {
          50: "#f5f3ff",
          500: "#7c68db",
          600: "#6753c5"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"]
      },
      boxShadow: {
        card: "0 14px 40px rgba(28, 46, 79, 0.08)"
      },
      borderRadius: {
        "2xl": "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
