/** A changed NAS host must never keep results from a previous host. */
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'toolbox-nas-ui-')))
BrowserWindow.prototype.show=function(){}
require('../out/main/index.js')
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
app.whenReady().then(async()=>{
 let win;for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows().find(x=>!x.isDestroyed());if(win&&!win.webContents.isLoading())break;await wait(100)}
 if(!win)throw Error('Window unavailable');await wait(500)
 await win.webContents.executeJavaScript(`([...document.querySelectorAll('.tool-card')].find(x=>x.querySelector('h3')?.textContent==='NAS companion')).click()`)
 await wait(200)
 const setHost=value=>win.webContents.executeJavaScript(`(()=>{const el=document.querySelector('input[placeholder="nas-01"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await setHost('127.0.0.1')
 await win.webContents.executeJavaScript(`([...document.querySelectorAll('button')].find(x=>x.textContent==='Check NAS')).click()`)
 let result=false;for(let i=0;i<70;i++){await wait(100);result=await win.webContents.executeJavaScript(`document.querySelector('.diagnostic-list')?.textContent.includes('DSM HTTPS')||false`);if(result)break}
 assert.equal(result,true,'check should display results')
 await setHost('another-host');await wait(100)
 assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.diagnostic-list')?.textContent.includes('DSM HTTPS')||false`),false,'old results must disappear')
 console.log('NAS RESULT SMOKE PASSED');app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
setTimeout(()=>{console.error('NAS smoke timed out');app.exit(1)},20000)
