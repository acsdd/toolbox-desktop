/** Focused integration smoke: isolated profile and synthetic data only. */
const {app,BrowserWindow,shell}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'toolbox-widgets-test-')));BrowserWindow.prototype.show=function(){};
let draft='';shell.openExternal=async url=>{draft=url};
const backupDir=fs.mkdtempSync(path.join(os.tmpdir(),'toolbox-verify-test-'));
const {execFileSync}=require('node:child_process');
const childProcess=require('node:child_process'),originalExecFile=childProcess.execFile;
let eventCheck=0;
childProcess.execFile=function(file,args,options,callback){
 if(file==='powershell.exe' && args.some(arg=>typeof arg==='string' && arg.includes('Get-WinEvent -FilterHashtable'))){
  const outputs=['[]',JSON.stringify([{Time:'2026-01-01',Id:42,ProviderName:'Synthetic',Message:'Test event'}])];
  const current=eventCheck++;setImmediate(()=>current<2?callback(null,outputs[current],''):callback(new Error('Access denied'),'','Access denied'));return {kill(){}};
 }
 return originalExecFile.apply(this,arguments);
};
const projectsDir=fs.mkdtempSync(path.join(os.tmpdir(),'toolbox-projects-test-')),repo=path.join(projectsDir,'demo');fs.mkdirSync(repo);execFileSync('git',['init','-q',repo]);execFileSync('git',['-C',repo,'config','user.name','Test']);execFileSync('git',['-C',repo,'config','user.email','test@example.invalid']);fs.writeFileSync(path.join(repo,'tracked.txt'),'before');execFileSync('git',['-C',repo,'add','tracked.txt']);execFileSync('git',['-C',repo,'-c','commit.gpgsign=false','commit','-qm','initial']);fs.writeFileSync(path.join(repo,'tracked.txt'),'changed');fs.writeFileSync(path.join(repo,'untracked.txt'),'new');
const branch=execFileSync('git',['-C',repo,'branch','--show-current'],{encoding:'utf8'}).trim();execFileSync('git',['-C',repo,'remote','add','origin','http://127.0.0.1/unsafe']);execFileSync('git',['-C',repo,'config',`branch.${branch}.remote`,'origin']);execFileSync('git',['-C',repo,'config',`branch.${branch}.merge`,`refs/heads/${branch}`]);
const corruptBackup=path.join(backupDir,'corrupt.tbx');fs.writeFileSync(corruptBackup,Buffer.alloc(128));
const diskDir=fs.mkdtempSync(path.join(os.tmpdir(),'toolbox-disk-test-'));fs.mkdirSync(path.join(diskDir,'nested'));fs.writeFileSync(path.join(diskDir,'nested','data.bin'),Buffer.alloc(17));
const server=http.createServer((req,res)=>{res.writeHead(req.url==='/bad'?503:200,{'Content-Type':'application/json'});res.end(req.url==='/api/ps'?JSON.stringify({models:[{name:'test-loaded'}]}):req.url==='/v1/models'?JSON.stringify({data:[{id:'test-available'}]}):'{}')});
require('../out/main/index.js');const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;let w;
 for(let i=0;i<150;i++){w=BrowserWindow.getAllWindows().find(win=>!win.isDestroyed());if(w&&!w.webContents.isLoading())break;await wait(100)}if(!w)throw Error('Main window not found');await wait(600);
 const result=await w.webContents.executeJavaScript(`(async()=>{
   const dns=await window.api.diagnostics.run({kind:'dns',target:'localhost'});
   const tcp=await window.api.diagnostics.run({kind:'tcp',target:'127.0.0.1',port:${port}});
   const http=await window.api.diagnostics.run({kind:'http',target:'http://127.0.0.1:${port}/'});
   const unavailable=await window.api.diagnostics.run({kind:'http',target:'http://127.0.0.1:${port}/bad'});
   const aiOllama=await window.api.aiMonitor.check({kind:'ollama',url:'http://127.0.0.1:${port}'});
   const aiStudio=await window.api.aiMonitor.check({kind:'lmstudio',url:'http://127.0.0.1:${port}'});
   const incident=await window.api.diagnostics.incident(false);
   const emptyEvents=await window.api.diagnostics.incident(true);
   const listedEvents=await window.api.diagnostics.incident(true);
   const deniedEvents=await window.api.diagnostics.incident(true);
   await window.api.diagnostics.emailDraft({recipient:'support@example.invalid',subject:'Toolbox incident flow test',body:'Synthetic test report. No diagnostic data is included.'});
   const projects=await window.api.projects.list(${JSON.stringify(projectsDir)});
   let rejectedFetch=false;try{await window.api.projects.fetch(${JSON.stringify(repo)})}catch{rejectedFetch=true}
   const disk=await window.api.diskExplorer.scan(${JSON.stringify(diskDir)});
   const capacity=await window.api.diskExplorer.capacity(${JSON.stringify(diskDir)});
   const services=await window.api.configuration.services('ToolboxServiceDoesNotExist');
   const reminders=await window.api.reminders.add({name:'Synthetic reminder',dueAt:Date.now()+3600000,repeat:'none'});
   const removed=await window.api.reminders.remove(reminders.find(item=>item.name==='Synthetic reminder').id);
   const before=await window.api.vault.list();
   await window.api.vault.add({name:'Test secret',value:'synthetic-secret',notes:''});
   const backup=await window.api.backup.create({destination:${JSON.stringify(backupDir)},password:'test-backup-passphrase',config:{disabled:[],pinned:false,cardSize:'medium'}});
   const verified=await window.api.backup.verify({file:backup.file,password:'test-backup-passphrase'});
   let wrong=false;try{await window.api.backup.verify({file:backup.file,password:'wrong-passphrase'})}catch{wrong=true}
   let corrupt=false;try{await window.api.backup.verify({file:${JSON.stringify(corruptBackup)},password:'test-backup-passphrase'})}catch{corrupt=true}
   const after=await window.api.vault.list();return {dns,tcp,http,unavailable,aiOllama,aiStudio,incident,emptyEvents,listedEvents,deniedEvents,projects,rejectedFetch,disk,capacity,services,reminders,removed,verified,wrong,corrupt,vaultUnchanged:after.length===before.length+1};
 })()`);
 assert.equal(result.dns.ok,true);assert.equal(result.tcp.ok,true);assert.equal(result.http.ok,true);assert.equal(result.unavailable.ok,false);assert.deepEqual(result.aiOllama.models,['test-loaded']);assert.deepEqual(result.aiStudio.models,['test-available']);assert.match(result.incident.summary,/OS:/);assert.equal(result.incident.events,'Not included.');assert.equal(result.emptyEvents.events,'No recent System errors found.');assert.match(result.listedEvents.events,/Event 42/);assert.match(result.deniedEvents.events,/Unable to read/);assert.equal(result.projects.length,1);assert.equal(result.projects[0].changes,2);assert.equal(result.rejectedFetch,true);assert.equal(result.disk.totalBytes,17);assert.equal(result.disk.truncated,false);assert.ok(result.capacity.total>0);assert.equal(result.services.services[0].status,'Not found');assert.ok(result.reminders.some(item=>item.name==='Synthetic reminder'));assert.ok(!result.removed.some(item=>item.name==='Synthetic reminder'));assert.equal(result.verified.secretCount,1);assert.equal(result.vaultUnchanged,true);assert.equal(result.wrong,true);assert.equal(result.corrupt,true);assert.ok(draft.startsWith('mailto:support@example.invalid?'));assert.ok(draft.includes('Synthetic%20test'));
 console.log('WIDGET SMOKE PASSED: DNS, TCP, HTTP, project status, disk scan, reminders, incident draft and backup verification');server.close();app.quit();
}).catch(error=>{console.error(error);server.close();app.exit(1)});setTimeout(()=>{console.error('Widget smoke timed out');server.close();app.exit(1)},40000);
