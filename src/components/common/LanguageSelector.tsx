import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleSelect, type SimpleSelectOption } from '@/components/ui/adaptive';
import { languages } from '@/i18n';
import { getResolvedLanguage, normalizeLanguageCode } from '@/i18n/language';

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

  const activeCode = getResolvedLanguage(i18n);
  const currentLang = languages.find((l) => l.code === activeCode) || languages[0];

  const options: SimpleSelectOption<string>[] = languages.map((lang) => ({
    value: lang.code,
    label: (
      <span dir={lang.dir} className="font-medium">
        {lang.nativeName}
      </span>
    ),
    leading: <ShortBadge code={lang.shortCode} size="sm" />,
  }));

  const handleChange = (value: string) => {
    const base = normalizeLanguageCode(value);
    void i18n.changeLanguage(base);
  };

  const ariaLabel = t('profile.language', 'Idioma');
  const title = t('profile.language', 'Idioma');

  if (variant === 'compact') {
    return (
      <SimpleSelect
        value={activeCode}
        onValueChange={handleChange}
        options={options}
        title={title}
        ariaLabel={ariaLabel}
        align="end"
        trigger={({ open }) => (
          <Button
            type="button"
            variant="ghost"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={ariaLabel}
            className="min-h-[44px] min-w-[44px] h-11 rounded-full gap-1.5 px-2 bg-transparent hover:bg-white/10 dark:hover:bg-white/10 text-foreground"
          >
            <Languages className="h-4 w-4 opacity-80" aria-hidden="true" />
            <ShortBadge code={currentLang.shortCode} size="md" />
            <span className="sr-only">{currentLang.nativeName}</span>
          </Button>
        )}
      />
    );
  }

  return (
    <SimpleSelect
      value={activeCode}
      onValueChange={handleChange}
      options={options}
      title={title}
      ariaLabel={ariaLabel}
      trigger={({ open }) => (
        <Button
          type="button"
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="w-[220px] justify-between gap-2"
        >
          <span className="inline-flex items-center gap-2 min-w-0 truncate">
            <ShortBadge code={currentLang.shortCode} size="sm" />
            <span className="text-muted-foreground">·</span>
            <span dir={currentLang.dir} className="truncate">
              {currentLang.nativeName}
            </span>
          </span>
        </Button>
      )}
    />
  );
};

export default LanguageSelector;
