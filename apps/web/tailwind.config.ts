import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Grandsmeta-inspired color system
        primary: {
          DEFAULT: '#0f54b9',
          50: '#eff4ff',
          100: '#dbe6fd',
          200: '#bfd3fc',
          300: '#93b4fb',
          400: '#6089f7',
          500: '#3b64f3',
          600: '#2546e8',
          700: '#0f54b9',
          800: '#1e3a8a',
          900: '#1e3a5f',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#067C34',
          light: '#10b981',
          foreground: '#ffffff',
        },
        // Status colors
        status: {
          new: '#3b82f6',
          'new-bg': '#eff6ff',
          'in-progress': '#f59e0b',
          'in-progress-bg': '#fffbeb',
          review: '#8b5cf6',
          'review-bg': '#f5f3ff',
          done: '#10b981',
          'done-bg': '#ecfdf5',
          cancelled: '#9ca3af',
          'cancelled-bg': '#f9fafb',
        },
        // Priority colors
        priority: {
          optional: '#9ca3af',
          'optional-bg': '#f9fafb',
          normal: '#3b82f6',
          'normal-bg': '#eff6ff',
          urgent: '#f97316',
          'urgent-bg': '#fff7ed',
          critical: '#ef4444',
          'critical-bg': '#fef2f2',
        },
        // Base
        background: '#eff4f8',
        surface: '#ffffff',
        border: '#e2e8f0',
        text: {
          DEFAULT: '#1a202c',
          muted: '#718096',
          light: '#a0aec0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '8px',
        '2xl': '12px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        sidebar: '2px 0 8px rgba(0, 0, 0, 0.06)',
      },
      maxWidth: {
        content: '1170px',
      },
    },
  },
  plugins: [],
};

export default config;
