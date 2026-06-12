/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cosmic: {
          bg: '#0C0C0E',
          card: 'rgba(255,255,255,0.03)',
          border: 'rgba(255,255,255,0.06)',
        },
        neon: {
          orange: '#FF9F0A',
          blue: '#0A84FF',
          green: '#30D158',
          gold: '#FFD60A',
          red: '#FF453A',
          purple: '#BF5AF2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        ios: '20px',
        'ios-lg': '28px',
        'ios-sm': '12px',
      },
      backdropBlur: {
        glass: '12px',
        'glass-lg': '24px',
      },
      animation: {
        'pulse-live': 'pulseLive 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'glow-orange': 'glowOrange 2s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
        'shimmer': 'shimmer 2s infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        pulseLive: {
          '0%, 100%': {
            boxShadow: '0 0 4px rgba(48,209,88,0.8)',
            opacity: '1',
          },
          '50%': {
            boxShadow: '0 0 16px rgba(48,209,88,1), 0 0 32px rgba(48,209,88,0.4)',
            opacity: '0.75',
          },
        },
        slideInRight: {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowOrange: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255,159,10,0.4)' },
          '50%': { boxShadow: '0 0 24px rgba(255,159,10,0.8), 0 0 48px rgba(255,159,10,0.3)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glass': '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glass-hover': '0 30px 60px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
        'neon-orange': '0 0 20px rgba(255,159,10,0.5)',
        'neon-blue': '0 0 20px rgba(10,132,255,0.5)',
        'neon-green': '0 0 20px rgba(48,209,88,0.5)',
        'neon-gold': '0 0 20px rgba(255,214,10,0.5)',
        'ios': '0 10px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        'ios-lg': '0 20px 60px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
