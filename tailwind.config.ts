import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui"],
        body: ["Work Sans", "ui-sans-serif", "system-ui"]
      },
      colors: {
        ink: {
          900: "#101820",
          700: "#2B3A42",
          500: "#455A64"
        },
        mint: {
          500: "#2DD4BF",
          700: "#0F766E"
        },
        sand: {
          50: "#FAF7F2",
          100: "#F3EEE5"
        },
        coral: {
          500: "#F97316",
          700: "#C2410C"
        }
      },
      boxShadow: {
        card: "0 18px 40px rgba(16, 24, 32, 0.12)",
        glow: "0 0 0 2px rgba(45, 212, 191, 0.3)"
      }
    }
  },
  plugins: []
};

export default config;
