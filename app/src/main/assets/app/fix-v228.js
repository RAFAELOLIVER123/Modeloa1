(function(){
'use strict';

// AgroDominium 2.2.8
// Mantém o fluxo estável da 2.2.6 e acrescenta apenas mapa melhor, estimativa e consulta de produtor.
const baseHome=home;
const baseManagerHome=managerHome;
const baseAdd=add;
const baseActivityDetail=activityDetail;
const baseLocationResult=window.agroLocationResult;
const baseCameraResult=window.agroCameraResult;

const X={
  gps:null,
  photos:[],
  map:{mode:'mine',items:[],routes:[],center:{lat:-2.5,lng:-48.5},zoom:9,ready:false,selected:null,drag:false,lastX:0,lastY:0,moved:0,pinch:0}
};
const EST_PREFIX='ESTIMATIVA_JSON:';

function role228(){return String((S.user||{}).perfil_codigo||'').toUpperCase()}
function manager228(){return ['SUPERVISOR','GERENTE','DIRETOR','ADMIN','ADMINISTRADOR','ADMINISTRATOR'].includes(role228())}
try{isManager=manager228}catch(e){}

function appendUnique(el,html,key){if(!el||document.querySelector('[data-v228="'+key+'"]'))return;el.insertAdjacentHTML('beforeend',html)}
function firstActionGrid(){return [...document.querySelectorAll('#screen .grid-2')][0]||null}

home=function(){
  baseHome();
  setTimeout(()=>{
    const g=firstActionGrid();
    appendUnique(g,`<button data-v228="estimate-home" class="action-card" onclick="estimates228()"><span class="ico">◌</span><span><strong>Estimativa</strong><small>Coleta produtiva em campo</small></span></button>`,'estimate-home');
    appendUnique(g,`<button data-v228="producer-home" class="action-card" onclick="producers228()"><span class="ico">♧</span><span><strong>${manager228()?'Produtores':'Meus produtores'}</strong><small>Consulta cadastral</small></span></button>`,'producer-home');
  },0);
};

managerHome=function(r){
  baseManagerHome(r);
  setTimeout(()=>{
    const g=firstActionGrid();
    appendUnique(g,`<button data-v228="estimate-manager" class="action-card" onclick="estimates228()"><span class="ico">◌</span><strong>Estimativas</strong><small>Coletas de campo</small></button>`,'estimate-manager');
    appendUnique(g,`<button data-v228="producer-manager" class="action-card" onclick="producers228()"><span class="ico">♧</span><strong>Produtores</strong><small>Consulta completa</small></button>`,'producer-manager');
  },0);
};

add=function(){
  baseAdd();
  setTimeout(()=>{
    const g=firstActionGrid();
    appendUnique(g,`<button data-v228="estimate-add" class="action-card" onclick="estimateForm228()"><span class="ico">◌</span><strong>Estimativa</strong><small>GPS + estrutura + fotos</small></button>`,'estimate-add');
    appendUnique(g,`<button data-v228="producer-add" class="action-card" onclick="producers228()"><span class="ico">♧</span><strong>Consultar produtor</strong><small>Somente leitura</small></button>`,'producer-add');
  },0);
};

activityDetail=function(ref){
  baseActivityDetail(ref);
  setTimeout(()=>{
    const g=firstActionGrid();
    appendUnique(g,`<button data-v228="estimate-activity" class="action-card" onclick="estimateForm228('${String(ref).replace(/'/g,"\\'")}')"><span class="ico">◌</span><strong>Estimativa</strong><small>Coleta vinculada à atividade</small></button>`,'estimate-activity');
    appendUnique(g,`<button data-v228="map-activity" class="action-card route" onclick="map228('routes')"><span class="ico">⌁</span><strong>Ver rotas</strong><small>Mapa do deslocamento</small></button>`,'map-activity');
  },0);
};

// ---------------- PRODUTORES (somente leitura) ----------------
function visiblePlantings228(){
  const u=S.user||{};
  if(manager228())return D.plantios||[];
  return (D.plantios||[]).filter(x=>+x.tecnico_usuario_id===+u.id||norm(x.tecnico_nome_base)===norm(u.nome)||norm(x.tecnico_nome)===norm(u.nome));
}
function visibleProducerIds228(){return new Set(visiblePlantings228().map(x=>+x.produtor_id))}
window.producers228=function(){
  load();
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>${manager228()?'Produtores':'Meus produtores'}</h1><p>Consulta — sem edição</p></div></div><div class="search"><input id="p228q" placeholder="Buscar nome, CPF, código ou comunidade" oninput="renderProducers228()"></div><div id="p228list" class="list" style="margin-top:12px"></div>`;
    renderProducers228();
  });
};
window.renderProducers228=function(){
  const q=norm($('#p228q')?.value||''),ids=visibleProducerIds228();
  let arr=(D.produtores||[]).filter(p=>manager228()||ids.has(+p.id));
  if(q)arr=arr.filter(p=>{
    const pls=(D.plantios||[]).filter(x=>+x.produtor_id===+p.id);
    return norm([p.nome,p.cpf,p.cod_fornecedor,p.codigo,p.telefone,p.cidade,...pls.map(x=>[x.comunidade_nome,x.tecnico_nome,x.tecnico_nome_base,x.ano_plantio].join(' '))].join(' ')).includes(q);
  });
  const el=$('#p228list');
  if(el)el.innerHTML=arr.slice(0,250).map(p=>`<button class="row-card row-button" onclick="producerDetail228(${+p.id})"><span class="dot"></span><div class="body"><b>${esc(p.nome||'Produtor')}</b><small>${esc([p.cpf,p.cod_fornecedor||p.codigo,p.cidade].filter(Boolean).join(' · '))}</small></div><span class="badge">Ver</span></button>`).join('')||'<div class="card empty"><b>Nenhum produtor encontrado</b></div>';
};
window.producerDetail228=function(id){
  const p=(D.produtores||[]).find(x=>+x.id===+id);if(!p)return;
  const pls=(D.plantios||[]).filter(x=>+x.produtor_id===+id);
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>${esc(p.nome||'Produtor')}</h1><p>Informações somente para consulta</p></div></div>
      <div class="card detail-grid"><div><small>CPF</small><b>${esc(p.cpf||'—')}</b></div><div><small>Código</small><b>${esc(p.cod_fornecedor||p.codigo||'—')}</b></div><div><small>Telefone</small><b>${esc(p.telefone||'—')}</b></div><div><small>Cidade</small><b>${esc(p.cidade||'—')}</b></div><div><small>Status</small><b>${esc(p.status_atual||p.status||'—')}</b></div><div><small>E-mail</small><b>${esc(p.email||'—')}</b></div></div>
      <div class="section-title"><h2>Plantios</h2></div><div class="list">${pls.map(x=>`<div class="card"><b>${x.ano_plantio?'Plantio '+esc(x.ano_plantio):'Plantio'}</b><p>${esc([x.comunidade_nome,x.polo_sigla,x.tecnico_nome||x.tecnico_nome_base].filter(Boolean).join(' · '))}</p><small>${x.area_plantada_ha||x.area_ha?esc(x.area_plantada_ha||x.area_ha)+' ha':''}${x.car?' · CAR '+esc(x.car):''}</small>${validCoord228(+x.latitude,+x.longitude)?`<button class="btn secondary full" style="margin-top:10px" onclick="map228('producer',${+p.id})">Ver no mapa</button>`:''}</div>`).join('')||'<div class="card empty"><b>Sem plantios vinculados</b></div>'}</div>`;
  });
};

// ---------------- ESTIMATIVA OFFLINE ----------------
function estimateLocal228(){
  return (Q||[]).filter(q=>q.type==='ponto.create'&&q.status!=='SYNCED').map(q=>{const p=parse(q.payload_json,{});if(p.tipo_registro!=='ESTIMATIVA')return null;let e={};try{e=JSON.parse(String(p.observacao||'').replace(EST_PREFIX,''))}catch(_){e=p}return {...e,_local:true,_queue:q}}).filter(Boolean);
}
function estimateServer228(){
  return (D.pontos||[]).map(p=>{const o=String(p.observacao||'');if(!o.startsWith(EST_PREFIX))return null;try{return {...JSON.parse(o.slice(EST_PREFIX.length)),id:p.id,_server:true,fotos:p.fotos||0}}catch(_){return null}}).filter(Boolean);
}
window.estimates228=function(){
  load();const local=estimateLocal228(),server=estimateServer228();
  open(()=>{$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Estimativas</h1><p>${server.length} sincronizada(s) · ${local.length} pendente(s)</p></div><button class="btn primary right" onclick="estimateForm228()">＋ Nova</button></div><div class="list">${[...local,...server].slice(0,180).map(e=>`<div class="row-card"><span class="dot"></span><div class="body"><b>${esc(e.produtor_nome||e.nome_produtor||'Estimativa')}</b><small>${br(e.data_estimativa||e.data)} · ${esc(e.comunidade_nome||'')}${e.ano_plantio?' · plantio '+esc(e.ano_plantio):''}</small></div><span class="badge ${e._local?'warn':''}">${e._local?'Pendente':'Salva'}</span></div>`).join('')||'<div class="card empty"><b>Nenhuma estimativa registrada</b></div>'}</div>`});
};
function estimatePlantOptions228(pid){return (D.plantios||[]).filter(x=>+x.produtor_id===+pid).map(x=>`<option value="${x.id}">${esc([x.ano_plantio?('Plantio '+x.ano_plantio):'Plantio',x.comunidade_nome,(x.area_plantada_ha||x.area_ha)?((x.area_plantada_ha||x.area_ha)+' ha'):'' ].filter(Boolean).join(' · '))}</option>`).join('')}
window.estimateProducerChanged228=function(){const pid=+$('#e228prod').value;const s=$('#e228plant');if(s)s.innerHTML='<option value="">Selecione</option>'+estimatePlantOptions228(pid)};
window.estimateForm228=function(programRef=''){
  X.gps=null;X.photos=[];load();
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Nova estimativa</h1><p>Funciona offline</p></div></div><div class="form-card">
      <label class="field"><span>Produtor *</span><select id="e228prod" onchange="estimateProducerChanged228()">${opts(D.produtores,'nome')}</select></label>
      <label class="field"><span>Plantio</span><select id="e228plant"><option value="">Selecione o produtor</option></select></label>
      <label class="field"><span>Data *</span><input id="e228date" type="date" value="${today()}"></label>
      <div class="fields-2"><label class="field"><span>Plantas amostradas</span><input id="e228plants" type="number" min="0" inputmode="numeric"></label><label class="field"><span>Inflorescência em antese</span><input id="e228antese" type="number" min="0" inputmode="numeric"></label></div>
      <div class="fields-2"><label class="field"><span>Inflorescência fecundada</span><input id="e228fec" type="number" min="0" inputmode="numeric"></label><label class="field"><span>Cachos verdes</span><input id="e228green" type="number" min="0" inputmode="numeric"></label></div>
      <div class="fields-2"><label class="field"><span>Cachos maduros</span><input id="e228mature" type="number" min="0" inputmode="numeric"></label><label class="field"><span>Abortamentos</span><input id="e228abort" type="number" min="0" inputmode="numeric"></label></div>
      <div id="e228gps" class="gps-box"><span class="gps-icon">⌖</span><div class="gps-info"><b>Localização da estimativa</b><small>Toque para capturar o GPS.</small></div><button class="btn secondary" onclick="native('requestLocation','estimate228')">Capturar GPS</button></div>
      <div class="photo-picker" style="margin-top:12px"><b>Fotos</b><div class="btn-row"><button class="btn primary" onclick="native('openCamera','estimate228')">📷 Tirar foto</button><button class="btn secondary" onclick="document.getElementById('e228files').click()">🖼 Galeria</button></div><input id="e228files" style="display:none" type="file" accept="image/*" multiple onchange="estimateGallery228(this.files)"><div id="e228grid" class="photo-grid"></div></div>
      <label class="field"><span>Observação</span><textarea id="e228obs"></textarea></label>
      <button class="btn primary full" onclick="saveEstimate228('${String(programRef).replace(/'/g,"\\'")}')">Salvar estimativa</button></div>`;
  });
};
window.estimateGallery228=async function(files){
  for(const f of [...files]){try{const data=await compress(f);const r=parse(native('savePhoto',data,f.name)||'{}',{});if(r.ok)X.photos.push({path:r.path,name:r.name,preview:data})}catch(_){toast('Não foi possível salvar uma foto.','bad')}}drawEstimatePhotos228();
};
function drawEstimatePhotos228(){const el=$('#e228grid');if(el)el.innerHTML=X.photos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="X.photos.splice(${i},1);drawEstimatePhotos228()">×</span></div>`).join('')}
window.drawEstimatePhotos228=drawEstimatePhotos228;
window.saveEstimate228=function(programRef=''){
  const pid=+$('#e228prod').value;if(!pid)return toast('Selecione o produtor.','warn');
  const prod=(D.produtores||[]).find(x=>+x.id===pid)||{},plid=+$('#e228plant').value||null,pl=(D.plantios||[]).find(x=>+x.id===plid)||{};
  const lat=X.gps?.latitude??(+pl.latitude||null),lng=X.gps?.longitude??(+pl.longitude||null);
  if(!validCoord228(+lat,+lng))return toast('Capture o GPS ou selecione um plantio com localização.','warn');
  const e={tipo_registro:'ESTIMATIVA',produtor_id:pid,produtor_nome:prod.nome||'',plantio_id:plid,ano_plantio:pl.ano_plantio||null,comunidade_id:pl.comunidade_id||null,comunidade_nome:pl.comunidade_nome||'',data_estimativa:$('#e228date').value||today(),plantas_amostradas:+$('#e228plants').value||0,inflorescencias_antese:+$('#e228antese').value||0,inflorescencias_fecundadas:+$('#e228fec').value||0,cachos_verdes:+$('#e228green').value||0,cachos_maduros:+$('#e228mature').value||0,abortamentos:+$('#e228abort').value||0,latitude:+lat,longitude:+lng,precisao_metros:X.gps?.accuracy||null,observacao_tecnico:$('#e228obs').value.trim(),capturado_em:now()};
  const payload={tipo_registro:'ESTIMATIVA',produtor_id:pid,plantio_id:plid,nome_produtor:prod.nome||'',cpf_produtor:prod.cpf||null,comunidade_id:e.comunidade_id,latitude:+lat,longitude:+lng,precisao_metros:e.precisao_metros,capturado_em:e.capturado_em,observacao:EST_PREFIX+JSON.stringify(e)};
  if(programRef.startsWith('server:'))payload.programacao_id=+programRef.slice(7);if(programRef.startsWith('local:'))payload.programacao_client_uuid=programRef.slice(6);
  const r=result(native('queueOperation','ponto.create',JSON.stringify(payload),JSON.stringify(X.photos.map(x=>({path:x.path,categoria:'ESTIMATIVA'})))),'Estimativa salva no aparelho.');
  if(r.ok){load();setTimeout(estimates228,220)}
};

window.agroLocationResult=function(tag,s){
  if(tag==='estimate228'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');X.gps=r;const el=$('#e228gps');if(el){el.classList.add('ready');el.querySelector('.gps-info').innerHTML=`<b>Localização capturada</b><small>${(+r.latitude).toFixed(6)}, ${(+r.longitude).toFixed(6)}${r.accuracy?' · ±'+Math.round(r.accuracy)+' m':''}</small>`}return;
  }
  if(tag==='map228'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');X.map.center={lat:+r.latitude,lng:+r.longitude};X.map.zoom=17;renderMap228();return;
  }
  if(typeof baseLocationResult==='function')baseLocationResult(tag,s);
};
window.agroCameraResult=function(tag,s){
  if(tag==='estimate228'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');X.photos.push({path:r.path,name:r.name,preview:r.preview||''});drawEstimatePhotos228();toast('Foto salva no aparelho.');return;
  }
  if(typeof baseCameraResult==='function')baseCameraResult(tag,s);
};

// ---------------- MAPA RÁPIDO ----------------
function validCoord228(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=85&&Math.abs(lng)<=180&&!(Math.abs(lat)<0.00001&&Math.abs(lng)<0.00001)}
function prodMap228(){return new Map((D.produtores||[]).map(p=>[+p.id,p]))}
function mineFilter228(x){const u=S.user||{};return +x.tecnico_usuario_id===+u.id||norm(x.tecnico_nome_base)===norm(u.nome)||norm(x.tecnico_nome)===norm(u.nome)}
function pointItems228(mode,producerId){
  const pm=prodMap228();let out=[];
  if(mode==='visits'||mode==='team'){
    out=(D.pontos||[]).filter(p=>mode==='team'||manager228()||+p.tecnico_id===+(S.user||{}).id).map(p=>({lat:+p.latitude,lng:+p.longitude,title:p.nome_produtor||'Ponto',sub:[p.comunidade_nome,p.tecnico_nome,brdt(p.capturado_em)].filter(Boolean).join(' · '),kind:'visit',id:+p.id||0}));
    for(const q of (Q||[]).filter(q=>q.type==='ponto.create'&&q.status!=='SYNCED')){const p=parse(q.payload_json,{});if(p.tipo_registro==='ESTIMATIVA')continue;out.push({lat:+p.latitude,lng:+p.longitude,title:p.nome_produtor||'Ponto local',sub:'Salvo no aparelho · aguardando sincronização',kind:'visit',local:true})}
  }else{
    let a=(D.plantios||[]).filter(x=>validCoord228(+x.latitude,+x.longitude));
    if(mode==='mine')a=a.filter(mineFilter228);
    if(mode==='producer')a=a.filter(x=>+x.produtor_id===+producerId);
    out=a.map(x=>{const p=pm.get(+x.produtor_id)||{};return {lat:+x.latitude,lng:+x.longitude,title:p.nome||'Produtor',sub:[p.cpf,x.comunidade_nome,x.tecnico_nome||x.tecnico_nome_base,x.ano_plantio].filter(Boolean).join(' · '),kind:'producer',producer_id:+x.produtor_id}});
  }
  return out.filter(p=>validCoord228(p.lat,p.lng));
}
function routes228(mode){
  const out=[],ses=D.sessoes||[],loc=D.localizacoes||[],u=S.user||{},ids=new Set();
  for(const s of ses){if(mode==='team'||manager228()||+s.usuario_id===+u.id)ids.add(+s.id)}
  const grouped={};
  for(const l of loc){if(!ids.has(+l.sessao_id)||!validCoord228(+l.latitude,+l.longitude))continue;(grouped[l.sessao_id]??=[]).push({lat:+l.latitude,lng:+l.longitude})}
  Object.entries(grouped).forEach(([id,points])=>out.push({id:'server-'+id,points,kind:'server'}));
  const local=parse(native('getLocalMapData')||'{}',{});
  for(const r of local.routes||[]){const pts=(r.points||[]).map(p=>({lat:+p.latitude,lng:+p.longitude})).filter(p=>validCoord228(p.lat,p.lng));if(pts.length)out.push({id:'local-'+r.uuid,points:pts,kind:'local',title:r.title||'Rota local'})}
  return out;
}
function world228(lat,lng,z){const scale=256*Math.pow(2,z),x=(lng+180)/360*scale,rad=Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180,y=(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*scale;return{x,y}}
function unworld228(x,y,z){const scale=256*Math.pow(2,z),lng=x/scale*360-180,n=Math.PI-2*Math.PI*y/scale,lat=180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n)));return{lat,lng}}
function quantile228(a,q){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),i=Math.max(0,Math.min(s.length-1,Math.floor((s.length-1)*q)));return s[i]}
function fit228(){
  const pts=[...X.map.items,...X.map.routes.flatMap(r=>r.points)];if(!pts.length)return;
  let use=pts;
  if(pts.length>30){const ml=quantile228(pts.map(p=>p.lat),.5),mg=quantile228(pts.map(p=>p.lng),.5);const near=pts.filter(p=>Math.abs(p.lat-ml)<6&&Math.abs(p.lng-mg)<6);if(near.length>pts.length*.75)use=near}
  const minLat=quantile228(use.map(p=>p.lat),use.length>20?.02:0),maxLat=quantile228(use.map(p=>p.lat),use.length>20?.98:1),minLng=quantile228(use.map(p=>p.lng),use.length>20?.02:0),maxLng=quantile228(use.map(p=>p.lng),use.length>20?.98:1);
  X.map.center={lat:(minLat+maxLat)/2,lng:(minLng+maxLng)/2};
  const box=$('#map228canvas')?.getBoundingClientRect(),w=Math.max(280,box?.width||600),h=Math.max(380,box?.height||600);
  let best=4;for(let z=18;z>=4;z--){const a=world228(maxLat,minLng,z),b=world228(minLat,maxLng,z);if(Math.abs(b.x-a.x)<=w*.82&&Math.abs(b.y-a.y)<=h*.78){best=z;break}}X.map.zoom=best;
}
function screen228(p,w,h){const c=world228(X.map.center.lat,X.map.center.lng,X.map.zoom),q=world228(p.lat,p.lng,X.map.zoom);return{x:w/2+(q.x-c.x),y:h/2+(q.y-c.y)}}
function renderTiles228(){
  const layer=$('#map228tiles'),box=$('#map228canvas');if(!layer||!box)return;layer.innerHTML='';if(!S.online)return;
  const r=box.getBoundingClientRect(),z=X.map.zoom,c=world228(X.map.center.lat,X.map.center.lng,z),left=c.x-r.width/2,top=c.y-r.height/2,tx0=Math.floor(left/256),ty0=Math.floor(top/256),tx1=Math.floor((left+r.width)/256),ty1=Math.floor((top+r.height)/256),max=Math.pow(2,z);
  let n=0;for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){if(n++>48)break;if(ty<0||ty>=max)continue;const xx=((tx%max)+max)%max,img=document.createElement('img');img.src=`https://tile.openstreetmap.org/${z}/${xx}/${ty}.png`;img.alt='';img.style.left=(tx*256-left)+'px';img.style.top=(ty*256-top)+'px';layer.appendChild(img)}
}
function draw228(){
  const c=$('#map228canvas');if(!c)return;const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,r.width,r.height);
  if(!S.online){x.fillStyle='#edf4ef';x.fillRect(0,0,r.width,r.height);x.strokeStyle='rgba(40,80,60,.08)';x.lineWidth=1;for(let i=0;i<r.width;i+=40){x.beginPath();x.moveTo(i,0);x.lineTo(i,r.height);x.stroke()}for(let j=0;j<r.height;j+=40){x.beginPath();x.moveTo(0,j);x.lineTo(r.width,j);x.stroke()}}
  for(const rr of X.map.routes){if(rr.points.length<2)continue;x.beginPath();rr.points.forEach((p,i)=>{const q=screen228(p,r.width,r.height);i?x.lineTo(q.x,q.y):x.moveTo(q.x,q.y)});x.strokeStyle='#2463eb';x.lineWidth=3.5;x.lineJoin='round';x.lineCap='round';x.stroke()}
  const items=X.map.items;for(const p of items){const q=screen228(p,r.width,r.height);if(q.x<-10||q.y<-10||q.x>r.width+10||q.y>r.height+10)continue;x.beginPath();x.arc(q.x,q.y,p.kind==='visit'?5.5:4.5,0,Math.PI*2);x.fillStyle=p.kind==='visit'?'#e47a12':'#0e6b45';x.fill();x.strokeStyle='#fff';x.lineWidth=2;x.stroke()}
}
function renderSelected228(){const el=$('#map228info'),p=X.map.selected;if(!el)return;el.innerHTML=p?`<div class="map228-info"><b>${esc(p.title||'Ponto')}</b><small>${esc(p.sub||'')}</small>${p.producer_id?`<button class="btn secondary" onclick="producerDetail228(${+p.producer_id})">Ver produtor</button>`:''}</div>`:`<div class="map228-hint">Toque em um ponto para ver as informações.</div>`}
function renderMap228(){renderTiles228();draw228();renderSelected228();const z=$('#map228zoom');if(z)z.textContent='Zoom '+X.map.zoom}
function selectAt228(x,y){const c=$('#map228canvas'),r=c.getBoundingClientRect();let best=null,bd=22;for(const p of X.map.items){const q=screen228(p,r.width,r.height),d=Math.hypot(q.x-x,q.y-y);if(d<bd){bd=d;best=p}}X.map.selected=best;renderSelected228()}
function bindMap228(){
  const c=$('#map228canvas');if(!c)return;c.style.touchAction='none';
  c.onpointerdown=e=>{X.map.drag=true;X.map.lastX=e.clientX;X.map.lastY=e.clientY;X.map.moved=0;c.setPointerCapture?.(e.pointerId)};
  c.onpointermove=e=>{if(!X.map.drag)return;const dx=e.clientX-X.map.lastX,dy=e.clientY-X.map.lastY;X.map.lastX=e.clientX;X.map.lastY=e.clientY;X.map.moved+=Math.abs(dx)+Math.abs(dy);const wc=world228(X.map.center.lat,X.map.center.lng,X.map.zoom),n=unworld228(wc.x-dx,wc.y-dy,X.map.zoom);X.map.center=n;draw228()};
  c.onpointerup=e=>{X.map.drag=false;if(X.map.moved<8){const r=c.getBoundingClientRect();selectAt228(e.clientX-r.left,e.clientY-r.top)}renderMap228()};
  c.onwheel=e=>{e.preventDefault();mapZoom228(e.deltaY<0?1:-1)};
  let pinchDist=0;c.ontouchstart=e=>{if(e.touches.length===2)pinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)};c.ontouchmove=e=>{if(e.touches.length!==2||!pinchDist)return;const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(d>pinchDist*1.22){pinchDist=d;mapZoom228(1)}else if(d<pinchDist*.78){pinchDist=d;mapZoom228(-1)}};
}
window.mapZoom228=function(d){X.map.zoom=Math.max(4,Math.min(19,X.map.zoom+d));renderMap228()};
window.mapFit228=function(){fit228();renderMap228()};
window.mapGps228=function(){native('requestLocation','map228')};
window.map228=function(mode='mine',producerId=0){
  load();X.map.mode=mode;X.map.items=mode==='routes'?[]:pointItems228(mode,producerId);X.map.routes=routes228(mode);X.map.selected=null;
  $('#screen').innerHTML=`<div class="map228-head"><div><h1>Mapa</h1><p>${X.map.items.length} ponto(s) · ${X.map.routes.length} rota(s)</p></div><button class="btn secondary" onclick="mapGps228()">⌖ Meu GPS</button></div>
    <div class="map228-tabs"><button class="${mode==='mine'?'active':''}" onclick="map228('mine')">Meus</button><button class="${mode==='all'?'active':''}" onclick="map228('all')">Todos</button><button class="${mode==='visits'?'active':''}" onclick="map228('visits')">Visitas</button><button class="${mode==='routes'?'active':''}" onclick="map228('routes')">Rotas</button>${manager228()?`<button class="${mode==='team'?'active':''}" onclick="map228('team')">Equipe</button>`:''}</div>
    <div class="map228-shell"><div id="map228tiles" class="map228-tiles"></div><canvas id="map228canvas"></canvas><div class="map228-controls"><button onclick="mapZoom228(1)">＋</button><button onclick="mapZoom228(-1)">−</button><button onclick="mapFit228()">⌗</button></div><div id="map228zoom" class="map228-zoom"></div><div class="map228-osm">© OpenStreetMap</div></div><div id="map228info"></div>`;
  setTimeout(()=>{fit228();bindMap228();renderMap228()},40);
};

// A aba Mapa passa a usar o mapa 2.2.8, mantendo o restante da 2.2.6.
map=function(mode='mine'){map228(mode)};

// Botão sincronizar continua sendo o único comando: envia e depois baixa.
try{syncBoth=syncNow}catch(e){}

})();