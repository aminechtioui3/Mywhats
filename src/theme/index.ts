// src/theme/index.ts
// Light theme — clean, modern, airy

export const colors = {
  // Surfaces
  background: '#F6F8FB',         // page background
  backgroundElevated: '#FFFFFF',  // cards, bars, sheets
  card: '#FFFFFF',

  // Brand accents
  primary: '#2563EB',      // blue-600
  primarySoft: '#3B82F6',  // blue-500
  accent: '#9333EA',       // purple-600
  danger: '#DC2626',       // red-600
  success: '#16A34A',      // green-600
  warning: '#F59E0B',      // amber-500

  // Text
  textPrimary: '#0F172A',   // slate-900
  textSecondary: '#475569', // slate-600
  textMuted: '#94A3B8',     // slate-400

  // Lines & effects
  border: '#E2E8F0',        // gray-200
  overlay: '#0F172A66',     // translucent for modals
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const typography = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 14,
  small: 12,
};

export const elevations = {
  card: 2,
  bar: 6,
  fab: 8,
  modal: 12,
};
