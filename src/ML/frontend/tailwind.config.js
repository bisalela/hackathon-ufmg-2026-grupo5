/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#050505",
        midnight: "#0d0d0f",
        panel: "#121214",
        ink: "#f6efe7",
        ember: "#eab308",
        amber: "#facc15",
        copper: "#fde047",
        coal: "#1a1a1d",
      },
      boxShadow: {
        glow: "0 24px 60px rgba(250, 204, 21, 0.05)",
        ember: "0 12px 36px rgba(250, 204, 21, 0.09)",
        panel: "0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 40px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at top left, rgba(250, 204, 21, 0.07), transparent 30%), radial-gradient(circle at top right, rgba(253, 224, 71, 0.04), transparent 26%), radial-gradient(circle at bottom left, rgba(250, 204, 21, 0.03), transparent 24%)",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Manrope"', "sans-serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.25", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(1.03)" },
        },
        slideFade: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 10s ease-in-out infinite",
        "pulse-glow": "pulseGlow 6s ease-in-out infinite",
        "slide-fade": "slideFade 550ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up": "fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
