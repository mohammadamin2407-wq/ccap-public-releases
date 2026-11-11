const test = require('node:test');
const assert = require('node:assert/strict');

test('wallet amount parsing is exact and rejects unsafe precision', async () => {
  const wallet = await import('../wallet-utils.mjs');
  assert.equal(wallet.decimalToWei('1.000000000000000001'), 1000000000000000001n);
  assert.equal(wallet.decimalToWei('0.000000000000000001'), 1n);
  assert.throws(() => wallet.decimalToWei('0'), /بیشتر از صفر/);
  assert.throws(() => wallet.decimalToWei('1.0000000000000000001'), /۱۸ رقم اعشار/);
  assert.throws(() => wallet.decimalToWei('1e-3'), /۱۸ رقم اعشار/);
});

test('wallet chain and recipient checks allow only expected EVM networks and address shape', async () => {
  const wallet = await import('../wallet-utils.mjs');
  assert.equal(wallet.normalizeChainId('0X1'), '0x1');
  assert.equal(wallet.WALLET_NETWORKS[wallet.normalizeChainId('0x14a34')].name, 'Base Sepolia');
  assert.equal(wallet.WALLET_NETWORKS[wallet.normalizeChainId('0x38')], undefined);
  assert.equal(wallet.validateRecipient('0x' + 'a'.repeat(40)), true);
  assert.equal(wallet.validateRecipient('0x' + 'a'.repeat(39)), false);
  assert.equal(wallet.validateRecipient('0x' + 'g'.repeat(40)), false);
});

test('fee estimate applies a conservative 20 percent margin', async () => {
  const wallet = await import('../wallet-utils.mjs');
  assert.equal(wallet.estimateFeeWei(21000n, 100n), 2520000n);
  assert.equal(wallet.weiToDecimal(1234567890123456789n, 6), '1.234567');
});
