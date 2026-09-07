import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { languages, normalizeLanguage } from '@/i18n';

interface LanguageSelectorProps {
  variant?: 'default' | 'compact';
}

const ShortBadge = ({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' | 'lg' }) => {
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
      {code}
    </span>
  );
};

const LanguageSelector = ({ variant = 'default' }: LanguageSelectorProps) => {
  const { i18n, t } = useTranslation();

  // Regional codes ('en-US', 'es-ES') must map to the locale actually rendered,
  // otherwise the badge and the content disagree.
  const active = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const currentLang = languages.find((l) => l.code === active) || languages[0];
  const change = (value: string) => void i18n.changeLanguage(normalizeLanguage(value));

  if (variant === 'compact') {
    return (
      <Select value={active} onValueChange={change}>
        <SelectTrigger
          aria-label={t('profile.language', 'Idioma')}
          className="w-auto border-0 bg-transparent hover:bg-white/10 px-2 py-1 h-11 min-w-[44px] focus:ring-0 focus:ring-offset-0 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-70 gap-1.5"
        >
          <Languages className="h-4 w-4 opacity-80" aria-hidden="true" />
          <ShortBadge code={currentLang.shortCode} size="md" />
          <span className="sr-only">{currentLang.nativeName}</span>
        </SelectTrigger>
        <SelectContent className="bg-popover z-50 min-w-[200px]" dir="ltr">
          {languages.map((lang) => {
            const isActive = lang.code === active;
            return (
              <SelectItem key={lang.code} value={lang.code} className="pr-8">
                <span className="flex items-center gap-2.5">
                  <ShortBadge code={lang.shortCode} />
                  <span className="text-muted-foreground">·</span>
                  <span dir={lang.dir} className="font-medium">
                    {lang.nativeName}
                  </span>
                  {isActive && <Check className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={active} onValueChange={change}>
      <SelectTrigger className="w-[220px] h-11" aria-label={t('profile.language', 'Idioma')}>
        <SelectValue>
          <span className="inline-flex items-center gap-2">
            <ShortBadge code={currentLang.shortCode} size="sm" />
            <span className="text-muted-foreground">·</span>
            <span dir={currentLang.dir}>{currentLang.nativeName}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50" dir="ltr">
        {languages.map((lang) => {
          const isActive = lang.code === active;
          return (
            <SelectItem key={lang.code} value={lang.code} className="pr-8">
              <span className="flex items-center gap-2.5">
                <ShortBadge code={lang.shortCode} size="sm" />
                <span className="text-muted-foreground">·</span>
                <span dir={lang.dir} className="font-medium">
                  {lang.nativeName}
                </span>
                {isActive && <Check className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
