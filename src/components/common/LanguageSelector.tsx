import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { languages } from '@/i18n';

interface LanguageSelectorProps {
  variant?: 'default' | 'compact';
}

// Renders a flag emoji or, for codes without a country flag (e.g. Arabic),
// a neutral textual badge to avoid associating a language with a single country.
const LangBadge = ({ flag, size = 'md' }: { flag: string; size?: 'sm' | 'md' | 'lg' }) => {
  const isText = !/\p{Extended_Pictographic}/u.test(flag);
  if (isText) {
    const cls =
      size === 'lg'
        ? 'text-[11px] px-1.5 h-6 min-w-[28px]'
        : size === 'sm'
        ? 'text-[10px] px-1 h-5 min-w-[22px]'
        : 'text-[10px] px-1.5 h-5 min-w-[24px]';
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-md bg-muted text-foreground font-bold tracking-wide ${cls}`}
      >
        {flag}
      </span>
    );
  }
  const txt = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return <span className={txt}>{flag}</span>;
};

const LanguageSelector = ({ variant = 'default' }: LanguageSelectorProps) => {
  const { i18n, t } = useTranslation();

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  if (variant === 'compact') {
    return (
      <Select value={i18n.language} onValueChange={(value) => i18n.changeLanguage(value)}>
        <SelectTrigger
          aria-label={t('profile.language', 'Idioma')}
          className="w-auto border-0 bg-transparent hover:bg-white/10 px-2 py-1 h-auto min-h-[36px] focus:ring-0 focus:ring-offset-0 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-70"
        >
          <LangBadge flag={currentLang.flag} size="lg" />
          <span className="sr-only">{currentLang.name}</span>
        </SelectTrigger>
        <SelectContent className="bg-popover z-50 min-w-[180px]">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-3" dir={lang.dir}>
                <LangBadge flag={lang.flag} />
                <span>{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={i18n.language} onValueChange={(value) => i18n.changeLanguage(value)}>
      <SelectTrigger className="w-[200px]" aria-label={t('profile.language', 'Idioma')}>
        <SelectValue>
          <span className="inline-flex items-center gap-2" dir={currentLang.dir}>
            <LangBadge flag={currentLang.flag} size="sm" />
            <span>{currentLang.name}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2" dir={lang.dir}>
              <LangBadge flag={lang.flag} size="sm" />
              <span>{lang.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
