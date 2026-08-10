(function(){
'use strict';

// AgroDominium 2.2.9
// Preserva a base/fluxo da 2.2.8 e ajusta somente:
// - produtores: base geral + pesquisa;
// - estimativas: sem aprovação + tabela + pesquisa + sincronização pela base de pontos;
// - checklist de rotina: padrão, rápido e sem aprovação.

const prevHome229=home;
const prevAdd229=add;
const prevActivity229=activityDetail;
const prevChecklistReports229=checklistReports;
const prevLocationResult229=window.agroLocationResult;
const prevCameraResult229=window.agroCameraResult;

const EST_PREFIX229='ESTIMATIVA_JSON:';
const ROT_PREFIX229='CHECKLIST_ROTINA_JSON:';
const Y229={estGps:null,estPhotos:[],routineGps:null,routinePhotos:[],routineAnswers:{}};

function manager229(){
  return ['SUPERVISOR','GERENTE','DIRETOR','ADMIN','ADMINISTRADOR','ADMINISTRATOR'].includes(String((S.user||{}).perfil_codigo||'').toUpperCase());
}
function validCoord229(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=85&&Math.abs(lng)<=180&&!(Math.abs(lat)<.00001&&Math.abs(lng)<.00001)}
function safeJson229(s,f={}){try{return JSON.parse(s)}catch(_){return f}}
function producerName229(p){return p?.nome||p?.produtor_nome||p?.produtor||p?.nome_produtor||'Produtor'}
function producerLabel229(p){return [producerName229(p),p?.cpf].filter(Boolean).join(' · ')}

// ---------- PRODUTORES: TODOS DA BASE, SEM EDIÇÃO ----------
function allProducers229(){
  const map=new Map();
  for(const p of (D.produtores||[])){
    const id=+p.id||+p.produtor_id||0;if(!id)continue;
    map.set(id,{...p,id,nome:producerName229(p)});
  }
  for(const pl of (D.plantios||[])){
    const id=+pl.produtor_id||0;if(!id)continue;
    const old=map.get(id)||{};
    const nome=old.nome||pl.produtor_nome||pl.produtor||pl.nome_produtor||('Produtor '+id);
    map.set(id,{...old,id,nome,cpf:old.cpf||pl.cpf||'',cod_fornecedor:old.cod_fornecedor||pl.cod_fornecedor||pl.codigo||'',telefone:old.telefone||pl.telefone||'',cidade:old.cidade||pl.cidade||'',status_atual:old.status_atual||pl.status||''});
  }
  return [...map.values()].sort((a,b)=>producerName229(a).localeCompare(producerName229(b),'pt-BR',{sensitivity:'base'}));
}
function producerPlantings229(id){return (D.plantios||[]).filter(x=>+x.produtor_id===+id)}
function producerSearchText229(p){
  const pls=producerPlantings229(+p.id);
  return norm([p.nome,p.cpf,p.cod_fornecedor,p.codigo,p.telefone,p.cidade,p.status_atual,...pls.map(x=>[x.comunidade_nome,x.tecnico_nome,x.tecnico_nome_base,x.ano_plantio,x.polo_sigla,x.car].join(' '))].join(' '));
}
window.producers228=function(){
  load();
  open(()=>{
    const total=allProducers229().length;
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Produtores</h1><p>Base geral · ${total} produtor(es) · somente consulta</p></div></div>
      <div class="search producer-search229"><span>⌕</span><input id="p229q" type="search" autocomplete="off" placeholder="Pesquisar por nome, CPF, código, comunidade ou técnico" oninput="renderProducers228()"></div>
      <div id="p229count" class="result-count229"></div>
      <div id="p228list" class="list producer-list229"></div>`;
    renderProducers228();
    setTimeout(()=>$('#p229q')?.focus(),80);
  });
};
window.renderProducers228=function(){
  const q=norm($('#p229q')?.value||'');
  const all=allProducers229();
  const filtered=q?all.filter(p=>producerSearchText229(p).includes(q)):all;
  const limit=q?350:220,arr=filtered.slice(0,limit),count=$('#p229count');
  if(count)count.textContent=q?`${filtered.length} encontrado(s)`:`${all.length} produtor(es) disponíveis · digite para localizar rapidamente`;
  const el=$('#p228list');
  if(!el)return;
  if(!all.length){
    el.innerHTML=`<div class="card empty"><b>A base de produtores ainda não está disponível.</b><small>Toque em Sincronizar com internet para baixar a base geral.</small><button class="btn primary full" style="margin-top:12px" onclick="syncNow()">Sincronizar</button></div>`;
    return;
  }
  el.innerHTML=arr.map(p=>{
    const pl=producerPlantings229(+p.id),first=pl[0]||{};
    const sub=[p.cpf,p.cod_fornecedor||p.codigo,first.comunidade_nome,first.tecnico_nome||first.tecnico_nome_base].filter(Boolean).join(' · ');
    return `<button class="row-card row-button" onclick="producerDetail228(${+p.id})"><span class="dot"></span><div class="body"><b>${esc(p.nome||'Produtor')}</b><small>${esc(sub||'Cadastro da base geral')}</small></div><span class="badge">${pl.length?pl.length+' plantio(s)':'Ver'}</span></button>`;
  }).join('')+(filtered.length>limit?`<div class="card help-card229"><small>Existem mais ${filtered.length-limit} resultado(s). Refine a pesquisa pelo nome, CPF, comunidade ou técnico.</small></div>`:'');
};
window.producerDetail228=function(id){
  const p=allProducers229().find(x=>+x.id===+id);if(!p)return toast('Produtor não encontrado na base.','warn');
  const pls=producerPlantings229(id);
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>${esc(p.nome||'Produtor')}</h1><p>Cadastro da base geral · somente leitura</p></div></div>
      <div class="card detail-grid"><div><small>CPF</small><b>${esc(p.cpf||'—')}</b></div><div><small>Código fornecedor</small><b>${esc(p.cod_fornecedor||p.codigo||'—')}</b></div><div><small>Telefone</small><b>${esc(p.telefone||'—')}</b></div><div><small>Cidade</small><b>${esc(p.cidade||'—')}</b></div><div><small>Status</small><b>${esc(p.status_atual||p.status||'—')}</b></div><div><small>E-mail</small><b>${esc(p.email||'—')}</b></div></div>
      <div class="section-title"><h2>Plantios e localização</h2><small>${pls.length} registro(s)</small></div>
      <div class="list">${pls.map(x=>`<div class="card"><div class="planting-head229"><b>${x.ano_plantio?'Plantio '+esc(x.ano_plantio):'Plantio'}</b><span>${x.area_plantada_ha||x.area_ha?esc(x.area_plantada_ha||x.area_ha)+' ha':''}</span></div><p>${esc([x.comunidade_nome,x.polo_sigla,x.tecnico_nome||x.tecnico_nome_base].filter(Boolean).join(' · '))}</p>${x.car?`<small>CAR: ${esc(x.car)}</small>`:''}${validCoord229(+x.latitude,+x.longitude)?`<button class="btn secondary full" style="margin-top:10px" onclick="map228('producer',${+p.id})">Ver no mapa</button>`:''}</div>`).join('')||'<div class="card empty"><b>Sem plantios vinculados</b></div>'}</div>`;
  });
};

// ---------- ESTIMATIVA: SEM APROVAÇÃO, COM TABELA ----------
function estimateLocal229(){
  return (Q||[]).filter(q=>q.type==='ponto.create'&&q.status!=='SYNCED').map(q=>{
    const p=parse(q.payload_json,{});if(p.tipo_registro!=='ESTIMATIVA'&&!String(p.observacao||'').startsWith(EST_PREFIX229))return null;
    let e={};try{e=JSON.parse(String(p.observacao||'').slice(EST_PREFIX229.length))}catch(_){e=p}
    return {...e,_local:true,_queue:q,status_sync:'NO_APARELHO'};
  }).filter(Boolean);
}
function estimateServer229(){
  return (D.pontos||[]).map(p=>{
    const o=String(p.observacao||'');if(!o.startsWith(EST_PREFIX229))return null;
    try{return {...JSON.parse(o.slice(EST_PREFIX229.length)),id:p.id,_server:true,fotos:p.fotos||0,status_sync:'NA_BASE'}}catch(_){return null}
  }).filter(Boolean);
}
function estimateRows229(){
  const rows=[...estimateLocal229(),...estimateServer229()];
  return rows.sort((a,b)=>String(b.capturado_em||b.data_estimativa||'').localeCompare(String(a.capturado_em||a.data_estimativa||'')));
}
window.estimates228=function(){
  load();const rows=estimateRows229(),local=rows.filter(x=>x._local).length;
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Estimativas</h1><p>${rows.length-local} na base · ${local} aguardando sincronização · sem aprovação</p></div><button class="btn primary right" onclick="estimateForm228()">＋ Nova</button></div>
      <div class="info-box no-approval229"><div><b>Sem fluxo de aprovação</b><span>Ao sincronizar, a coleta sobe diretamente para a base.</span></div></div>
      <div class="search producer-search229" style="margin-top:12px"><span>⌕</span><input id="e229q" type="search" placeholder="Pesquisar produtor, comunidade ou ano" oninput="renderEstimateTable229()"></div>
      <div id="e229summary" class="result-count229"></div>
      <div class="data-table-wrap229"><table class="data-table229"><thead><tr><th>Data</th><th>Produtor</th><th>Plantio</th><th>Plantas</th><th>Antese</th><th>Fecundada</th><th>Verdes</th><th>Maduros</th><th>Abort.</th><th>GPS</th><th>Status</th></tr></thead><tbody id="e229body"></tbody></table></div>`;
    renderEstimateTable229();
  });
};
window.renderEstimateTable229=function(){
  const q=norm($('#e229q')?.value||'');let rows=estimateRows229();
  if(q)rows=rows.filter(e=>norm([e.produtor_nome,e.nome_produtor,e.comunidade_nome,e.ano_plantio,e.data_estimativa].join(' ')).includes(q));
  const s=$('#e229summary');if(s)s.textContent=`${rows.length} estimativa(s) encontrada(s)`;
  const b=$('#e229body');if(!b)return;
  b.innerHTML=rows.map(e=>`<tr><td>${br(e.data_estimativa||e.data)}</td><td class="name-cell229">${esc(e.produtor_nome||e.nome_produtor||'—')}</td><td>${esc(e.ano_plantio||'—')}</td><td>${+e.plantas_amostradas||0}</td><td>${+e.inflorescencias_antese||0}</td><td>${+e.inflorescencias_fecundadas||0}</td><td>${+e.cachos_verdes||0}</td><td>${+e.cachos_maduros||0}</td><td>${+e.abortamentos||0}</td><td>${validCoord229(+e.latitude,+e.longitude)?'✓':'—'}</td><td><span class="table-status229 ${e._local?'local':'base'}">${e._local?'No aparelho':'Na base'}</span></td></tr>`).join('')||'<tr><td colspan="11" class="table-empty229">Nenhuma estimativa registrada.</td></tr>';
};
function findProducer229(v){
  const q=norm(v);const all=allProducers229();
  return all.find(p=>norm(producerLabel229(p))===q)||all.find(p=>norm(p.nome)===q)||(()=>{const m=all.filter(p=>norm(p.nome).includes(q));return m.length===1?m[0]:null})();
}
function estimatePlantOptions229(pid){return producerPlantings229(pid).map(x=>`<option value="${x.id}">${esc([x.ano_plantio?('Plantio '+x.ano_plantio):'Plantio',x.comunidade_nome,(x.area_plantada_ha||x.area_ha)?((x.area_plantada_ha||x.area_ha)+' ha'):'' ].filter(Boolean).join(' · '))}</option>`).join('')}
window.estimateProducerSearch229=function(){
  const input=$('#e229prod'),p=findProducer229(input?.value||''),hidden=$('#e229pid'),plant=$('#e229plant'),hint=$('#e229prodHint');
  if(hidden)hidden.value=p?.id||'';
  if(plant)plant.innerHTML=p?'<option value="">Selecione</option>'+estimatePlantOptions229(+p.id):'<option value="">Selecione primeiro o produtor</option>';
  if(hint)hint.textContent=p?`${p.nome}${p.cpf?' · '+p.cpf:''}`:'Digite o nome e selecione um produtor da lista.';
};
window.estimateForm228=function(programRef=''){
  Y229.estGps=null;Y229.estPhotos=[];load();const all=allProducers229();
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Nova estimativa</h1><p>Sem aprovação · funciona offline</p></div></div>
      <div class="form-card"><div class="info-box no-approval229"><div><b>Vai direto para a base</b><span>Não depende de aprovação de supervisor ou gestor.</span></div></div>
      <label class="field"><span>Pesquisar produtor *</span><input id="e229prod" list="e229prodlist" autocomplete="off" placeholder="Digite o nome ou CPF" oninput="estimateProducerSearch229()"><datalist id="e229prodlist">${all.map(p=>`<option value="${esc(producerLabel229(p))}"></option>`).join('')}</datalist><input id="e229pid" type="hidden"><small id="e229prodHint" class="help">Digite o nome e selecione um produtor da lista.</small></label>
      <label class="field"><span>Plantio</span><select id="e229plant"><option value="">Selecione primeiro o produtor</option></select></label>
      <label class="field"><span>Data *</span><input id="e229date" type="date" value="${today()}"></label>
      <div class="fields-2"><label class="field"><span>Plantas amostradas</span><input id="e229plants" type="number" min="0" inputmode="numeric"></label><label class="field"><span>Inflorescência em antese</span><input id="e229antese" type="number" min="0" inputmode="numeric"></label></div>
      <div class="fields-2"><label class="field"><span>Inflorescência fecundada</span><input id="e229fec" type="number" min="0" inputmode="numeric"></label><label class="field"><span>Cachos verdes</span><input id="e229green" type="number" min="0" inputmode="numeric"></label></div>
      <div class="fields-2"><label class="field"><span>Cachos maduros</span><input id="e229mature" type="number" min="0" inputmode="numeric"></label><label class="field"><span>Abortamentos</span><input id="e229abort" type="number" min="0" inputmode="numeric"></label></div>
      <div id="e229gps" class="gps-box"><span class="gps-icon">⌖</span><div class="gps-info"><b>Localização da estimativa</b><small>Capturando GPS do aparelho…</small></div><button class="btn secondary" type="button" onclick="native('requestLocation','estimate229')">Atualizar GPS</button></div>
      <div class="photo-picker" style="margin-top:12px"><b>Fotos</b><p class="help">Ficam salvas no aparelho até a sincronização.</p><div class="btn-row"><button type="button" class="btn primary" onclick="native('openCamera','estimate229')">📷 Tirar foto</button><button type="button" class="btn secondary" onclick="document.getElementById('e229files').click()">🖼 Galeria</button></div><input id="e229files" style="display:none" type="file" accept="image/*" multiple onchange="estimateGallery229(this.files)"><div id="e229grid" class="photo-grid"></div></div>
      <label class="field"><span>Observação</span><textarea id="e229obs"></textarea></label>
      <button class="btn primary full" onclick="saveEstimate228('${String(programRef).replace(/'/g,"\\'")}')">Salvar estimativa</button></div>`;
    setTimeout(()=>native('requestLocation','estimate229'),220);
  });
};
window.estimateGallery229=async function(files){
  for(const f of [...files]){try{const data=await compress(f),r=parse(native('savePhoto',data,f.name)||'{}',{});if(r.ok)Y229.estPhotos.push({path:r.path,name:r.name,preview:data})}catch(_){toast('Não foi possível salvar uma foto.','bad')}}renderEstimatePhotos229();
};
function renderEstimatePhotos229(){const el=$('#e229grid');if(el)el.innerHTML=Y229.estPhotos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="removeEstimatePhoto229(${i})">×</span></div>`).join('')}
window.removeEstimatePhoto229=function(i){Y229.estPhotos.splice(i,1);renderEstimatePhotos229()};
window.saveEstimate228=function(programRef=''){
  let pid=+$('#e229pid')?.value||0,prod=allProducers229().find(x=>+x.id===pid);if(!prod){prod=findProducer229($('#e229prod')?.value||'');pid=+prod?.id||0}
  if(!pid||!prod)return toast('Selecione um produtor da base.','warn');
  const plid=+$('#e229plant')?.value||null,pl=(D.plantios||[]).find(x=>+x.id===+plid)||{};
  const lat=Y229.estGps?.latitude??(+pl.latitude||null),lng=Y229.estGps?.longitude??(+pl.longitude||null);
  if(!validCoord229(+lat,+lng))return toast('Capture o GPS ou selecione um plantio com localização.','warn');
  const e={tipo_registro:'ESTIMATIVA',produtor_id:pid,produtor_nome:prod.nome||'',plantio_id:plid,ano_plantio:pl.ano_plantio||null,comunidade_id:pl.comunidade_id||null,comunidade_nome:pl.comunidade_nome||'',data_estimativa:$('#e229date')?.value||today(),plantas_amostradas:+$('#e229plants')?.value||0,inflorescencias_antese:+$('#e229antese')?.value||0,inflorescencias_fecundadas:+$('#e229fec')?.value||0,cachos_verdes:+$('#e229green')?.value||0,cachos_maduros:+$('#e229mature')?.value||0,abortamentos:+$('#e229abort')?.value||0,latitude:+lat,longitude:+lng,precisao_metros:Y229.estGps?.accuracy||null,observacao_tecnico:$('#e229obs')?.value.trim()||'',capturado_em:now(),requer_aprovacao:false};
  const payload={tipo_registro:'ESTIMATIVA',produtor_id:pid,plantio_id:plid,nome_produtor:prod.nome||'',cpf_produtor:prod.cpf||null,comunidade_id:e.comunidade_id,latitude:+lat,longitude:+lng,precisao_metros:e.precisao_metros,capturado_em:e.capturado_em,observacao:EST_PREFIX229+JSON.stringify(e)};
  if(programRef.startsWith('server:'))payload.programacao_id=+programRef.slice(7);if(programRef.startsWith('local:'))payload.programacao_client_uuid=programRef.slice(6);
  const r=result(native('queueOperation','ponto.create',JSON.stringify(payload),JSON.stringify(Y229.estPhotos.map(x=>({path:x.path,categoria:'ESTIMATIVA'})))),'Estimativa salva. Sem aprovação; será enviada à base.');
  if(r.ok){load();setTimeout(estimates228,220)}
};

// ---------- CHECKLIST DE ROTINA: SEM APROVAÇÃO ----------
function routineLocal229(){
  return (Q||[]).filter(q=>q.type==='ponto.create'&&q.status!=='SYNCED').map(q=>{const p=parse(q.payload_json,{});if(p.tipo_registro!=='CHECKLIST_ROTINA'&&!String(p.observacao||'').startsWith(ROT_PREFIX229))return null;let e={};try{e=JSON.parse(String(p.observacao||'').slice(ROT_PREFIX229.length))}catch(_){e=p}return {...e,_local:true,_queue:q}}).filter(Boolean);
}
function routineServer229(){
  return (D.pontos||[]).map(p=>{const o=String(p.observacao||'');if(!o.startsWith(ROT_PREFIX229))return null;try{return {...JSON.parse(o.slice(ROT_PREFIX229.length)),id:p.id,_server:true,fotos:p.fotos||0}}catch(_){return null}}).filter(Boolean);
}
function routineRows229(){return [...routineLocal229(),...routineServer229()].sort((a,b)=>String(b.capturado_em||'').localeCompare(String(a.capturado_em||'')))}
window.routineChecklist229=function(){
  Y229.routineGps=null;Y229.routinePhotos=[];Y229.routineAnswers={};load();const items=D.checklist_veiculo_itens||[];
  open(()=>{
    $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Checklist de rotina</h1><p>Padrão · sem aprovação</p></div></div>
      <div class="form-card"><div class="info-box no-approval229"><div><b>Rotina operacional</b><span>Este checklist não vai para aprovação. Ao sincronizar, sobe direto para a base.</span></div></div>
      <label class="field"><span>Veículo *</span><select id="r229veh" onchange="routineVehicle229()">${opts(D.veiculos,'placa')}</select></label><div id="r229vehinfo" class="info-box"><small>Veículo</small><b>Selecione um veículo</b></div>
      <div class="fields-2"><label class="field"><span>Data *</span><input id="r229date" type="date" value="${today()}"></label><label class="field"><span>Hora</span><input id="r229time" type="time" value="${now().slice(11,16)}"></label></div>
      <label class="field"><span>Odômetro (km) *</span><input id="r229km" type="number" step="0.1" min="0"></label>
      <label class="field"><span>Comunidade</span><select id="r229com">${opts(D.comunidades,'nome')}</select></label>
      <div id="r229gps" class="gps-box"><span class="gps-icon">⌖</span><div class="gps-info"><b>Localização do checklist</b><small>Capturando GPS do aparelho…</small></div><button class="btn secondary" type="button" onclick="native('requestLocation','routine229')">Atualizar GPS</button></div></div>
      <div class="form-card"><h3>Itens de rotina</h3>${items.map(i=>`<div class="check-item"><b>${esc(i.nome||i.item||i.descricao)}</b><small>${esc(i.categoria||'')}</small><div class="choice"><button type="button" onclick="routineChoice229(${+i.id},'OK',this)">✓ OK</button><button type="button" onclick="routineChoice229(${+i.id},'ATENCAO',this)">! Atenção</button><button type="button" onclick="routineChoice229(${+i.id},'NA',this)">— N/A</button></div></div>`).join('')||'<p>Nenhum item padrão foi baixado. Sincronize a base com internet.</p>'}</div>
      <div class="form-card"><div class="photo-picker"><b>Fotos</b><p class="help">Opcional. As fotos também sobem direto para a base.</p><div class="btn-row"><button type="button" class="btn primary" onclick="native('openCamera','routine229')">📷 Tirar foto</button><button type="button" class="btn secondary" onclick="document.getElementById('r229files').click()">🖼 Galeria</button></div><input id="r229files" style="display:none" type="file" accept="image/*" multiple onchange="routineGallery229(this.files)"><div id="r229grid" class="photo-grid"></div></div><label class="field" style="margin-top:14px"><span>Observação</span><textarea id="r229obs"></textarea></label><button class="btn primary full" onclick="saveRoutine229()">Salvar checklist de rotina</button></div>`;
    setTimeout(()=>native('requestLocation','routine229'),220);
  });
};
window.routineVehicle229=function(){const v=(D.veiculos||[]).find(x=>+x.id===+$('#r229veh')?.value),el=$('#r229vehinfo');if(el)el.innerHTML=v?`<small>Veículo selecionado</small><b>${esc(v.placa||v.modelo||'Veículo')}</b><span>${esc([v.marca,v.modelo,v.responsavel_nome||v.proprietario_nome,v.responsavel_matricula].filter(Boolean).join(' · '))}</span>`:'<small>Veículo</small><b>Selecione um veículo</b>'};
window.routineChoice229=function(id,val,btn){Y229.routineAnswers[id]=val;btn.parentElement.querySelectorAll('button').forEach(x=>x.className='');btn.className='sel '+(val==='OK'?'ok':val==='ATENCAO'?'att':'na')};
window.routineGallery229=async function(files){for(const f of [...files]){try{const data=await compress(f),r=parse(native('savePhoto',data,f.name)||'{}',{});if(r.ok)Y229.routinePhotos.push({path:r.path,name:r.name,preview:data})}catch(_){toast('Não foi possível salvar uma foto.','bad')}}renderRoutinePhotos229()};
function renderRoutinePhotos229(){const el=$('#r229grid');if(el)el.innerHTML=Y229.routinePhotos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="removeRoutinePhoto229(${i})">×</span></div>`).join('')}
window.removeRoutinePhoto229=function(i){Y229.routinePhotos.splice(i,1);renderRoutinePhotos229()};
window.saveRoutine229=function(){
  const vid=+$('#r229veh')?.value||0,v=(D.veiculos||[]).find(x=>+x.id===vid)||{},km=+$('#r229km')?.value,items=D.checklist_veiculo_itens||[];
  if(!vid||!Number.isFinite(km))return toast('Informe o veículo e o odômetro.','warn');
  for(const i of items)if(i.obrigatorio&&!Y229.routineAnswers[i.id])return toast('Responda todos os itens obrigatórios.','warn');
  if(!Y229.routineGps||!validCoord229(+Y229.routineGps.latitude,+Y229.routineGps.longitude))return toast('Capture a localização pelo GPS.','warn');
  const cid=+$('#r229com')?.value||null,com=(D.comunidades||[]).find(x=>+x.id===+cid)||{},u=S.user||{};
  const e={tipo_registro:'CHECKLIST_ROTINA',tipo_checklist:'ROTINA',requer_aprovacao:false,veiculo_id:vid,placa:v.placa||'',veiculo_modelo:v.modelo||'',tecnico_id:+u.id||null,tecnico_nome:u.nome||'',tecnico_matricula:u.matricula||'',data:$('#r229date')?.value||today(),hora:$('#r229time')?.value||now().slice(11,16),odometro_km:km,comunidade_id:cid,comunidade_nome:com.nome||'',latitude:+Y229.routineGps.latitude,longitude:+Y229.routineGps.longitude,precisao_metros:Y229.routineGps.accuracy||null,respostas:items.filter(i=>Y229.routineAnswers[i.id]).map(i=>({item_id:+i.id,item:i.nome||i.item||i.descricao,resposta:Y229.routineAnswers[i.id],categoria:i.categoria||''})),observacao:$('#r229obs')?.value.trim()||'',capturado_em:now()};
  const payload={tipo_registro:'CHECKLIST_ROTINA',nome_produtor:'Checklist de rotina - '+(v.placa||v.modelo||'Veículo'),comunidade_id:cid,latitude:e.latitude,longitude:e.longitude,precisao_metros:e.precisao_metros,capturado_em:e.capturado_em,observacao:ROT_PREFIX229+JSON.stringify(e)};
  const r=result(native('queueOperation','ponto.create',JSON.stringify(payload),JSON.stringify(Y229.routinePhotos.map(x=>({path:x.path,categoria:'CHECKLIST_ROTINA'})))),'Checklist de rotina salvo. Não precisa aprovação.');
  if(r.ok){load();setTimeout(routineReports229,220)}
};
window.routineReports229=function(){
  load();const rows=routineRows229();
  open(()=>{$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Checklists de rotina</h1><p>${rows.length} registro(s) · sem aprovação</p></div><button class="btn primary right" onclick="routineChecklist229()">＋ Novo</button></div><div class="search producer-search229"><span>⌕</span><input id="r229q" type="search" placeholder="Buscar placa, técnico ou comunidade" oninput="renderRoutineReports229()"></div><div class="data-table-wrap229"><table class="data-table229 routine-table229"><thead><tr><th>Data/Hora</th><th>Veículo</th><th>Técnico</th><th>Odômetro</th><th>Comunidade</th><th>Atenções</th><th>Status</th></tr></thead><tbody id="r229body"></tbody></table></div>`;renderRoutineReports229()});
};
window.renderRoutineReports229=function(){const q=norm($('#r229q')?.value||'');let rows=routineRows229();if(q)rows=rows.filter(x=>norm([x.placa,x.veiculo_modelo,x.tecnico_nome,x.tecnico_matricula,x.comunidade_nome,x.observacao].join(' ')).includes(q));const b=$('#r229body');if(!b)return;b.innerHTML=rows.map(x=>{const at=(x.respostas||[]).filter(r=>String(r.resposta).toUpperCase()==='ATENCAO').length;return `<tr><td>${br(x.data)} ${esc(x.hora||'')}</td><td class="name-cell229">${esc(x.placa||x.veiculo_modelo||'—')}</td><td>${esc(x.tecnico_nome||'—')}</td><td>${Number.isFinite(+x.odometro_km)?esc(x.odometro_km)+' km':'—'}</td><td>${esc(x.comunidade_nome||'—')}</td><td>${at}</td><td><span class="table-status229 ${x._local?'local':'base'}">${x._local?'No aparelho':'Na base'}</span></td></tr>`}).join('')||'<tr><td colspan="7" class="table-empty229">Nenhum checklist de rotina.</td></tr>'};

// Hub claro para separar checklist com aprovação do checklist de rotina.
window.checklistHub229=function(){
  load();const rotina=routineRows229().length,uso=localChecklistItems().length;
  open(()=>{$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Checklists</h1><p>Escolha o tipo correto</p></div></div><div class="grid-2"><button class="action-card vehicle" onclick="vehicleForm()"><span class="ico">▰</span><strong>Uso / entrega</strong><small>Com aprovação · assinatura · odômetro</small></button><button class="action-card" onclick="routineChecklist229()"><span class="ico">✓</span><strong>Rotina</strong><small>Sem aprovação · padrão operacional</small></button><button class="action-card" onclick="usageReports229()"><span class="ico">▤</span><strong>Relatórios de uso</strong><small>${uso} registro(s)</small></button><button class="action-card" onclick="routineReports229()"><span class="ico">▤</span><strong>Relatórios de rotina</strong><small>${rotina} registro(s)</small></button></div>`});
};
window.usageReports229=function(){prevChecklistReports229()};
checklistReports=function(){checklistHub229()};

// ---------- GPS / CÂMERA DOS NOVOS FORMULÁRIOS ----------
window.agroLocationResult=function(tag,s){
  if(tag==='estimate229'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');Y229.estGps=r;const el=$('#e229gps');if(el){el.classList.add('ready');el.querySelector('.gps-info').innerHTML=`<b>Localização capturada</b><small>${(+r.latitude).toFixed(6)}, ${(+r.longitude).toFixed(6)}${r.accuracy?' · ±'+Math.round(r.accuracy)+' m':''}</small>`}return;
  }
  if(tag==='routine229'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');Y229.routineGps=r;const el=$('#r229gps');if(el){el.classList.add('ready');el.querySelector('.gps-info').innerHTML=`<b>Localização capturada</b><small>${(+r.latitude).toFixed(6)}, ${(+r.longitude).toFixed(6)}${r.accuracy?' · ±'+Math.round(r.accuracy)+' m':''}</small>`}return;
  }
  if(typeof prevLocationResult229==='function')prevLocationResult229(tag,s);
};
window.agroCameraResult=function(tag,s){
  if(tag==='estimate229'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');Y229.estPhotos.push({path:r.path,name:r.name,preview:r.preview||''});renderEstimatePhotos229();toast('Foto salva no aparelho.');return;
  }
  if(tag==='routine229'){
    const r=parse(s,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');Y229.routinePhotos.push({path:r.path,name:r.name,preview:r.preview||''});renderRoutinePhotos229();toast('Foto salva no aparelho.');return;
  }
  if(typeof prevCameraResult229==='function')prevCameraResult229(tag,s);
};

// ---------- AJUSTES DE NAVEGAÇÃO SEM RETIRAR NADA ----------
home=function(){
  prevHome229();
  setTimeout(()=>{
    const pb=document.querySelector('[data-v228="producer-home"] strong');if(pb)pb.textContent='Produtores';
    const ps=document.querySelector('[data-v228="producer-home"] small');if(ps)ps.textContent='Base geral · somente consulta';
    const eb=document.querySelector('[data-v228="estimate-home"] small');if(eb)eb.textContent='Sem aprovação · GPS + fotos';
    const grid=[...document.querySelectorAll('#screen .grid-2')][0];
    if(grid&&!document.querySelector('[data-v229="routine-home"]'))grid.insertAdjacentHTML('beforeend',`<button data-v229="routine-home" class="action-card" onclick="routineChecklist229()"><span class="ico">✓</span><span><strong>Checklist rotina</strong><small>Sem aprovação · padrão</small></span></button>`);
    const vb=[...document.querySelectorAll('#screen button')].find(b=>b.getAttribute('onclick')==='vehicleForm()');if(vb){const st=vb.querySelector('strong'),sm=vb.querySelector('small');if(st)st.textContent='Checklist de uso';if(sm)sm.textContent='Com aprovação · fotos + assinatura'}
  },30);
};
add=function(){
  prevAdd229();
  setTimeout(()=>{
    const grid=[...document.querySelectorAll('#screen .grid-2')][0];
    if(grid&&!document.querySelector('[data-v229="routine-add"]'))grid.insertAdjacentHTML('beforeend',`<button data-v229="routine-add" class="action-card" onclick="routineChecklist229()"><span class="ico">✓</span><strong>Checklist rotina</strong><small>Sem aprovação · padrão operacional</small></button>`);
    const pb=document.querySelector('[data-v228="producer-add"] strong');if(pb)pb.textContent='Pesquisar produtor';
    const ps=document.querySelector('[data-v228="producer-add"] small');if(ps)ps.textContent='Base geral · somente consulta';
    const eb=document.querySelector('[data-v228="estimate-add"] small');if(eb)eb.textContent='Sem aprovação · GPS + estrutura + fotos';
    const vb=[...document.querySelectorAll('#screen button')].find(b=>b.getAttribute('onclick')==='vehicleForm()');if(vb){const st=vb.querySelector('strong'),sm=vb.querySelector('small');if(st)st.textContent='Checklist de uso';if(sm)sm.textContent='Com aprovação · movimentação e assinatura'}
  },30);
};
activityDetail=function(ref){
  prevActivity229(ref);
  setTimeout(()=>{const e=document.querySelector('[data-v228="estimate-activity"] small');if(e)e.textContent='Sem aprovação · coleta vinculada à atividade'},30);
};

})();
