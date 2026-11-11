const test=require('node:test');
const assert=require('node:assert/strict');
const {validateMinuteHistory,mergeMinutePages,fallbackDecision}=require('../signal-performance.js');

const minute=60000;
function candle(time,open=100,high=102,low=99,close=101){return [time,open,high,low,close,10,time+minute-1]}
function validInputs(overrides={}){
 const now=1_800_000_000_000;
 return {
  now,
  signal:{symbol:'ETHUSDT',direction:'LONG',score:82,createdAt:now-2*minute,provider:'bybit',stillValid:true,plan:{entry:100,stop:95,target1:110,target2:115}},
  quote:{symbol:'ETHUSDT',price:102,provider:'futures',fetchedAt:now-1000,verified:true},
  risk:{enabled:true,balance:10000,perTradePct:.5,dayRemaining:150,weekRemaining:400,leverage:5,sameSymbolActive:false},
  ...overrides
 };
}

test('validates every expected minute, including range and page boundaries',()=>{
 const start=1_800_000_000_000,rows=[candle(start),candle(start+minute),candle(start+3*minute),candle(start+4*minute)];
 const pages=mergeMinutePages([[rows[0],rows[1]],[rows[1],rows[2],rows[3]]]);
 const result=validateMinuteHistory(pages.candles,start,start+4*minute);
 assert.equal(result.complete,false);
 assert.deepEqual(result.gaps,[start+2*minute]);
 assert.equal(result.candles.length,4);
});

test('rejects unaligned and conflicting candles instead of treating them as complete',()=>{
 const start=1_800_000_000_000;
 const pages=mergeMinutePages([[candle(start),candle(start+minute)],[candle(start+minute,100,103,99,102)]]);
 assert.deepEqual(pages.invalidStarts,[start+minute]);
 const result=validateMinuteHistory(pages.candles,start,start+minute);
 assert.equal(result.complete,false);
 assert.deepEqual(result.gaps,[start+minute]);
});

test('an invalid aligned candle cannot be masked by a valid copy from another page',()=>{
 const start=1_800_000_000_000;
 const bad=[start+minute,100,98,99,101,10];
 const pages=mergeMinutePages([[candle(start),candle(start+minute)],[bad]]);
 assert.deepEqual(pages.invalidStarts,[start+minute]);
 assert.deepEqual(pages.candles.map(row=>row[0]),[start]);
 assert.equal(validateMinuteHistory(pages.candles,start,start+minute).complete,false);
});

test('approves a fresh independent price only when signal and risk checks pass',()=>{
 const input=validInputs(),result=fallbackDecision(input.signal,input.quote,input.risk,input.now);
 assert.equal(result.ok,true);
 assert.equal(result.trade.dataQuality,'live-price-fallback');
 assert.equal(result.trade.paperOnly,true);
 assert.equal(result.trade.entry,102);
 assert.ok(result.trade.riskAmount>0);
});

test('keeps fallback pending for stale, same-source, misaligned, expired, or unbudgeted inputs',()=>{
 const base=validInputs();
 assert.equal(fallbackDecision(base.signal,{...base.quote,fetchedAt:base.now-16000},base.risk,base.now).code,'quote-stale');
 assert.equal(fallbackDecision(base.signal,{...base.quote,provider:'bybit'},base.risk,base.now).code,'quote-not-independent');
 assert.equal(fallbackDecision({...base.signal,provider:'spot'},{...base.quote,provider:'futures'},base.risk,base.now).code,'quote-not-independent');
 assert.equal(fallbackDecision(base.signal,{...base.quote,price:99},base.risk,base.now).code,'price-not-aligned');
 assert.equal(fallbackDecision({...base.signal,createdAt:base.now-16*minute},base.quote,base.risk,base.now).code,'signal-expired');
 assert.equal(fallbackDecision(base.signal,base.quote,{...base.risk,dayRemaining:0},base.now).code,'risk-budget-exhausted');
});
