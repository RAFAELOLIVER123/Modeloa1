(function(){
'use strict';

// AgroDominium 2.2.7 — melhorias sem alterar a base estável da 2.2.6.
const A227={map:{mode:'mine',items:[],routes:[],polys:[],bounds:null,zoom:1,panX:0,panY:0,drag:false,lastX:0,lastY:0,view:null,selected:null},estimateGps:null,estimatePhotos:[]};

function admin227(){const r=String((S.user||{}).perfil_codigo||'').toUpperCase();return ['ADMIN','ADMINISTRADOR','ADMINISTRATOR','DIRETOR','GERENTE','SUPERVISOR'].includes(r)}
try{isManager=admin227}catch(e){}

function approvedProgram227(p){const s=String(p?.status||'').toUpperCase();return s.includes('APROV')||s==='EM_EXECUCAO'||s==='EM EXECUÇÃO'||s==='EM_EXECUÇÃO'}
function checklistForProgram227(p){
  const pid=+p?.id||0, cref=p?._local?p.client_uuid:'';
  let list=(D.checklists_veiculo||[]).filter(c=>(pid&&+c.programacao_id===pid)||(cref&&String(c.programacao_client_uuid||'')===String(cref)));
  if(list.length)return {...list[0],_local:false};
  const q=(Q||[]).find(x=>x.type==='vehicle_checklist.create'&&x.status!=='SYNCED'&&(()=>{const z=parse(x.payload_json,{});return (pid&&+z.programacao_id===pid)||(cref&&String(z.programacao_client_uuid||'')===String(cref))})());
  if(q){const z=parse(q.payload_json,{});return {...z,_local:true,status_aprovacao:'AGUARDANDO SINCRONIZAÇÃO',client_uuid:q.client_uuid}}
  return null;
}
function checklistApproved227(c){return !!c&&!c._local&&String(c.status_aprovacao||c.status||'').toUpperCase()==='APROVADO'}
function statusClass227(ok,pending){return ok?'flow-ok':pending?'flow-wait':'flow-lock'}
function activityFlow227(p){
  const progOk=approvedProgram227(p),c=checklistForProgram227(p),checkOk=checklistApproved227(c),pendingCheck=!!c&&!checkOk;
  return `<div class="flow-card">
    <div class="flow-title"><b>Fluxo da atividade</b><small>As próximas ações são liberadas por etapa.</small></div>
    <div class="flow-step ${statusClass227(progOk,!progOk)}"><span>1</span><div><b>Programação</b><small>${progOk?'Aprovada para execução':'Aguardando aprovação'}</small></div>${progOk?'<em>✓</em>':'<em>…</em>'}</div>
    <div class="flow-step ${statusClass227(checkOk,pendingCheck)}"><span>2</span><div><b>Checklist do veículo</b><small>${checkOk?'Aprovado':pendingCheck?'Aguardando aprovação':'Faça o checklist antes da atividade'}</small></div>${progOk&&!c?`<button onclick="activityChecklist227('${p._local?'local:'+p.client_uuid:'server:'+p.id}')">Criar</button>`:checkOk?'<em>✓</em>':pendingCheck?'<em>…</em>':'<em>🔒</em>'}</div>
    <div class="flow-step ${statusClass227(progOk&&checkOk,false)}"><span>3</span><div><b>Execução em campo</b><small>${progOk&&checkOk?'GPS, rota, pontos e estimativa liberados':'Libera após programação + checklist aprovados'}</small></div><em>${progOk&&checkOk?'✓':'🔒'}</em></div>
  </div>`;
}
window.activityChecklist227=function(ref){vehicleForm();setTimeout(()=>{const s=document.getElementById('vprog');if(s){s.value=ref;s.dispatchEvent(new Event('change'))}},120)};

// Fluxo da atividade mais claro.
try{
activityDetail=function(ref){
  const p=mergedPrograms().find(x=>(x._local?'local:'+x.client_uuid:'server:'+x.id)===ref);if(!p)return;
  open(()=>{
    const progOk=approvedProgram227(p),c=checklistForProgram227(p),checkOk=checklistApproved227(c),pts=(D.pontos||[]).filter(x=>+x.programacao_id===+p.id);
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>${esc(p.atividade_nome||p.atividade||'Atividade')}</h1><p>${br(p.data_programada)} · ${esc(p.status||'')}</p></div></div>
      <div class="card detail-grid"><div><small>Comunidade</small><b>${esc(p.comunidade_nome||'—')}</b></div><div><small>Horário</small><b>${esc(String(p.hora_inicio||'—').slice(0,5))} até ${esc(String(p.hora_fim||'—').slice(0,5))}</b></div><div><small>Veículo</small><b>${esc(p.placa||p.veiculo_modelo||'Não definido')}</b></div><div><small>Pontos</small><b>${pts.length}</b></div></div>
      ${activityFlow227(p)}
      ${progOk&&checkOk?`<div class="section-title"><h2>Executar</h2><small>Escolha o que vai fazer agora</small></div><div class="grid-2"><button class="action-card route" onclick="route('${ref}')"><span class="ico">➜</span><strong>Rota GPS</strong><small>Iniciar rastreamento</small></button><button class="action-card point" onclick="pointForm('${ref}')"><span class="ico">⌖</span><strong>Registrar ponto</strong><small>GPS + produtor + foto</small></button><button class="action-card estimate" onclick="estimateForm227('${ref}')"><span class="ico">◌</span><strong>Estimativa</strong><small>Coleta produtiva</small></button><button class="action-card" onclick="map227('routes')"><span class="ico">⌁</span><strong>Ver rota</strong><small>Mapa da execução</small></button></div>`:''}
      ${!progOk&&admin227()?`<div style="margin-top:12px"><button class="btn primary full" onclick="approvals()">Abrir aprovações</button></div>`:''}`;
  })
};
}catch(e){}

// Tela inicial mais objetiva.
try{
home=function(){
  load();const u=S.user||{},routeNow=parse(native('routeStatus')||'{}',{}),ps=todayPrograms();
  if(admin227()){
    const ap=(D.aprovacoes_programacoes||[]).length+(D.checklists_pendentes||[]).length,active=(D.sessoes||[]).filter(x=>String(x.status).toUpperCase()==='ATIVA').length;
    $('#screen').innerHTML=`<section class="hero compact-hero"><div><small>AgroDominium</small><h1>Gestão operacional</h1><p>${esc(group().nome||'Grupo')} · ${S.online?'online':'offline'}</p></div><button class="sync-pill" onclick="syncNow()">↻ Sincronizar</button></section>
      <div class="stats four"><div class="stat"><b>${(D.produtores||[]).length}</b><span>Produtores</span></div><div class="stat"><b>${active}</b><span>Em campo</span></div><div class="stat"><b>${ap}</b><span>Aprovações</span></div><div class="stat"><b>${pending()}</b><span>Pendentes</span></div></div>
      <div class="section-title"><h2>Gestão</h2></div><div class="grid-2"><button class="action-card pending" onclick="approvals()"><span class="ico">✓</span><strong>Aprovações</strong><small>Programações e checklists</small></button><button class="action-card route" onclick="map227('team')"><span class="ico">⌖</span><strong>Mapa operacional</strong><small>Pontos e rotas da equipe</small></button><button class="action-card" onclick="producers227()"><span class="ico">♧</span><strong>Produtores</strong><small>Consulta completa</small></button><button class="action-card estimate" onclick="estimates227()"><span class="ico">◌</span><strong>Estimativas</strong><small>Coletas de campo</small></button><button class="action-card vehicle" onclick="checklistReports()"><span class="ico">▰</span><strong>Veículos</strong><small>Checklists e movimentações</small></button><button class="action-card" onclick="teamField()"><span class="ico">◎</span><strong>Equipe em campo</strong><small>Atividade e GPS</small></button></div>`;
    return;
  }
  const first=ps[0];
  $('#screen').innerHTML=`<section class="hero compact-hero"><div><small>AgroDominium</small><h1>Olá, ${esc((u.nome||'Técnico').split(' ')[0])}</h1><p>${esc(group().nome||'Grupo')} · ${S.online?'online':'offline'}</p></div><button class="sync-pill" onclick="syncNow()">↻ Sincronizar</button></section>
    ${routeNow.active?routeCard(routeNow):''}
    <div class="section-title"><h2>Atividade de hoje</h2><button class="link-btn" onclick="nav('agenda')">Agenda</button></div>
    <div class="list">${ps.length?ps.slice(0,3).map(p=>row(p,`activityDetail('${p._local?'local:'+p.client_uuid:'server:'+p.id}')`)).join(''):'<div class="card empty"><b>Nenhuma atividade hoje</b><small>Crie uma nova programação quando necessário.</small></div>'}</div>
    <div class="section-title"><h2>Campo</h2><small>ações rápidas</small></div><div class="grid-2"><button class="action-card" onclick="programForm()"><span class="ico">＋</span><strong>Nova programação</strong><small>Solicitar atividade</small></button><button class="action-card" onclick="producers227()"><span class="ico">♧</span><strong>Meus produtores</strong><small>Somente consulta</small></button><button class="action-card estimate" onclick="estimates227()"><span class="ico">◌</span><strong>Estimativa</strong><small>Nova coleta</small></button><button class="action-card point" onclick="map227('mine')"><span class="ico">⌖</span><strong>Mapa</strong><small>Produtores, visitas e rotas</small></button></div>`;
};
}catch(e){}

// ---------- PRODUTORES: somente leitura ----------
function myPlantings227(){const u=S.user||{};let a=D.plantios||[];if(admin227())return a;return a.filter(x=>+x.tecnico_usuario_id===+u.id||norm(x.tecnico_nome_base)===norm(u.nome)||norm(x.tecnico_nome)===norm(u.nome))}
function visibleProducerIds227(){return new Set(myPlantings227().map(x=>+x.produtor_id))}
window.producers227=function(){
  load();open(()=>{$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>${admin227()?'Produtores':'Meus produtores'}</h1><p>Consulta cadastral — sem edição</p></div></div><div class="search"><input id="p227q" placeholder="Buscar nome, CPF, código ou comunidade" oninput="renderProducers227()"></div><div id="p227list" class="list" style="margin-top:12px"></div>`;renderProducers227()})
};
window.renderProducers227=function(){
  const q=norm($('#p227q')?.value||''),ids=visibleProducerIds227();let arr=(D.produtores||[]).filter(p=>admin227()||ids.has(+p.id));
  if(q)arr=arr.filter(p=>{const pls=(D.plantios||[]).filter(x=>+x.produtor_id===+p.id);return norm([p.nome,p.cpf,p.cod_fornecedor,p.telefone,p.cidade,...pls.map(x=>[x.comunidade_nome,x.tecnico_nome,x.tecnico_nome_base,x.ano_plantio].join(' '))].join(' ')).includes(q)});
  const el=$('#p227list');if(el)el.innerHTML=arr.slice(0,180).map(p=>`<button class="row-card row-button" onclick="producerDetail227(${+p.id})"><span class="dot"></span><div class="body"><b>${esc(p.nome||'Produtor')}</b><small>${esc([p.cpf,p.cod_fornecedor,p.cidade].filter(Boolean).join(' · '))}</small></div><span class="badge">Ver</span></button>`).join('')||'<div class="card empty"><b>Nenhum produtor encontrado</b></div>';
};
window.producerDetail227=function(id){
  const p=(D.produtores||[]).find(x=>+x.id===+id);if(!p)return;const pls=(D.plantios||[]).filter(x=>+x.produtor_id===+id);
  open(()=>{$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>${esc(p.nome||'Produtor')}</h1><p>Informações somente para consulta</p></div></div><div class="card detail-grid producer-detail"><div><small>CPF</small><b>${esc(p.cpf||'—')}</b></div><div><small>Código fornecedor</small><b>${esc(p.cod_fornecedor||p.codigo||'—')}</b></div><div><small>Telefone</small><b>${esc(p.telefone||'—')}</b></div><div><small>Cidade</small><b>${esc(p.cidade||'—')}</b></div><div><small>Status</small><b>${esc(p.status_atual||p.status||'—')}</b></div><div><small>E-mail</small><b>${esc(p.email||'—')}</b></div></div><div class="section-title"><h2>Plantios e localização</h2></div><div class="list">${pls.map(x=>`<div class="card planting-card"><div class="planting-head"><b>${x.ano_plantio?'Plantio '+esc(x.ano_plantio):'Plantio'}</b><span>${x.area_plantada_ha||x.area_ha?esc(x.area_plantada_ha||x.area_ha)+' ha':''}</span></div><p>${esc([x.comunidade_nome,x.polo_sigla,x.tecnico_nome||x.tecnico_nome_base].filter(Boolean).join(' · '))}</p><small>${x.car?'CAR: '+esc(x.car):''}</small>${Number.isFinite(+x.latitude)&&Number.isFinite(+x.longitude)?`<button class="btn secondary full" onclick="map227('producer',${+p.id})">Ver no mapa</button>`:''}</div>`).join('')||'<div class="card empty"><b>Sem plantios vinculados</b></div>'}</div>`})
};

// ---------- ESTIMATIVA OFFLINE ----------
function estimateQueue227(){return (Q||[]).filter(x=>x.type==='estimativa.create'&&x.status!=='SYNCED').map(x=>({...parse(x.payload_json,{}),_queue:x}))}
window.estimates227=function(){
  load();open(()=>{const server=D.estimativas||[],local=estimateQueue227();$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Estimativas</h1><p>Coleta de dendê em campo</p></div><button class="btn primary right" onclick="estimateForm227()">＋ Nova</button></div><div class="stats"><div class="stat"><b>${server.length}</b><span>Baixadas</span></div><div class="stat"><b>${local.length}</b><span>Pendentes</span></div><div class="stat"><b>${(D.produtores||[]).length}</b><span>Produtores</span></div></div><div class="list">${[...local,...server].slice(0,120).map(e=>`<div class="row-card"><span class="dot"></span><div class="body"><b>${esc(e.produtor_nome||e.nome_produtor||'Estimativa')}</b><small>${br(e.data_estimativa||e.data)} · ${esc(e.comunidade_nome||'')} ${e._queue?'· salva no aparelho':''}</small></div><span class="badge">${e._queue?'Pendente':'Salva'}</span></div>`).join('')||'<div class="card empty"><b>Nenhuma estimativa registrada</b></div>'}</div>`})
};
function estimateProducerOptions227(){const ids=visibleProducerIds227();return `<option value="">Selecione</option>`+(D.produtores||[]).filter(p=>admin227()||ids.has(+p.id)).map(p=>`<option value="${+p.id}">${esc(p.nome)}${p.cpf?' · '+esc(p.cpf):''}</option>`).join('')}
window.estimateForm227=function(programRef=''){
  A227.estimateGps=null;A227.estimatePhotos=[];open(()=>{$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Nova estimativa</h1><p>Salva no aparelho mesmo sem internet</p></div></div><div class="form-card"><label class="field"><span>Produtor *</span><select id="eProd" onchange="estimatePlantings227()">${estimateProducerOptions227()}</select></label><label class="field"><span>Plantio / ano</span><select id="ePlant"><option value="">Selecione o produtor</option></select></label><label class="field"><span>Data da estimativa *</span><input id="eDate" type="date" value="${today()}"></label><div class="fields-2"><label class="field"><span>Plantas amostradas</span><input id="ePlants" type="number" min="0"></label><label class="field"><span>Inflorescências em antese</span><input id="eAntese" type="number" min="0"></label><label class="field"><span>Inflorescências fecundadas</span><input id="eFec" type="number" min="0"></label><label class="field"><span>Cachos verdes</span><input id="eGreen" type="number" min="0"></label><label class="field"><span>Cachos maduros</span><input id="eMature" type="number" min="0"></label><label class="field"><span>Abortamentos</span><input id="eAbort" type="number" min="0"></label></div><div id="eGpsBox" class="gps-box"><span class="gps-icon">⌖</span><div class="gps-info"><b>Localização</b><small>Capture o GPS da estimativa</small></div><button class="btn secondary" onclick="captureEstimate227()">Capturar GPS</button></div><div class="photo-picker"><b>Fotos da estimativa</b><div class="btn-row"><button class="btn primary" type="button" onclick="native('openCamera','estimate')">📷 Tirar foto</button></div><div id="ePhotos" class="photo-grid"></div></div><label class="field"><span>Observação</span><textarea id="eObs" placeholder="Informações adicionais"></textarea></label><button class="btn primary full" onclick="saveEstimate227('${esc(programRef)}')">Salvar estimativa no aparelho</button></div>`})
};
window.estimatePlantings227=function(){const pid=+$('#eProd').value,arr=(D.plantios||[]).filter(x=>+x.produtor_id===pid),s=$('#ePlant');if(s)s.innerHTML='<option value="">Selecione</option>'+arr.map(x=>`<option value="${+x.id}">${esc([x.ano_plantio,x.comunidade_nome,x.area_plantada_ha||x.area_ha?String(x.area_plantada_ha||x.area_ha)+' ha':''].filter(Boolean).join(' · '))}</option>`).join('')};
window.captureEstimate227=function(){toast('Capturando GPS…');native('requestLocation','estimate')};
const oldLoc227=window.agroLocationResult;
window.agroLocationResult=function(tag,s){if(tag!=='estimate'){if(typeof oldLoc227==='function')return oldLoc227(tag,s);return}const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');A227.estimateGps=r;const b=$('#eGpsBox');if(b){b.classList.add('ready');b.querySelector('.gps-info').innerHTML=`<b>Localização capturada</b><small>${(+r.latitude).toFixed(6)}, ${(+r.longitude).toFixed(6)}${r.accuracy?' · ±'+Math.round(r.accuracy)+' m':''}</small>`}};
const oldCam227=window.agroCameraResult;
window.agroCameraResult=function(tag,s){if(tag!=='estimate'){if(typeof oldCam227==='function')return oldCam227(tag,s);return}const r=parse(s,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');A227.estimatePhotos.push({path:r.path,preview:r.preview||''});const el=$('#ePhotos');if(el)el.innerHTML=A227.estimatePhotos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="A227RemoveEstimatePhoto(${i})">×</span></div>`).join('')};
window.A227RemoveEstimatePhoto=function(i){A227.estimatePhotos.splice(i,1);const el=$('#ePhotos');if(el)el.innerHTML=A227.estimatePhotos.map((x,j)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="A227RemoveEstimatePhoto(${j})">×</span></div>`).join('')};
window.saveEstimate227=function(programRef=''){
  const pid=+$('#eProd').value;if(!pid)return toast('Selecione o produtor.','warn');const p=(D.produtores||[]).find(x=>+x.id===pid)||{},plid=+$('#ePlant').value||null,pl=(D.plantios||[]).find(x=>+x.id===plid)||{};
  const payload={produtor_id:pid,produtor_nome:p.nome||'',plantio_id:plid,ano_plantio:pl.ano_plantio||null,comunidade_id:pl.comunidade_id||null,comunidade_nome:pl.comunidade_nome||'',data_estimativa:$('#eDate').value||today(),plantas_amostradas:+$('#ePlants').value||0,inflorescencias_antese:+$('#eAntese').value||0,inflorescencias_fecundadas:+$('#eFec').value||0,cachos_verdes:+$('#eGreen').value||0,cachos_maduros:+$('#eMature').value||0,abortamentos:+$('#eAbort').value||0,latitude:A227.estimateGps?.latitude||null,longitude:A227.estimateGps?.longitude||null,precisao_metros:A227.estimateGps?.accuracy||null,observacao:$('#eObs').value.trim(),capturado_em:now()};
  if(programRef.startsWith('server:'))payload.programacao_id=+programRef.slice(7);if(programRef.startsWith('local:'))payload.programacao_client_uuid=programRef.slice(6);
  const r=result(native('queueOperation','estimativa.create',JSON.stringify(payload),JSON.stringify(A227.estimatePhotos.map(x=>({path:x.path,categoria:'ESTIMATIVA'})))),'Estimativa salva no aparelho.');if(r.ok){load();setTimeout(estimates227,250)}
};

// ---------- MAPA LEVE, SEM NOMES ATÉ TOCAR ----------
function merc227(lat,lng,z){const n=Math.pow(2,z)*256,cl=Math.max(-85.0511,Math.min(85.0511,+lat))*Math.PI/180;return{x:(+lng+180)/360*n,y:(1-Math.log(Math.tan(cl)+1/Math.cos(cl))/Math.PI)/2*n}}
function routeSegments227(){
  const out=[],sessions=new Map((D.sessoes||[]).map(s=>[String(s.id),s])),by=new Map();
  for(const p of D.localizacoes||[]){const k=String(p.sessao_id||'');if(!by.has(k))by.set(k,[]);by.get(k).push({lat:+p.latitude,lng:+p.longitude,time:p.capturado_em})}
  for(const [k,pts] of by){if(pts.length<2)continue;const s=sessions.get(k)||{};out.push({id:k,name:s.tecnico_nome||s.titulo||'Rota',sub:[s.tecnico_matricula,s.titulo,brdt(s.iniciado_em),s.status].filter(Boolean).join(' · '),points:pts.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)),userId:+s.usuario_id||0})}
  const loc=parse(native('getLocalMapData')||'{}',{});for(const r of loc.routes||[]){const pts=(r.points||[]).map(p=>({lat:+p.latitude,lng:+p.longitude,time:p.captured_at})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));if(pts.length>1)out.unshift({id:'local:'+r.uuid,name:r.title||'Minha rota',sub:[r.started_at,r.status].filter(Boolean).join(' · '),points:pts,userId:+(S.user||{}).id||0})}
  return out;
}
function mapPoints227(mode,producerId=0){
  const u=S.user||{},pm=new Map((D.produtores||[]).map(p=>[+p.id,p])),plants=D.plantios||[],items=[];
  if(mode==='visits'||mode==='team'){
    for(const x of D.pontos||[]){if(mode==='visits'&&!admin227()&&+x.tecnico_id!==+u.id)continue;const lat=+x.latitude,lng=+x.longitude;if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;items.push({kind:'visit',lat,lng,name:x.nome_produtor||'Visita',sub:[x.comunidade_nome,x.tecnico_nome,brdt(x.capturado_em)].filter(Boolean).join(' · '),producerId:+x.produtor_id||0,raw:x})}
    for(const q of Q.filter(x=>x.type==='ponto.create'&&x.status!=='SYNCED')){const p=parse(q.payload_json,{}),lat=+p.latitude,lng=+p.longitude;if(Number.isFinite(lat)&&Number.isFinite(lng))items.push({kind:'visit',lat,lng,name:p.nome_produtor||'Ponto local',sub:'Salvo no aparelho',producerId:+p.produtor_id||0,raw:p})}
    return items;
  }
  for(const x of plants){if(producerId&&+x.produtor_id!==+producerId)continue;if(mode==='mine'&&!admin227()&&!(+x.tecnico_usuario_id===+u.id||norm(x.tecnico_nome_base)===norm(u.nome)||norm(x.tecnico_nome)===norm(u.nome)))continue;const lat=+x.latitude,lng=+x.longitude;if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;const p=pm.get(+x.produtor_id)||{};items.push({kind:'producer',lat,lng,name:p.nome||'Produtor',sub:[p.cpf,x.comunidade_nome,x.tecnico_nome||x.tecnico_nome_base,x.ano_plantio?`Plantio ${x.ano_plantio}`:''].filter(Boolean).join(' · '),producerId:+x.produtor_id||0,raw:x})}
  return items;
}
function calcBounds227(items,routes){const a=[];items.forEach(x=>a.push(x));routes.forEach(r=>a.push(...r.points));if(!a.length)return{minLat:-3,maxLat:-1,minLng:-49,maxLng:-47};let minLat=90,maxLat=-90,minLng=180,maxLng=-180;for(const p of a){minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLng=Math.min(minLng,p.lng);maxLng=Math.max(maxLng,p.lng)}const lp=Math.max(.003,(maxLat-minLat)*.08),op=Math.max(.003,(maxLng-minLng)*.08);return{minLat:minLat-lp,maxLat:maxLat+lp,minLng:minLng-op,maxLng:maxLng+op}}
function chooseZ227(b,w,h){for(let z=18;z>=3;z--){const a=merc227(b.minLat,b.minLng,z),c=merc227(b.maxLat,b.maxLng,z),dx=Math.abs(c.x-a.x),dy=Math.abs(c.y-a.y);if(dx<=w*.92&&dy<=h*.92)return z}return 3}
function prepareView227(w,h){const m=A227.map,b=m.bounds,z=chooseZ227(b,w,h),nw=merc227(b.maxLat,b.minLng,z),se=merc227(b.minLat,b.maxLng,z),dx=Math.max(1,se.x-nw.x),dy=Math.max(1,se.y-nw.y),scale=Math.min((w-36)/dx,(h-36)/dy);m.view={z,cx:(nw.x+se.x)/2,cy:(nw.y+se.y)/2,scale,w,h}}
function proj227(p){const v=A227.map.view,w=v.w,h=v.h,z=v.z,q=merc227(p.lat,p.lng,z),m=A227.map;return{x:(q.x-v.cx)*v.scale*m.zoom+w/2+m.panX,y:(q.y-v.cy)*v.scale*m.zoom+h/2+m.panY}}
function baseTiles227(){const layer=$('#m227tiles'),c=$('#m227canvas'),m=A227.map;if(!layer||!c||!m.view)return;layer.innerHTML='';if(!S.online)return;const v=m.view,z=v.z,w=v.w,h=v.h,worldLeft=v.cx-(w/2)/v.scale,worldRight=v.cx+(w/2)/v.scale,worldTop=v.cy-(h/2)/v.scale,worldBottom=v.cy+(h/2)/v.scale,tx0=Math.floor(worldLeft/256)-1,tx1=Math.floor(worldRight/256)+1,ty0=Math.floor(worldTop/256)-1,ty1=Math.floor(worldBottom/256)+1,max=Math.pow(2,z)-1;let count=0;for(let ty=Math.max(0,ty0);ty<=Math.min(max,ty1);ty++)for(let tx=Math.max(0,tx0);tx<=Math.min(max,tx1);tx++){if(count++>=36)break;const img=document.createElement('img');img.src=`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;img.alt='';const x=(tx*256-v.cx)*v.scale+w/2,y=(ty*256-v.cy)*v.scale+h/2;img.style.cssText=`left:${x}px;top:${y}px;width:${256*v.scale+1}px;height:${256*v.scale+1}px`;layer.appendChild(img)}layer.style.transform=`translate(${m.panX}px,${m.panY}px) scale(${m.zoom})`;layer.style.transformOrigin='50% 50%'}
function drawMap227(){const c=$('#m227canvas'),m=A227.map;if(!c)return;const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);if(!m.view||Math.abs(m.view.w-r.width)>2||Math.abs(m.view.h-r.height)>2)prepareView227(r.width,r.height);baseTiles227();x.clearRect(0,0,r.width,r.height);if(!S.online){x.fillStyle='#edf4ef';x.fillRect(0,0,r.width,r.height);x.strokeStyle='rgba(30,70,55,.08)';for(let q=0;q<r.width;q+=45){x.beginPath();x.moveTo(q,0);x.lineTo(q,r.height);x.stroke()}for(let q=0;q<r.height;q+=45){x.beginPath();x.moveTo(0,q);x.lineTo(r.width,q);x.stroke()}}
  for(const ro of m.routes){const pts=ro.points.map(proj227);if(pts.length<2)continue;x.beginPath();x.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)x.lineTo(pts[i].x,pts[i].y);x.strokeStyle='#2563eb';x.lineWidth=3.2;x.lineCap='round';x.lineJoin='round';x.stroke()}
  const maxPoints=m.items.length>5000?5000:m.items.length;for(let i=0;i<maxPoints;i++){const it=m.items[i],p=proj227(it);if(p.x<-10||p.y<-10||p.x>r.width+10||p.y>r.height+10)continue;x.beginPath();x.arc(p.x,p.y,it.kind==='visit'?5.5:4.2,0,Math.PI*2);x.fillStyle=it.kind==='visit'?'#e57a16':'#0e6b45';x.fill();x.strokeStyle='#fff';x.lineWidth=1.5;x.stroke()}}
window.map227=function(mode='mine',producerId=0){
  load();tab='map';form=false;mapMode=mode;const m=A227.map;m.mode=mode;m.zoom=1;m.panX=0;m.panY=0;m.selected=null;let items=mapPoints227(mode,producerId),routes=routeSegments227();if(mode==='routes')items=[];if(mode==='mine'&&!admin227())routes=routes.filter(r=>!r.userId||+r.userId===+(S.user||{}).id);if(mode==='all')routes=[];if(mode==='visits')routes=[];m.items=items;m.routes=routes;m.bounds=calcBounds227(items,routes);m.view=null;
  $('#screen').innerHTML=`<div class="page-head map-head227"><div><h1>Mapa</h1><p>${items.length} ponto(s) · ${routes.length} rota(s)</p></div><button class="btn secondary right" onclick="mapLocate227()">⌖ Meu GPS</button></div><div class="map-tabs227"><button class="${mode==='mine'?'active':''}" onclick="map227('mine')">Meus</button><button class="${mode==='all'?'active':''}" onclick="map227('all')">Todos</button><button class="${mode==='visits'?'active':''}" onclick="map227('visits')">Visitas</button><button class="${mode==='routes'?'active':''}" onclick="map227('routes')">Rotas</button>${admin227()?`<button class="${mode==='team'?'active':''}" onclick="map227('team')">Equipe</button>`:''}</div><div class="map227"><div id="m227tiles" class="map227-tiles"></div><canvas id="m227canvas"></canvas><div class="map227-tools"><button onclick="zoom227(1.35)">＋</button><button onclick="zoom227(.74)">−</button><button onclick="fit227()">⌗</button></div><div id="m227info" class="map227-info hidden"></div><span class="map227-credit">${S.online?'© OpenStreetMap':'Mapa local offline'}</span></div><div class="map227-footer"><span><i class="p"></i> Produtor</span><span><i class="v"></i> Visita</span><span><i class="r"></i> Rota</span><small>Toque em um ponto para ver o nome.</small></div>`;
  setTimeout(()=>{initMap227();drawMap227()},40)
};
try{map=function(mode='mine'){map227(mode)}}catch(e){}
window.zoom227=function(f){A227.map.zoom=Math.max(.55,Math.min(8,A227.map.zoom*f));drawMap227()};window.fit227=function(){A227.map.zoom=1;A227.map.panX=0;A227.map.panY=0;A227.map.view=null;drawMap227()};window.mapLocate227=function(){toast('Capturando GPS…');native('requestLocation','map227')};
const oldLocMap227=window.agroLocationResult;window.agroLocationResult=function(tag,s){if(tag!=='map227'){if(typeof oldLocMap227==='function')return oldLocMap227(tag,s);return}const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');A227.map.items.unshift({kind:'current',lat:+r.latitude,lng:+r.longitude,name:'Minha localização',sub:r.accuracy?'Precisão ±'+Math.round(r.accuracy)+' m':'',producerId:0});A227.map.bounds=calcBounds227(A227.map.items,A227.map.routes);A227.map.view=null;drawMap227()};
function initMap227(){const c=$('#m227canvas');if(!c)return;c.addEventListener('pointerdown',e=>{A227.map.drag=true;A227.map.lastX=e.clientX;A227.map.lastY=e.clientY;c.setPointerCapture?.(e.pointerId)});c.addEventListener('pointermove',e=>{if(!A227.map.drag)return;A227.map.panX+=e.clientX-A227.map.lastX;A227.map.panY+=e.clientY-A227.map.lastY;A227.map.lastX=e.clientX;A227.map.lastY=e.clientY;drawMap227()});c.addEventListener('pointerup',e=>{A227.map.drag=false;c.releasePointerCapture?.(e.pointerId)});c.addEventListener('click',e=>{if(A227.map.drag)return;const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,dist=22;for(const it of A227.map.items){const p=proj227(it),d=Math.hypot(p.x-x,p.y-y);if(d<dist){dist=d;best=it}}const box=$('#m227info');if(!best){if(box)box.classList.add('hidden');return}if(box){box.classList.remove('hidden');box.innerHTML=`<button onclick="this.parentElement.classList.add('hidden')">×</button><b>${esc(best.name)}</b><small>${esc(best.sub||'')}</small><em>${best.lat.toFixed(6)}, ${best.lng.toFixed(6)}</em>${best.producerId?`<button class="btn primary full" onclick="producerDetail227(${best.producerId})">Ver produtor</button>`:''}`}})}

// Substitui atalhos antigos para usar o mapa novo e adiciona estimativa/produtores.
try{
add=function(){$('#screen').innerHTML=`<div class="page-head"><div><h1>Adicionar</h1><p>Escolha uma ação</p></div></div><div class="grid-2"><button class="action-card" onclick="programForm()"><span class="ico">＋</span><strong>Nova programação</strong><small>Solicitação de atividade</small></button><button class="action-card point" onclick="pointForm()"><span class="ico">⌖</span><strong>Ponto / produtor</strong><small>GPS + câmera</small></button><button class="action-card estimate" onclick="estimateForm227()"><span class="ico">◌</span><strong>Estimativa</strong><small>Coleta produtiva</small></button><button class="action-card" onclick="producers227()"><span class="ico">♧</span><strong>Produtores</strong><small>Somente consulta</small></button><button class="action-card route" onclick="route()"><span class="ico">➜</span><strong>Rota GPS</strong><small>Rastreamento offline</small></button><button class="action-card vehicle" onclick="vehicleForm()"><span class="ico">▰</span><strong>Checklist veículo</strong><small>Fotos + assinatura</small></button></div>`}
}catch(e){}

// Um único botão continua fazendo upload + download.
try{
const oldSyncResult227=window.agroSyncResult;window.agroSyncResult=function(s){if(typeof oldSyncResult227==='function')oldSyncResult227(s);load()};
}catch(e){}

})();