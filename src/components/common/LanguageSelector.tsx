import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
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

  if (variant === 'compact') {
    return (
      <Select value={i18n.language} onValueChange={(value) => i18n.changeLanguage(value)}>
        <SelectTrigger className="w-auto border-0 bg-transparent hover:bg-white/10 gap-1 px-2 py-1 h-auto focus:ring-0 focus:ring-offset-0">
          <span className="text-2xl">{currentLang.flag}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50 min-w-[160px]">
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
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
      <SelectTrigger className="w-[180px]">
        <SelectValue>
          <span>{currentLang.flag} {currentLang.name}</span>
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
