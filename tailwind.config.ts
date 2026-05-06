import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        ink: '#151521',
        bg: '#F0F0F2',
        bgSoft: '#F7F7F8',
        cream: '#F1EBE5',
        navy: '#313D65',
        navyHub: '#1F2D4A',
        deep: '#1E476A',
        denim: '#436F95',
        steel: '#779DBF',
        sky: '#B8D2EA',
        lavender: '#BAC4E6',
        mauve: '#8485A3',
        sage: '#889F7B',
        fern: '#6A7464',
        blush: '#FFABAC',
        petal: '#FFD5D6',
        crimson: '#90181A',
        t1: '#151521',
        t2: '#5C5B72',
        t3: '#9898AA',
        // Hub palette (do mockup)
        hubBlue: '#3B6789',
        hubGreen: '#4F6B4A',
        hubRed: '#6E2A2C',
        navySoft: '#E7EBF2',
        blueSoft: '#E6EDF2',
        greenSoft: '#EBEFE9',
        redSoft: '#F3E7E7',
        tagBg: '#EEF0F4',
      },
      borderColor: {
        DEFAULT: 'rgba(21,21,33,0.08)',
        medium: 'rgba(21,21,33,0.13)',
      },
    },
  },
  plugins: [],
};

export default config;
