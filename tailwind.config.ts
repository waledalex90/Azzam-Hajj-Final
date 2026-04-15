import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "luxury-black": "#0b0b0c",
        "luxury-gold": "#d4af37",
      },
    },
  },
};

export default config;
