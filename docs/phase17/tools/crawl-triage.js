const { chromium } = require('playwright'); const B='http://127.0.0.1:5057';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1360,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(B+'/admin/');await p.waitForTimeout(900);await p.click('text=admin@medlog.demo');await p.waitForTimeout(500);const m=await p.$('input[maxlength="6"]');if(m){await m.fill('123456');await p.click('button:has-text("تحقق")');}await p.waitForTimeout(1300);
const cases=[['/map','button:has-text("الوقت")'],['/system/security','button:has-text("إلغاء")'],['/shipments/new','button:has-text("التالي")'],['/shipments/new','button:has-text("رجوع")'],['/legs','button:has-text("إسناد ناقل")'],['/lost','button:has-text("تسجيل استرداد")'],['/contracts','button:has-text("تعليق")'],['/contracts','button:has-text("تفعيل")'],['/delays','button:has-text("تصعيد")'],['/delays','button:has-text("إغلاق")'],['/delays','main a:has-text("ML-2026-000004")']];
for (const [r,s] of cases){ await p.goto(B+'/admin/#'+r); await p.reload(); await p.waitForTimeout(1500); const l=p.locator(s).first(); const n=await p.locator(s).count(); let info=''; if(!n){console.log(r,s,'NOT PRESENT');continue;}
 const st=await l.evaluate(e=>({dis:e.disabled, vis:e.getBoundingClientRect().height, top:(()=>{const bb=e.getBoundingClientRect();const t=document.elementFromPoint(bb.x+bb.width/2,bb.y+bb.height/2);return t===e||e.contains(t)?'self':t?.outerHTML.slice(0,90)})()}));
 const t0=await p.locator('main').innerText(); const d0=await p.locator('[role=dialog]').count(); errs.length=0;
 try{ await l.click({timeout:3000}); info='clicked'; }catch(e){info='FAIL '+e.message.split('\n').slice(0,4).join(' / ').slice(0,200)}
 await p.waitForTimeout(700); console.log(r,s,JSON.stringify(st),info,'changed',t0!==await p.locator('main').innerText(),'dialog',d0,'->',await p.locator('[role=dialog]').count(),'toast',await p.locator('.toast').allInnerTexts(),errs);}
await b.close();})();
