import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, LANGUAGES } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // 1. Türkiye Türkçesi (tr) varsayılan dildir. Sıralama: tr -> az -> en
    const [lang, setLangState] = useState(() => {
        const saved = localStorage.getItem('karalevha_lang');
        if (saved && LANGUAGES.some(l => l.code === saved)) {
            return saved;
        }
        return 'tr';
    });

    const setLang = (newLang) => {
        if (LANGUAGES.some(l => l.code === newLang)) {
            setLangState(newLang);
            localStorage.setItem('karalevha_lang', newLang);
            document.documentElement.lang = newLang;
        }
    };

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    // Çeviri getirici yardımcı fonksiyon
    const t = (key, fallback = '') => {
        const langDict = translations[lang] || translations.tr;
        if (langDict && langDict[key]) {
            return langDict[key];
        }
        // İlgili dilde yoksa Türkçe sözlükten yedek al
        if (translations.tr && translations.tr[key]) {
            return translations.tr[key];
        }
        return fallback || key;
    };

    const currentLanguage = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, languages: LANGUAGES, currentLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage, LanguageProvider içinde kullanılmalıdır.');
    }
    return context;
};
