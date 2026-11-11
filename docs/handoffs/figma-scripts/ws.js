const CH='i47nz6qy';
module.exports=()=>new Promise(res=>{const ws=new WebSocket('ws://localhost:3055');const pend={};let n=0;
 ws.onopen=()=>ws.send(JSON.stringify({type:'join',channel:CH}));
 ws.onmessage=e=>{const d=JSON.parse(e.data);
  if(d.type==='system'&&!ws.ready&&JSON.stringify(d).includes('oined')){ws.ready=1;return res({call,close:()=>ws.close()});}
  const m=d.message;if(!m||!pend[m.id])return;if(!('result' in m)&&!m.error)return;
  const p=pend[m.id];delete pend[m.id];m.error?p.rej(new Error(p.c+': '+JSON.stringify(m.error))):p.res(m.result);};
 function call(c,params={}){const id='k'+Date.now()+'_'+(n++);return new Promise((r,j)=>{pend[id]={res:r,rej:j,c};
  ws.send(JSON.stringify({id,type:'message',channel:CH,message:{id,command:c,params:{...params,commandId:id}}}));
  setTimeout(()=>{if(pend[id]){delete pend[id];j(new Error(c+' timeout'))}},30000);});}
});
