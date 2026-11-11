export const WALLET_NETWORKS = Object.freeze({
  '0x1': { id: '0x1', name: 'Ethereum Mainnet', ticker: 'ETH', explorer: 'https://etherscan.io', mainnet: true },
  '0xaa36a7': { id: '0xaa36a7', name: 'Ethereum Sepolia', ticker: 'ETH', explorer: 'https://sepolia.etherscan.io', mainnet: false },
  '0x2105': { id: '0x2105', name: 'Base', ticker: 'ETH', explorer: 'https://basescan.org', mainnet: true },
  '0x14a34': { id: '0x14a34', name: 'Base Sepolia', ticker: 'ETH', explorer: 'https://sepolia.basescan.org', mainnet: false },
});

export function normalizeChainId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return '0x' + value.toString(16);
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('شناسهٔ شبکه معتبر نیست.');
  return '0x' + BigInt(value).toString(16);
}

export function validateRecipient(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function decimalToWei(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(text)) throw new Error('مقدار باید عدد مثبت با حداکثر ۱۸ رقم اعشار باشد.');
  const [whole, fraction = ''] = text.split('.');
  const amount = BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
  if (amount <= 0n) throw new Error('مقدار انتقال باید بیشتر از صفر باشد.');
  return amount;
}

export function weiToDecimal(value, decimals = 6) {
  const amount = BigInt(value);
  const whole = amount / 10n ** 18n;
  const remainder = amount % 10n ** 18n;
  const precision = Math.max(0, Math.min(18, Number(decimals) || 0));
  const fraction = remainder.toString().padStart(18, '0').slice(0, precision).replace(/0+$/, '');
  return whole.toString() + (fraction ? '.' + fraction : '');
}

export function estimateFeeWei(gasLimit, gasPrice) {
  const gas = BigInt(gasLimit);
  const price = BigInt(gasPrice);
  if (gas <= 0n || price <= 0n) throw new Error('برآورد کارمزد شبکه معتبر نیست.');
  return (gas * price * 120n + 99n) / 100n;
}
