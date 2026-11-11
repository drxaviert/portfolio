// usage: node fig.js '<json array of {command,params}>'  -> prints results
const cmds = JSON.parse(process.argv[2]); const CH='i47nz6qy';
const ws = new WebSocket('ws://localhost:3055'); let i=0; const out=[]; const pending={};
function send(){ if(i>=cmds.length){console.log(JSON.stringify(out));ws.close();return;}
  const id='c'+Date.now()+'_'+i; pending[id]=i;
  ws.send(JSON.stringify({id,type:'message',channel:CH,message:{id,command:cmds[i].command,params:{...cmds[i].params,commandId:id}}}));
  setTimeout(()=>{ if(id in pending){out.push({error:'timeout',cmd:cmds[i].command});delete pending[id];i++;send();}},30000);}
ws.onopen=()=>ws.send(JSON.stringify({type:'join',channel:CH}));
ws.onmessage=e=>{const d=JSON.parse(e.data);
  if(d.type==='system'&&!send.started&&String(JSON.stringify(d)).includes('oined')){send.started=1;return send();}
  const m=d.message; if(!m||!(m.id in pending)) return; if(!('result' in m)&&!m.error) return;
  delete pending[m.id]; out.push(m.error?{error:m.error}:m.result); i++; send();};
