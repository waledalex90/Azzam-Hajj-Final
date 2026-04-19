declare module "arabic-persian-reshaper" {
  export const ArabicShaper: {
    convertArabic: (s: string) => string;
    convertArabicBack: (s: string) => string;
  };
}
