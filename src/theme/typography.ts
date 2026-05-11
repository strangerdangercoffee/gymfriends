/**
 * Nunito font family names for use with fontFamily style.
 * Loaded in App.tsx via useFonts; use these constants so names stay in sync.
 */
export const fonts = {
  nunito: {
    regular: 'Nunito-Regular',
    semiBold: 'Nunito-SemiBold',
    bold: 'Nunito-Bold',
  },
} as const;

export type FontFamily = typeof fonts.nunito[keyof typeof fonts.nunito];
