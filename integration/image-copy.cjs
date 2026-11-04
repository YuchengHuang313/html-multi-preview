const assert = require('node:assert/strict');
const WebSocket = require('ws');
const pause = ms => new Promise(r=>setTimeout(r,ms));
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject)});
  let id=0;
  const pending=new Map();
  socket.on('message',raw=>{const result=JSON.parse(raw);const request=pending.get(result.id);if(request){pending.delete(result.id);result.error?request.reject(new Error(JSON.stringify(result.error))):request.resolve(result.result)}});
  return {
    close:()=>socket.close(),
    send(method,params={}) {return new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,{resolve,reject});socket.send(JSON.stringify({id:seq,method,params}));});},
    async evaluate(expression) {
      const result=await new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,{resolve,reject});socket.send(JSON.stringify({id:seq,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true,userGesture:true}}));});
      if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
  };
}
exports.run = async (origin = 'http://127.0.0.1:43120') => {
  await pause(1000);
  let client;
  const targets=await (await fetch('http://127.0.0.1:9333/json/list')).json();
  for (const target of targets.filter(t=>t.type==='iframe' && t.url.startsWith(origin + '/a.html'))) {
    const candidate=await connect(target.webSocketDebuggerUrl);
    if(await candidate.evaluate('document.visibilityState === "visible"')) {client=candidate;break;}
    candidate.close();
  }
  assert.ok(client,'visible report iframe');
  try {
    await client.evaluate(`(() => {
      window.previewStabilityToken='preserve-loaded-report';
      document.body.dataset.selectedTab='chart';
      document.body.style.minHeight='3000px';
      location.hash='chart';
      window.scrollTo(0,300);
    })()`);
    const vscode = require('vscode');
    const noise = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,'background-update.txt');
    try {
      for (let i=0;i<3;i++) {
        await vscode.workspace.fs.writeFile(noise,Buffer.from('background update '+i));
        await pause(500);
      }
      await pause(2500);
      const state = await client.evaluate(`({token:window.previewStabilityToken,tab:document.body.dataset.selectedTab,hash:location.hash,scroll:window.scrollY})`);
      assert.deepEqual(state,{token:'preserve-loaded-report',tab:'chart',hash:'#chart',scroll:300});
      console.log('STATE RETENTION PASS: background file writes preserve DOM state, selected page and scroll.');
    } finally { await vscode.workspace.fs.delete(noise); }
    await client.evaluate('window.scrollTo(0,0)');
    await client.send('Page.bringToFront').catch(()=>{});
    const point=await client.evaluate(`(() => {const r=document.querySelector('#copy-image-fixture').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    await client.evaluate(`(() => {
      const toBlob=HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob=function(callback,...args) {
        return toBlob.call(this,blob=>{
          window.copiedImageTest={type:blob.type,width:this.width,height:this.height};
          callback(blob);
        },...args);
      };
      window.addEventListener('message',event=>{
        if(event.data?.command==='html-multi-preview-copy-result' && !event.data.error) window.copiedImageTest.success=true;
      });
      const img=document.querySelector('#copy-image-fixture');
      img.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:30,clientY:30}));
      const root=Array.from(document.documentElement.children).find(e=>e.shadowRoot)?.shadowRoot;
      if(!root)throw new Error('Image context menu missing');
      root.querySelector('[role=menuitem]').click();
    })()`);
    let copied;
    for(let i=0;i<100;i++) {
      copied=await client.evaluate('window.copiedImageTest');
      if(copied?.success)break;
      const error=await client.evaluate(`Array.from(document.documentElement.children).find(e=>e.shadowRoot)?.shadowRoot.querySelector('[role=status]')?.textContent`);
      if(error?.startsWith('复制失败'))throw new Error(error);
      await pause(100);
    }
    assert.deepEqual(copied,{type:'image/png',width:32,height:16,success:true});
    console.log('IMAGE COPY PASS: real VS Code iframe menu writes native-resolution PNG to desktop clipboard.');
  } finally {client.close();}
};
