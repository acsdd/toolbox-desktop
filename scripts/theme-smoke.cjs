/** Verify both suite theme selectors using isolated profiles and a local MCP panel. */
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process')
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'toolbox-theme-test-'));app.setPath('userData',profile);BrowserWindow.prototype.show=function(){}
require('../out/main/index.js');const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const panel=spawn('node',[path.resolve(__dirname,'../../toolbox-mcp/dist/panel.js')],{windowsHide:true,env:{...process.env,TOOLBOX_MCP_HOME:path.join(profile,'mcp'),TOOLBOX_MCP_PORT:'0'},stdio:['ignore','pipe','pipe']})
let output='',errors='';panel.stdout.on('data',x=>output+=x);panel.stderr.on('data',x=>errors+=x)
const choices=['night','day','bright-night','ocean','plum','bugs','daffy','tweety','sylvester','taz','roadrunner']
async function testWindow(win,selector,key,label){
 for(const theme of choices){
  const result=await win.webContents.executeJavaScript(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(theme)};s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);assert.equal(result,true);await wait(40)
  const state=await win.webContents.executeJavaScript(`({theme:document.documentElement.dataset.theme,saved:localStorage.getItem(${JSON.stringify(key)}),overflow:document.documentElement.scrollWidth>innerWidth})`)
  assert.equal(state.theme,theme,label);assert.equal(state.saved,theme,label);assert.equal(state.overflow,false,label+' overflow')
  if(['day','roadrunner'].includes(theme)){await win.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await wait(350);fs.writeFileSync(path.join(profile,label+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG())}
 }
 const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;await wait(200)
 assert.equal(await win.webContents.executeJavaScript('document.documentElement.dataset.theme'),'roadrunner',label+' persistence')
 win.setSize(label==='desktop'?800:600,800);await wait(250)
 const narrow=await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}})()`)
 assert.equal(narrow.fits,true,label+' theme selector clipped');assert.equal(narrow.overflow,false,label+' narrow overflow')
}
app.whenReady().then(async()=>{let main;for(let i=0;i<100;i++){main=BrowserWindow.getAllWindows().find(x=>!x.isDestroyed());if(main&&!main.webContents.isLoading())break;await wait(100)}if(!main)throw Error('Desktop window missing');main.setSize(1180,800);main.webContents.setBackgroundThrottling(false);await wait(500)
 await testWindow(main,'.suite-theme select','toolbox.appearance.theme','desktop')
 let match;for(let i=0;i<150;i++){match=/http:\/\/127\.0\.0\.1:(\d+)/.exec(output);if(match)break;if(panel.exitCode!==null)throw Error('MCP panel failed: '+errors.slice(0,400));await wait(100)}if(!match)throw Error('MCP panel timed out')
 const win=new BrowserWindow({show:false,width:1180,height:800,webPreferences:{backgroundThrottling:false}});await win.loadURL('http://127.0.0.1:'+match[1]);await wait(500)
 await testWindow(win,'#suite-theme','toolbox.mcp.appearance.theme','mcp');win.destroy();console.log('THEME SMOKE PASSED: 11 themes and persistence in both apps');console.log('Screenshots: '+profile);panel.kill();app.quit()
}).catch(error=>{console.error(error);panel.kill();app.exit(1)})
setTimeout(()=>{console.error('Theme smoke timed out');panel.kill();app.exit(1)},40000)
