const {chromium}=require(process.env.ZEBRA_PLAYWRIGHT || 'playwright');
const fs=require('fs'), assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../../zebra_puzzle_legacy.html'),'utf8');
const out=process.env.ZEBRA_SCREENSHOT_DIR || '/tmp/zebra-browser/shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.ZEBRA_CHROME,args:['--no-sandbox']});
 const report=[];
 for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 const context=await browser.newContext({viewport:{width,height}});
 await context.route('https://audit.local/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('https://audit.local/zebra');
 const shot=async(name)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${out}/${device}-${name}.png`,fullPage:true});const dims=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));report.push({device,name,...dims});assert(dims.scrollWidth<=dims.width+1,`page overflow ${device}/${name}: ${JSON.stringify(dims)}`);};
 const click=async(id)=>page.locator('#'+id).click();
 const mode=async(m)=>page.locator(`[data-mode="${m}"]`).click();
 const win=async()=>{await page.evaluate(()=>{const s=ZEBRA.S;for(const c in s.cur.solution)s.assign[c]=s.cur.solution[c].slice();});await click('checkBtn');};
 assert(!(await page.locator('#themeRow').innerText()).includes('故事模式'));
 await shot('01-free-home');await click('listBtn');await shot('02-free-list');await click('listBtn');
 await click('startBtn');await shot('03-free-game');await page.locator('#grid .cell').first().click();await shot('04-value-picker');await page.keyboard.press('Escape');
 await click('checkBtn');await shot('05-incomplete');await click('giveUpBtn');await shot('06-answer');await click('backBtn');
 await mode('story');await page.locator('#chapters button').nth(4).click();await shot('07-story-select');await click('startBtn');await shot('08-story-game');await win();await shot('09-story-result');await click('nextStageBtn');await shot('10-story-next');await click('backBtn');
 await mode('daily');await shot('11-daily-home');await click('startBtn');await shot('12-daily-game');await win();await shot('13-daily-result');await click('backBtn');
 await click('exportBtn');await shot('14-export');await click('syncCancel');await click('importBtn');await shot('15-import');await click('syncCancel');
 await page.evaluate(()=>{localStorage.setItem('zebra_theme','story');localStorage.setItem('zebra_tag','deleted-tag');});await page.reload();assert((await page.locator('#themeRow .on').innerText())==='不限主题');await mode('story');assert((await page.locator('#chapters button').count())===19);
 await mode('story');await page.locator('#chapters button').nth(6).click();await click('startBtn');await shot('16-seven-column-story');await win();await shot('17-seven-column-result');await click('backBtn');
 await page.evaluate(()=>{localStorage.setItem('zebra_records','null');});await page.reload();await shot('18-recovered-storage');
 assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({screenshots:report.length,report,out}));
})().catch(e=>{console.error(e);process.exit(1)});
