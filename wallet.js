import {
  WALLET_NETWORKS,
  decimalToWei,
  estimateFeeWei,
  normalizeChainId,
  validateRecipient,
  weiToDecimal,
} from './wallet-utils.mjs';

const clientId = String(import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '').trim();
const node = (id) => document.getElementById(id);
const walletState = { sdk: null, provider: null, address: '', chainId: '', quote: null, busy: false };
let sdkInit;

function status(message, kind = 'neutral') {
  node('walletStatus').textContent = message;
  node('walletBadge').textContent = kind === 'good' ? 'متصل' : kind === 'error' ? 'خطا' : kind === 'busy' ? 'در حال انجام' : kind === 'setup' ? 'تنظیم لازم' : 'آماده';
  node('walletBadge').style.color = kind === 'good' ? '#8aefc9' : kind === 'error' || kind === 'setup' ? '#f1c985' : '#8ab7ff';
}

function txStatus(message, hash = '', network = null) {
  const host = node('walletTxStatus');
  host.replaceChildren(document.createTextNode(message));
  if (hash && network) {
    const link = document.createElement('a');
    link.className = 'wallet-tx-link';
    link.href = network.explorer + '/tx/' + encodeURIComponent(hash);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = hash;
    host.append(document.createElement('br'), link);
  }
}

function setConnected(connected) {
  node('walletAccountCard').classList.toggle('open', connected);
  node('walletSendCard').classList.toggle('open', connected);
  node('walletRefresh').disabled = !connected || walletState.busy;
  node('walletDisconnect').disabled = !connected || walletState.busy;
  node('walletConnect').disabled = walletState.busy;
}

function clearReview() {
  walletState.quote = null;
  node('walletPreview').classList.remove('open');
  node('walletReviewAck').checked = false;
  node('walletSend').disabled = true;
  node('walletCancelReview').hidden = true;
}

function setBusy(busy) {
  walletState.busy = busy;
  setConnected(Boolean(walletState.provider && walletState.address));
  node('walletConnect').disabled = busy;
  node('walletReview').disabled = busy;
  node('walletSend').disabled = busy || !walletState.quote || !node('walletReviewAck').checked;
}

function getNetwork(chainId) {
  try { return WALLET_NETWORKS[normalizeChainId(chainId)] || null; } catch { return null; }
}

async function initSdk() {
  if (!clientId) throw new Error('شناسهٔ عمومی MetaMask Embedded Wallets هنوز در تنظیمات انتشار ثبت نشده است.');
  if (!(window.isSecureContext || location.hostname === 'localhost')) throw new Error('کیف پول فقط روی صفحهٔ HTTPS قابل استفاده است.');
  if (!sdkInit) {
    const { Web3Auth, WEB3AUTH_NETWORK, MFA_LEVELS } = await import('@web3auth/modal');
    walletState.sdk = new Web3Auth({
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
      mfaLevel: MFA_LEVELS.MANDATORY,
      modalConfig: { hideWalletDiscovery: true },
    });
    sdkInit = walletState.sdk.init();
  }
  await sdkInit;
  return walletState.sdk;
}

async function rpc(method, params = []) {
  if (!walletState.provider || typeof walletState.provider.request !== 'function') throw new Error('کیف پول متصل نیست.');
  return walletState.provider.request({ method, params });
}

function updateNetworkView() {
  const network = getNetwork(walletState.chainId);
  const text = network ? network.name + (network.mainnet ? ' · شبکهٔ اصلی' : ' · آزمایشی') : 'شبکهٔ پشتیبانی‌نشده · ' + (walletState.chainId || 'نامشخص');
  node('walletNetwork').textContent = text;
  node('walletBalance').innerHTML = '— <small>ETH</small>';
  node('walletExplorerAddress').hidden = !network;
  if (network && walletState.address) node('walletExplorerAddress').href = network.explorer + '/address/' + encodeURIComponent(walletState.address);
  node('walletReview').disabled = !network || walletState.busy;
  if (!network) txStatus('برای جلوگیری از ارسال روی شبکهٔ اشتباه، این شبکه مجاز نیست. در پروژهٔ کیف پول یکی از شبکه‌های Ethereum، Sepolia، Base یا Base Sepolia را تنظیم کن.');
  else if (network.mainnet) txStatus('شبکهٔ اصلی انتخاب شده است؛ انتقال ETH واقعی و برگشت‌ناپذیر است.');
  else txStatus('شبکهٔ آزمایشی انتخاب شده است؛ دارایی آزمایشی ارزش واقعی ندارد.');
}

async function refreshBalance() {
  if (!walletState.provider || !walletState.address) return;
  const chainId = normalizeChainId(await rpc('eth_chainId'));
  walletState.chainId = chainId;
  updateNetworkView();
  const network = getNetwork(chainId);
  if (!network) return;
  const balance = BigInt(await rpc('eth_getBalance', [walletState.address, 'latest']));
  node('walletBalance').innerHTML = weiToDecimal(balance, 8) + ' <small>ETH</small>';
  node('walletBalanceNote').textContent = 'موجودی زنده · ' + network.name;
}

function attachProviderEvents(provider) {
  if (typeof provider.on !== 'function') return;
  provider.on('chainChanged', async (chain) => {
    clearReview();
    try {
      walletState.chainId = normalizeChainId(chain);
      updateNetworkView();
      await refreshBalance();
    } catch (error) { status('خواندن وضعیت شبکه ناموفق بود: ' + String(error?.message || error).slice(0, 130), 'error'); }
  });
  provider.on('accountsChanged', async (accounts) => {
    clearReview();
    if (!Array.isArray(accounts) || !accounts.length) {
      walletState.address = '';
      walletState.provider = null;
      setConnected(false);
      status('حساب کیف پول از دسترس خارج شد. برای اتصال دوباره اقدام کن.');
      return;
    }
    walletState.address = String(accounts[0]);
    node('walletAddress').textContent = walletState.address;
    try { await refreshBalance(); } catch (error) { txStatus('خواندن موجودی ناموفق بود: ' + String(error?.message || error).slice(0, 100)); }
  });
}

async function connectWallet() {
  if (walletState.busy) return;
  setBusy(true);
  status('در حال آماده‌سازی ورود امن…', 'busy');
  try {
    const sdk = await initSdk();
    const connected = await sdk.connect();
    const provider = sdk.connection?.ethereumProvider || connected;
    if (!provider || typeof provider.request !== 'function') throw new Error('ارائه‌دهندهٔ EVM از سرویس کیف پول دریافت نشد.');
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!Array.isArray(accounts) || !accounts[0]) throw new Error('حسابی از ورود دریافت نشد.');
    walletState.provider = provider;
    walletState.address = String(accounts[0]);
    walletState.chainId = normalizeChainId(await provider.request({ method: 'eth_chainId' }));
    node('walletAddress').textContent = walletState.address;
    clearReview();
    setConnected(true);
    updateNetworkView();
    attachProviderEvents(provider);
    await refreshBalance();
    status('کیف پول MPC متصل شد. هیچ کلید خصوصی در CCAP دریافت یا ذخیره نشده است.', 'good');
  } catch (error) {
    walletState.provider = null;
    walletState.address = '';
    setConnected(false);
    status('اتصال کیف پول انجام نشد: ' + String(error?.message || error).slice(0, 190), 'error');
  } finally { setBusy(false); }
}

async function disconnectWallet() {
  if (walletState.busy) return;
  setBusy(true);
  try { if (walletState.sdk) await walletState.sdk.logout(); }
  catch (error) { status('قطع نشست انجام نشد: ' + String(error?.message || error).slice(0, 140), 'error'); }
  walletState.provider = null;
  walletState.address = '';
  walletState.chainId = '';
  node('walletAddress').textContent = '—';
  node('walletBalance').innerHTML = '— <small>ETH</small>';
  node('walletExplorerAddress').hidden = true;
  clearReview();
  setConnected(false);
  setBusy(false);
  if (!walletState.busy) status('اتصال کیف پول قطع شد.');
}

async function reviewTransfer() {
  if (!walletState.provider || !walletState.address) throw new Error('ابتدا کیف پول را متصل کن.');
  const to = String(node('walletRecipient').value || '').trim();
  if (!validateRecipient(to)) throw new Error('آدرس گیرنده باید یک آدرس کامل EVM با ۴۰ رقم هگز باشد.');
  const value = decimalToWei(node('walletAmount').value);
  const chainId = normalizeChainId(await rpc('eth_chainId'));
  const network = getNetwork(chainId);
  if (!network) throw new Error('شبکهٔ فعلی مجاز نیست؛ انتقال متوقف شد.');
  const from = String((await rpc('eth_accounts'))?.[0] || '');
  if (!from || from.toLowerCase() !== walletState.address.toLowerCase()) throw new Error('حساب فعال تغییر کرده است؛ دوباره کیف پول را بررسی کن.');
  const tx = { from, to, value: '0x' + value.toString(16) };
  const [balanceRaw, gasRaw, gasPriceRaw] = await Promise.all([
    rpc('eth_getBalance', [from, 'latest']),
    rpc('eth_estimateGas', [tx]),
    rpc('eth_gasPrice'),
  ]);
  const balance = BigInt(balanceRaw);
  const gasLimit = BigInt(gasRaw);
  const fee = estimateFeeWei(gasLimit, BigInt(gasPriceRaw));
  if (balance < value + fee) throw new Error('موجودی برای مقدار انتقال به‌همراه کارمزد تخمینی کافی نیست.');
  walletState.chainId = chainId;
  walletState.quote = { to, value, chainId, from, fee, balance, createdAt: Date.now() };
  node('walletPreviewNetwork').textContent = network.name + (network.mainnet ? ' · اصلی' : ' · آزمایشی');
  node('walletPreviewTo').textContent = to;
  node('walletPreviewValue').textContent = weiToDecimal(value, 18) + ' ETH';
  node('walletPreviewFee').textContent = 'حداکثر تقریبی ' + weiToDecimal(fee, 8) + ' ETH';
  node('walletPreviewRemaining').textContent = 'حدود ' + weiToDecimal(balance - value - fee, 8) + ' ETH';
  node('walletPreview').classList.add('open');
  node('walletCancelReview').hidden = false;
  node('walletReviewAck').checked = false;
  node('walletSend').disabled = true;
  if (network.mainnet) txStatus('بررسی آماده است؛ شبکهٔ اصلی است و ETH واقعی ارسال خواهد شد. مقدار کارمزد تخمینی است.');
  else txStatus('بررسی آماده است؛ این شبکه آزمایشی است. مقدار کارمزد تخمینی است.');
}

async function sendTransfer() {
  const quote = walletState.quote;
  if (!quote || !node('walletReviewAck').checked) throw new Error('ابتدا بررسی را کامل و شبکه و آدرس را تأیید کن.');
  if (Date.now() - quote.createdAt > 60000) { clearReview(); throw new Error('بررسی منقضی شد؛ کارمزد و موجودی را دوباره بررسی کن.'); }
  if (quote.to !== String(node('walletRecipient').value || '').trim() || quote.value !== decimalToWei(node('walletAmount').value)) { clearReview(); throw new Error('مقدار یا گیرنده پس از بررسی تغییر کرده؛ دوباره بررسی کن.'); }
  const [chain, accounts] = await Promise.all([rpc('eth_chainId'), rpc('eth_accounts')]);
  if (normalizeChainId(chain) !== quote.chainId || !accounts?.[0] || accounts[0].toLowerCase() !== quote.from.toLowerCase()) { clearReview(); throw new Error('شبکه یا حساب تغییر کرده؛ انتقال متوقف شد.'); }
  const freshBalance = BigInt(await rpc('eth_getBalance', [quote.from, 'latest']));
  if (freshBalance < quote.value + quote.fee) { clearReview(); throw new Error('موجودی پس از بررسی تغییر کرده و برای انتقال کافی نیست.'); }
  const network = getNetwork(quote.chainId);
  if (!network) { clearReview(); throw new Error('شبکهٔ فعلی مجاز نیست؛ انتقال متوقف شد.'); }
  setBusy(true);
  txStatus('در انتظار تأیید نهایی در پنجرهٔ امن کیف پول…');
  try {
    const hash = await rpc('eth_sendTransaction', [{ from: quote.from, to: quote.to, value: '0x' + quote.value.toString(16) }]);
    clearReview();
    node('walletRecipient').value = '';
    node('walletAmount').value = '';
    txStatus('تراکنش امضا و به شبکه ارسال شد. شناسهٔ تراکنش:', String(hash), network);
    await refreshBalance();
  } catch (error) {
    txStatus('تراکنش ارسال نشد یا در کیف پول رد شد: ' + String(error?.message || error).slice(0, 160));
    throw error;
  } finally { setBusy(false); }
}

node('walletConnect').addEventListener('click', connectWallet);
node('walletDisconnect').addEventListener('click', disconnectWallet);
node('walletRefresh').addEventListener('click', async () => {
  try { await refreshBalance(); status('موجودی به‌روز شد.', 'good'); }
  catch (error) { status('به‌روزرسانی موجودی ناموفق بود: ' + String(error?.message || error).slice(0, 150), 'error'); }
});
node('walletReview').addEventListener('click', async () => {
  clearReview();
  setBusy(true);
  try { await reviewTransfer(); }
  catch (error) { txStatus('بررسی انتقال ناموفق بود: ' + String(error?.message || error).slice(0, 170)); }
  finally { setBusy(false); }
});
node('walletCancelReview').addEventListener('click', () => { clearReview(); txStatus('بررسی انتقال لغو شد؛ هیچ تراکنشی ارسال نشد.'); });
node('walletReviewAck').addEventListener('change', () => { node('walletSend').disabled = !walletState.quote || !node('walletReviewAck').checked || walletState.busy; });
node('walletRecipient').addEventListener('input', clearReview);
node('walletAmount').addEventListener('input', clearReview);
node('walletSend').addEventListener('click', async () => {
  setBusy(true);
  try { await sendTransfer(); }
  catch (error) { if (!node('walletTxStatus').textContent.startsWith('تراکنش ارسال نشد')) txStatus('ارسال انجام نشد: ' + String(error?.message || error).slice(0, 170)); }
  finally { setBusy(false); }
});
node('walletCopyAddress').addEventListener('click', async () => {
  if (!walletState.address) return;
  try { await navigator.clipboard.writeText(walletState.address); txStatus('آدرس عمومی کپی شد.'); }
  catch { txStatus('کپی خودکار در دسترس نیست؛ آدرس را از کادر انتخاب و کپی کن.'); }
});

if (!clientId) {
  status('برای فعال‌سازی، شناسهٔ عمومی پروژهٔ MetaMask Embedded Wallets باید به‌عنوان VITE_WEB3AUTH_CLIENT_ID در تنظیمات GitHub Pages ثبت شود. این شناسه محرمانه نیست؛ هیچ کلید خصوصی یا عبارت بازیابی لازم نیست.', 'setup');
} else {
  status('آمادهٔ ورود امن؛ برای اتصال، دکمهٔ ایجاد / اتصال را بزن.');
}
