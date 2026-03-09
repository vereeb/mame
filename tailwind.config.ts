import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#f4ac1f",
          50: "#fef9e7",
          100: "#fdf3cf",
          200: "#fbe79f",
          300: "#f9db6f",
          400: "#f7cf3f",
          500: "#f4ac1f",
          600: "#c48919",
          700: "#946713",
          800: "#64450d",
          900: "#342206",
        },
        surface: {
          DEFAULT: "#fafafa",
          variant: "#f5f5f5",
        },
        outline: "#e0e0e0",
      },
      boxShadow: {
        "m3-1": "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.1)",
        "m3-2": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "m3-fab": "0 6px 10px 0 rgb(0 0 0 / 0.14), 0 1px 18px 0 rgb(0 0 0 / 0.12), 0 3px 5px -1px rgb(0 0 0 / 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
