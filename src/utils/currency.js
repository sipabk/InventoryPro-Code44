// Centralized currency formatting — base currency is BWP (Botswana Pula)
export const BASE_CURRENCY = 'BWP';
export const BASE_CURRENCY_SYMBOL = 'P';

export function formatBWP(amount) {
  const num = parseFloat(amount) || 0;
  return `P ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrency(amount, currency = 'BWP') {
  const num = parseFloat(amount) || 0;
  if (currency === 'BWP') return formatBWP(num);
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}