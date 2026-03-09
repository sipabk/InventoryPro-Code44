import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const PRESET_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

export function useCurrencies() {
  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.SystemSettings.list(),
  });

  const customCurrenciesSetting = settingsList.find(s => s.setting_key === 'custom_currencies');
  const custom = customCurrenciesSetting?.setting_value
    ? customCurrenciesSetting.setting_value.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  return [...PRESET_CURRENCIES, ...custom.filter(c => !PRESET_CURRENCIES.includes(c))];
}