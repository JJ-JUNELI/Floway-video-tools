const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage();
  // measure dot/button centers for two different border widths by instrumenting arc calls
  const measure = async (m) => p.evaluate(async (m) => {
    const mod = await import('/shared/border-effects.js?probe=' + Math.random());
    const cv = document.createElement('canvas'); cv.width=600; cv.height=700;
    const ctx = cv.getContext('2d');
    const arcs = [];
    const origArc = ctx.arc.bind(ctx);
    ctx.arc = (x,y,r,...rest) => { arcs.push({x:Math.round(x),y:Math.round(y),r:Math.round(r)}); return origArc(x,y,r,...rest); };
    mod.drawBrowserChrome(ctx, {x:40,y:40,w:480,h:620}, { cardRadius:28, chromeBorderWidth:m, chromeBorderColor:'#cfcfcf', chromeGlowWidth:0 }, (c,x,y,w,h)=>{c.fillStyle='#fff';c.fillRect(x,y,w,h);});
    // dot is the first large arc (r~uiH*0.2); buttons are r~uiH*0.26 circles. report the leftmost(dot) and rightmost(last button) big arcs
    const big = arcs.filter(a=>a.r>10);
    const leftmost = big.reduce((a,b)=>b.x<a.x?b:a);
    const rightmost = big.reduce((a,b)=>b.x>a.x?b:a);
    return { dot:leftmost, lastBtn:rightmost };
  }, m);
  const a = await measure(10);
  const c = await measure(50);
  console.log('UIPOS m10='+JSON.stringify(a)+' m50='+JSON.stringify(c));
  await b.close();
})().catch(e=>console.log('THREW '+e.message));
