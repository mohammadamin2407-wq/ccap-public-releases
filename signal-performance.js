(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CCAPSignalPerformance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const MINUTE_MS=60000;

 function normalizeMinuteCandles(input){
  const byTime=new Map(),invalidStarts=new Set(),conflicts=new Set();
  for(const raw of Array.isArray(input)?input:[]){
   const row=Array.isArray(raw)?raw:null;
   if(!row||row.length<5){continue}
   const time=Number(row[0]),open=Number(row[1]),high=Number(row[2]),low=Number(row[3]),close=Number(row[4]),volume=row[5]==null?0:Number(row[5]);
   if(!Number.isSafeInteger(time)||time<0||time%MINUTE_MS!==0){if(Number.isSafeInteger(time)&&time>=0)invalidStarts.add(time);continue}
   const valid=[open,high,low,close,volume].every(Number.isFinite)&&open>0&&high>0&&low>0&&close>0&&volume>=0&&high>=Math.max(open,close,low)&&low<=Math.min(open,close,high);
   if(!valid){
    if(Number.isSafeInteger(time)&&time>=0&&time%MINUTE_MS===0){byTime.delete(time);conflicts.add(time)}
    invalidStarts.add(time);continue
   }
   const normalized=row.slice();normalized[0]=time;normalized[1]=open;normalized[2]=high;normalized[3]=low;normalized[4]=close;normalized[5]=volume;normalized[6]=time+MINUTE_MS-1;
   const prior=byTime.get(time);
   if(prior){
    const identical=[1,2,3,4,5].every(i=>Number(prior[i])===Number(normalized[i]));
    if(!identical){byTime.delete(time);conflicts.add(time);invalidStarts.add(time)}
    continue;
   }
   if(!conflicts.has(time))byTime.set(time,normalized);
  }
  return {candles:[...byTime.values()].sort((a,b)=>a[0]-b[0]),invalidStarts:[...invalidStarts].sort((a,b)=>a-b)};
 }

 function validateMinuteHistory(input,fromMs,toMs){
  const normalized=normalizeMinuteCandles(input),from=Number(fromMs),to=Number(toMs);
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)return {...normalized,fromMs:from,toMs:to,gaps:[],complete:false,reason:'invalid-range'};
  const first=Math.ceil(from/MINUTE_MS)*MINUTE_MS,last=Math.floor(to/MINUTE_MS)*MINUTE_MS;
  if(last<first)return {...normalized,fromMs:first,toMs:last,gaps:[],complete:true,reason:null};
  const present=new Set(normalized.candles.map(k=>k[0])),invalid=new Set(normalized.invalidStarts),gaps=[];
  for(let time=first;time<=last;time+=MINUTE_MS){if(!present.has(time)){gaps.push(time);if(gaps.length>=10000)break}}
  const invalidInRange=[...invalid].filter(time=>time>=first&&time<=last);
  return {...normalized,fromMs:first,toMs:last,gaps,invalidStarts:invalidInRange,complete:gaps.length===0&&invalidInRange.length===0,reason:gaps.length||invalidInRange.length?'missing-or-invalid-minute':null};
 }

 function mergeMinutePages(pages){return normalizeMinuteCandles((Array.isArray(pages)?pages:[]).flatMap(page=>Array.isArray(page)?page:[]))}

 function fallbackDecision(signal,quote,risk,now=Date.now()){
  const fail=(code,reason)=>({ok:false,code,reason});
  if(!signal||!['LONG','SHORT'].includes(signal.direction)||Number(signal.score)<70)return fail('signal-not-actionable','سیگنال معتبر با امتیاز حداقل ۷۰ در دسترس نیست.');
  const createdAt=Number(signal.createdAt),age=now-createdAt;
  if(!Number.isFinite(createdAt)||age<0||age>15*60*1000||signal.stillValid!==true)return fail('signal-expired','اعتبار سیگنال تمام شده یا جهت آن در تحلیل تازه تأیید نشده است.');
  if(!quote||quote.verified!==true||!Number.isFinite(Number(quote.price))||Number(quote.price)<=0)return fail('quote-unverified','قیمت لحظه‌ای مستقل تأیید نشد.');
  const quoteTime=Number(quote.fetchedAt),quoteAge=now-quoteTime;
  if(!Number.isFinite(quoteTime)||quoteAge<0||quoteAge>15000)return fail('quote-stale','قیمت مستقل تازه نیست؛ رکورد در انتظار می‌ماند.');
  const venue=provider=>['spot','futures','binance'].includes(provider)?'binance':provider;
  if(!quote.provider||!signal.provider||venue(quote.provider)===venue(signal.provider))return fail('quote-not-independent','منبع قیمت با منبع سیگنال مستقل نیست.');
  const symbol=String(signal.symbol||'').replace(/[^A-Z0-9]/gi,'').toUpperCase().replace(/USDT$/,'');
  const quoteSymbol=String(quote.symbol||'').replace(/[^A-Z0-9]/gi,'').toUpperCase().replace(/USDT$/,'');
  if(!symbol||symbol!==quoteSymbol)return fail('quote-symbol-mismatch','نماد قیمت مستقل با نماد سیگنال یکسان نیست.');
  const plan=signal.plan||signal,entry=Number(plan.entry),stop=Number(plan.stop),target1=Number(plan.target1),target2=Number(plan.target2),price=Number(quote.price);
  if(![entry,stop,target1,target2].every(Number.isFinite)||![entry,stop,target1,target2].every(x=>x>0))return fail('invalid-plan','ورود، حدضرر و هر دو هدف باید قیمت معتبر داشته باشند.');
  const long=signal.direction==='LONG';
  if(long?!(stop<entry&&entry<target1&&target1<=target2):!(stop>entry&&entry>target1&&target1>=target2))return fail('invalid-plan-order','ترتیب حدضرر و اهداف با جهت سیگنال هم‌خوان نیست.');
  if(long?!(price>entry&&price<target1&&price>stop):!(price<entry&&price>target1&&price<stop))return fail('price-not-aligned','قیمت مستقل در جهت سیگنال و پیش از هدف اول حرکت نکرده است.');
  const riskDistance=Math.abs(price-stop),reward=Math.abs(target1-price),rr=reward/riskDistance;
  if(!(riskDistance>0)||!Number.isFinite(rr)||rr<1)return fail('reward-risk-too-low','نسبت سود به ریسک از قیمت فعلی کمتر از ۱ است.');
  if(!risk||risk.enabled!==true)return fail('risk-disabled','مدیریت ریسک آزمایشی فعال نیست؛ رکورد در انتظار می‌ماند.');
  const balance=Number(risk.balance),perTradePct=Number(risk.perTradePct),dayRemaining=Number(risk.dayRemaining),weekRemaining=Number(risk.weekRemaining),leverage=Number(risk.leverage);
  if(!Number.isFinite(balance)||balance<=0||!Number.isFinite(perTradePct)||perTradePct<=0||perTradePct>10||!Number.isFinite(dayRemaining)||!Number.isFinite(weekRemaining)||!Number.isFinite(leverage)||leverage<1||leverage>125)return fail('risk-settings-invalid','تنظیمات سرمایه یا سقف ریسک معتبر نیست.');
  if(risk.sameSymbolActive===true)return fail('symbol-risk-active','برای این نماد برنامه آزمایشی فعالی وجود دارد.');
  const riskAmount=Math.min(balance*perTradePct/100,dayRemaining,weekRemaining);
  if(!(riskAmount>0))return fail('risk-budget-exhausted','بودجه ریسک روزانه یا هفتگی کافی نیست.');
  const qty=riskAmount/riskDistance,notional=qty*price,margin=notional/leverage;
  if(![qty,notional,margin].every(Number.isFinite)||!(margin>riskAmount))return fail('margin-check-failed','بررسی حجم یا مارجین تخمینی ریسک را تأیید نکرد.');
  return {ok:true,code:'paper-fallback-approved',reason:'قیمت مستقل تازه، جهت سیگنال و کنترل‌های ریسک تأیید شدند.',trade:{symbol,direction:signal.direction,entry:price,stop,target1,target2,qty,notional,margin,riskAmount,leverage,rewardRisk:rr,provider:quote.provider,fetchedAt:quoteTime,dataQuality:'live-price-fallback',paperOnly:true}};
 }

 return {MINUTE_MS,normalizeMinuteCandles,validateMinuteHistory,mergeMinutePages,fallbackDecision};
});
