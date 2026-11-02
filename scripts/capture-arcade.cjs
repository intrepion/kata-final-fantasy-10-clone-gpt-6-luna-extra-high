'use strict';
const {chromium}=require('playwright');const {mkdir,readFile,writeFile}=require('node:fs/promises');const {createHash}=require('node:crypto');const path=require('node:path');
(async()=>{const output=process.env.CAPTURE_OUTPUT||'/tmp/tidebound-captures',site=process.env.CAPTURE_SITE||'capture-site';await mkdir(output,{recursive:true});const inputs={};for(const f of ['index.html','styles.css','game.js','scene3d.js','sphere-grid.js','favicon.svg'])inputs[f]=createHash('sha256').update(await readFile(path.join(site,f))).digest('hex');const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1,locale:'en-US',reducedMotion:'reduce'});await page.goto('http://127.0.0.1:4216/',{waitUntil:'domcontentloaded'});await page.locator('#beginJourney').click();await page.keyboard.down('ArrowRight');await page.waitForTimeout(1200);await page.keyboard.up('ArrowRight');
 await page.locator('#mapScreen').screenshot({path:path.join(output,'tidebound-01.png'),animations:'disabled'});
 for(let i=0;i<8 && !(await page.locator('#battleScreen').isVisible());i++){let key=i%2?'ArrowRight':'ArrowLeft';await page.keyboard.down(key);await page.waitForTimeout(1800);await page.keyboard.up(key)}
 if(!(await page.locator('#battleScreen').isVisible()))throw Error('No encounter reached');await page.waitForTimeout(500);
 await page.locator('#battleScreen').screenshot({path:path.join(output,'tidebound-02.png'),animations:'disabled'});
 await writeFile(path.join(output,'capture.json'),JSON.stringify({schemaVersion:1,workflowCommit:process.env.GITHUB_SHA||null,sourceCommit:process.env.GAME_SOURCE_COMMIT||null,runId:process.env.GITHUB_RUN_ID||null,url:'http://127.0.0.1:4216/',inputs,browser:browser.version(),viewport:{width:1280,height:1000},screenshots:['tidebound-01.png','tidebound-02.png']},null,2)+'\n');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
