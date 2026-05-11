/**
 * App color palette.
 * #020C18 (deep navy), #30362F (forest shadow), #03A062 (emerald), #F5853F (ember orange), #FAEDCA (warm cream).
 * Use these tokens across screens and components for a consistent look.
 */
export const colors = {
  // Backgrounds
  background: '#020C18',
  surface: '#30362F',
  surfaceElevated: '#1A2B1E', // slightly lighter than surface, between bg and surface

  // Primary accent (emerald - tabs, active states, success, gym indicators)
  primary: '#3ff585',
  primaryMuted: 'rgba(3, 160, 98, 0.15)',
  primaryBorder: 'rgba(3, 160, 98, 0.4)',

  // Secondary / CTA (ember orange - buttons, highlights, growth metrics)
  secondary: '#F5853F',
  secondaryMuted: 'rgba(245, 133, 63, 0.15)',
  secondaryBorder: 'rgba(245, 133, 63, 0.4)',

  // Text (warm cream on dark)
  text: '#FAEDCA',
  textSecondary: 'rgba(250, 237, 202, 0.85)',
  textMuted: 'rgba(250, 237, 202, 0.5)',
  textFaded: 'rgba(250, 237, 202, 0.35)',

  // Borders and dividers
  border: 'rgba(48, 54, 47, 0.8)',
  borderStrong: 'rgba(245, 133, 63, 0.4)',

  // Overlays and UI
  overlay: 'rgba(2, 12, 24, 0.75)',
  divider: 'rgba(250, 237, 202, 0.12)',
  handle: 'rgba(250, 237, 202, 0.2)',

  // Semantic (palette-aligned)
  success: '#03A062',
  successMuted: 'rgba(3, 160, 98, 0.15)',
  error: '#D65A4A',
  errorMuted: 'rgba(214, 90, 74, 0.2)',


  pinInactive: '#3ff585',
  pinActive: '#F5853F',

  workoutTypes: {
    limit: '#81f53f',
    power: '#f53fdc',
    endurance: '#f5d13f',
    technique: '#f5853f',
    volume: '#f53f45',
    projecting: '#f53f91',
    recovery: '#cdf53f',
    cardio: '#813ff5',
  } as const,
} as const;

export type Colors = typeof colors;

/**
 * Shared theme for `react-native-calendars` date pickers across the app.
 * Defaults in the library are light/white; this aligns with `colors`.
 */
export const dateCalendarTheme = {
  calendarBackground: colors.surfaceElevated,
  backgroundColor: colors.surfaceElevated,
  monthTextColor: colors.text,
  textSectionTitleColor: colors.textMuted,
  textSectionTitleDisabledColor: colors.textFaded,
  dayTextColor: colors.text,
  textDisabledColor: colors.textFaded,
  textInactiveColor: colors.textFaded,
  todayTextColor: colors.secondary,
  selectedDayBackgroundColor: colors.primary,
  selectedDayTextColor: colors.background,
  arrowColor: colors.primary,
  disabledArrowColor: colors.textFaded,
  dotColor: colors.primary,
  selectedDotColor: colors.background,
  textDayFontWeight: '500' as const,
  textMonthFontWeight: '600' as const,
  textDayHeaderFontWeight: '600' as const,
};