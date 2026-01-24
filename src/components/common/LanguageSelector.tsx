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

const LanguageSelector = ({ variant = 'default' }: LanguageSelectorProps) => {
  const { i18n } = useTranslation();

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <Select value={i18n.language} onValueChange={(value) => i18n.changeLanguage(value)}>
      <SelectTrigger className={variant === 'compact' ? 'w-[100px]' : 'w-[180px]'}>
        <SelectValue>
          {variant === 'compact' ? (
            <span>{currentLang.flag}</span>
          ) : (
            <span>{currentLang.flag} {currentLang.name}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
