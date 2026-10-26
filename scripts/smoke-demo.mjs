import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5176','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let attempt=0;attempt<30;attempt++){try{const res=await fetch('http://127.0.0.1:5176');if(res.ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5176');await page.getByRole('status').filter({hasText:'DEMO MODE'}).waitFor();await page.locator('.chat-list .chat-row').first().click();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Testing the APK interface');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.locator('.bubble').filter({hasText:'Testing the APK interface'}).waitFor();
 await page.reload();await page.locator('.chat-list .chat-row').first().click();await page.locator('.bubble').filter({hasText:'Testing the APK interface'}).waitFor();assert.deepEqual(errors,[]);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/loop-apk-demo.png',fullPage:true});
 console.log('Packaged demo assets passed: visible demo label, mobile navigation, send, persist after reload, no script errors or horizontal overflow.');
}finally{await browser?.close();server.kill();}
