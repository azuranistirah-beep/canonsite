'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type SupportedLanguage = 'en' | 'ms' | 'vi' | 'fil' | 'es' | 'fr' | 'de' | 'it' | 'tr' | 'pl';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
];

const LANGUAGE_STORAGE_KEY = 'user-language';

function detectBrowserLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const browserLang = navigator.language?.toLowerCase() || '';
  const langMap: Record<string, SupportedLanguage> = {
    'en': 'en', 'ms': 'ms', 'vi': 'vi', 'fil': 'fil', 'tl': 'fil',
    'es': 'es', 'fr': 'fr', 'de': 'de', 'it': 'it', 'tr': 'tr', 'pl': 'pl',
  };
  const prefix = browserLang.split('-')[0];
  return langMap[prefix] || 'en';
}

type TranslationValue = string | Record<string, string>;
type Translations = Record<string, TranslationValue>;

const translationCache: Partial<Record<SupportedLanguage, Translations>> = {};

async function loadTranslations(lang: SupportedLanguage): Promise<Translations> {
  if (translationCache[lang]) return translationCache[lang]!;
  try {
    const module = await import(`@/locales/${lang}.json`);
    translationCache[lang] = module.default as Translations;
    return translationCache[lang]!;
  } catch {
    if (lang !== 'en') {
      const fallback = await import('@/locales/en.json');
      return fallback.default as Translations;
    }
    return {};
  }
}

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  isLoading: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
    const supported = SUPPORTED_LANGUAGES.map(l => l.code);
    const initial: SupportedLanguage = (stored && supported.includes(stored))
      ? stored
      : detectBrowserLanguage();
    setLanguageState(initial);
    loadTranslations(initial).then(t => {
      setTranslations(t);
      setIsLoading(false);
    });
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    setIsLoading(true);
    loadTranslations(lang).then(t => {
      setTranslations(t);
      setIsLoading(false);
    });
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: TranslationValue | undefined = translations[keys[0]];
    for (let i = 1; i < keys.length; i++) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, string>)[keys[i]];
      } else {
        value = undefined;
        break;
      }
    }
    let result = typeof value === 'string' ? value : key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return result;
  }, [translations]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
