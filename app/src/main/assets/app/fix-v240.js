(function(){
'use strict';

// AgroDominium 2.4.1 — cadastros reais da estimativa + ficha 10% + reforço gestor/técnico.
const BRAND240='AgroDominium';
const E240={rows:[],photos:[],gps:null,draftUuid:'',plantioId:0,programRef:'',manualName:''};
const oldLoad240=load;
const oldHome240=home;
const oldVehicleOwner240=vehicleOwnerChanged;
const oldLocation240=window.agroLocationResult;
const oldCamera240=window.agroCameraResult;

const num240=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0};
const digits240=v=>String(v??'').replace(/\D+/g,'');
const role240=()=>String((S.user||{}).perfil_codigo||'').toUpperCase();
const manager240=()=>['SUPERVISOR','GERENTE','DIRETOR','ADMIN','ADMINISTRADOR','ADMINISTRATOR'].includes(role240());
const canCollectEstimate240=()=>['TECNICO','ADMIN','ADMINISTRADOR','ADMINISTRATOR'].includes(role240());
const html240=v=>esc(v??'');

function estimatePlantings240(){return Array.isArray(D.estimativa_plantios)?D.estimativa_plantios:[]}
function estimateSaved240(){return Array.isArray(D.estimativas)?D.estimativas:[]}
function estimateDrafts240(){return parse(native('getEstimateDrafts')||'[]',[])}
function estimatePending240(){return (Q||[]).filter(q=>q.type==='estimativa.save'&&q.status!=='SYNCED')}
function estimateLabel240(p){
  return [p.nome_produtor,p.cpf_cnpj,p.ano_plantio?('Plantio '+p.ano_plantio):'',p.comunidade,p.area_ha?num240(p.area_ha).toLocaleString('pt-BR',{maximumFractionDigits:3})+' ha':''].filter(Boolean).join(' · ');
}
function findEstimatePlant240(value){
  const q=norm(value||'');if(!q)return null;const a=estimatePlantings240();
  return a.find(p=>norm(estimateLabel240(p))===q)
      || a.find(p=>String(p.plantio_id)===String(value))
      || (()=>{const m=a.filter(p=>norm(p.nome_produtor||'')===q);return m.length===1?m[0]:null})()
      || (()=>{const m=a.filter(p=>norm(estimateLabel240(p)).includes(q));return m.length===1?m[0]:null})();
}
function resolveEstimatePlant240(producerId,plantingId){
  const a=estimatePlantings240();
  if(plantingId){
    const paf=(D.plantios||[]).find(x=>+x.id===+plantingId);
    const pp=(D.produtores||[]).find(x=>+x.id===+(paf?.produtor_id||producerId));
    if(paf||pp){
      const cpf=digits240(pp?.cpf),name=norm(pp?.nome||''),year=String(paf?.ano_plantio||'');
      const hit=a.find(x=>(cpf&&digits240(x.cpf_cnpj)===cpf||name&&norm(x.nome_produtor||'')===name)&&(!year||String(x.ano_plantio||'')===year));
      if(hit)return hit;
    }
  }
  if(producerId){
    const pp=(D.produtores||[]).find(x=>+x.id===+producerId);
    if(pp){
      const cpf=digits240(pp.cpf),name=norm(pp.nome||'');
      const matches=a.filter(x=>(cpf&&digits240(x.cpf_cnpj)===cpf)||(name&&norm(x.nome_produtor||'')===name));
      if(matches.length)return matches[0];
    }
  }
  return null;
}
function sampleTarget240(total){const n=Math.max(0,Math.round(num240(total)));return n>0?Math.max(1,Math.ceil(n*.10)):0}
function blankRow240(i){return{planta:i+1,linha:'',antese:'',fecunda:'',verde:'',maduro:'',observacao:''}}
function ensureRows240(count,exact=false){
  count=Math.max(0,Math.min(2000,Math.round(count||0)));
  while(E240.rows.length<count)E240.rows.push(blankRow240(E240.rows.length));
  if(exact&&E240.rows.length>count){
    const beyond=E240.rows.slice(count),has=beyond.some(r=>['linha','antese','fecunda','verde','maduro','observacao'].some(k=>r[k]!==''&&r[k]!=null));
    if(!has)E240.rows.length=count;
  }
  E240.rows.forEach((r,i)=>r.planta=i+1);
}
function selectedPlant240(){return estimatePlantings240().find(x=>+x.plantio_id===+E240.plantioId)||null}

load=function(){
  oldLoad240();
  const sub=document.getElementById('subtitle'),g=typeof group==='function'?group():{};
  if(sub)sub.textContent=[BRAND240,g?.nome].filter(Boolean).join(' · ');
};

function brand240(){
  const small=document.querySelector('.login-card>small');
  if(small)small.innerHTML='<b>AgroDominium</b><br><span style="font-weight:500;opacity:.72">Gestão operacional de campo</span>';
}
document.addEventListener('DOMContentLoaded',brand240);setTimeout(brand240,40);

window.estimates228=function(){
  load();const drafts=estimateDrafts240(),pend=estimatePending240(),server=estimateSaved240(),can=canCollectEstimate240();
  open(()=>{
    document.getElementById('screen').innerHTML=`<div class="page-head">${back()}<div><h1>Estimativa de produção</h1><p>${manager240()?'Visão de gestão e acompanhamento':'Coleta de campo · funciona offline'}</p></div>${can?'<button class="btn primary right" onclick="estimateForm228()">＋ Nova</button>':''}</div>
      <div class="estimate-kpis240"><div><b>${server.length}</b><span>Na base</span></div><div><b>${pend.length}</b><span>Aguardando sync</span></div><div><b>${drafts.length}</b><span>Rascunhos</span></div></div>
      ${can?`<div class="section-title"><h2>Rascunhos no aparelho</h2></div><div class="list">${drafts.map(d=>{const p=d.payload||{};return `<div class="row-card"><span class="dot"></span><div class="body"><b>${html240(p.produtor_nome_informado||'Estimativa')}</b><small>${br(p.data_levantamento)} · ${(p.plantas||[]).length} planta(s) na ficha</small></div><button class="btn sm secondary" onclick="estimateForm228('',0,0,'${html240(d.uuid)}')">Continuar</button></div>`}).join('')||'<div class="card empty"><b>Nenhum rascunho</b></div>'}</div>`:''}
      <div class="section-title"><h2>${manager240()?'Estimativas da equipe':'Estimativas sincronizadas'}</h2><small>${server.length}</small></div>
      <div class="search"><input id="estQ240" type="search" placeholder="Buscar produtor, técnico, comunidade ou ano" oninput="renderEstimateList240()"></div>
      <div id="estList240" class="list" style="margin-top:12px"></div>`;
    renderEstimateList240();
  });
};
window.renderEstimateList240=function(){
  const q=norm(document.getElementById('estQ240')?.value||'');let a=estimateSaved240();
  if(q)a=a.filter(x=>norm([x.nome_produtor,x.cpf_cnpj,x.tecnico_nome,x.comunidade,x.ano_plantio,x.status_levantamento].join(' ')).includes(q));
  const el=document.getElementById('estList240');if(!el)return;
  el.innerHTML=a.slice(0,300).map((x,i)=>`<button class="row-card row-button" onclick="estimateSummary240(${+x.id||0})"><span class="dot"></span><div class="body"><b>${html240(x.nome_produtor||'Estimativa')}</b><small>${br(x.data_levantamento)} · ${html240([x.ano_plantio?('Plantio '+x.ano_plantio):'',x.comunidade,x.tecnico_nome].filter(Boolean).join(' · '))}</small></div><span class="badge ${String(x.status_levantamento).toUpperCase()==='RASCUNHO'?'warn':''}">${html240(x.status_levantamento||'ENVIADA')}</span></button>`).join('')||'<div class="card empty"><b>Nenhuma estimativa encontrada</b></div>';
};
window.estimateSummary240=function(id){
  const x=estimateSaved240().find(r=>+r.id===+id);if(!x)return;
  open(()=>{document.getElementById('screen').innerHTML=`<div class="page-head">${back()}<div><h1>${html240(x.nome_produtor||'Estimativa')}</h1><p>${br(x.data_levantamento)} · ${html240(x.status_levantamento||'')}</p></div></div><div class="card detail-grid">
    <div><small>Técnico</small><b>${html240(x.tecnico_nome||'—')}</b></div><div><small>CPF</small><b>${html240(x.cpf_cnpj||'—')}</b></div>
    <div><small>Comunidade</small><b>${html240(x.comunidade||'—')}</b></div><div><small>Ano de plantio</small><b>${html240(x.ano_plantio||'—')}</b></div>
    <div><small>Área</small><b>${x.area_ha?num240(x.area_ha).toLocaleString('pt-BR',{maximumFractionDigits:3})+' ha':'—'}</b></div>
    <div><small>Amostra</small><b>${+x.numero_plantas_avaliadas||0}/${sampleTarget240(x.numero_plantas)}</b></div>
    <div><small>Antese</small><b>${+x.inflorescencias_antese||0}</b></div><div><small>Fecunda</small><b>${+x.inflorescencias_fecundadas||0}</b></div>
    <div><small>Verdes</small><b>${+x.cachos_verdes||0}</b></div><div><small>Maduros</small><b>${+x.cachos_maduros||0}</b></div>
  </div><div class="card" style="margin-top:12px"><p class="help">A ficha detalhada continua armazenada na plataforma; esta tela traz o resumo sincronizado para consulta no aplicativo.</p></div>`});
};

window.estimateForm228=function(programRef='',producerId=0,pafPlantingId=0,draftUuid=''){
  load();if(!canCollectEstimate240())return toast('Seu perfil possui acesso gerencial às estimativas.','warn');
  E240.rows=[];E240.photos=[];E240.gps=null;E240.draftUuid=draftUuid||'';E240.plantioId=0;E240.programRef=programRef||'';let d={};
  if(draftUuid){
    const z=estimateDrafts240().find(x=>x.uuid===draftUuid);if(z){d=z.payload||{};E240.rows=(d.plantas||[]).map((x,i)=>({...blankRow240(i),...x,planta:i+1}));E240.photos=(z.photos||[]).map(x=>typeof x==='string'?{path:x}:x);E240.plantioId=+d.plantio_id||0;if(d.latitude&&d.longitude)E240.gps={latitude:+d.latitude,longitude:+d.longitude,accuracy:num240(d.precisao_metros)||null,captured_at:d.gps_capturado_em||''};}
  }
  if(!E240.plantioId){const resolved=resolveEstimatePlant240(producerId,pafPlantingId);if(resolved)E240.plantioId=+resolved.plantio_id}
  const selected=selectedPlant240();
  const total=d.numero_plantas??selected?.numero_plantas??'',target=sampleTarget240(total);
  if(!E240.rows.length&&target)ensureRows240(target,true);
  open(()=>{
    const optsHtml=estimatePlantings240().map(p=>`<option value="${html240(estimateLabel240(p))}"></option>`).join('');
    document.getElementById('screen').innerHTML=`<div class="page-head">${back()}<div><h1>${draftUuid?'Continuar estimativa':'Nova estimativa'}</h1><p>Cadastro + amostragem automática de 10%</p></div></div>
      <div class="estimate-head240"><b>Ficha de campo</b><span>Ao selecionar o cadastro, área, estrutura, localização e quantidade da amostra são preenchidas automaticamente.</span></div>
      <div class="form-card">
        <label class="field"><span>Data do levantamento *</span><input id="estDate240" type="date" value="${html240(d.data_levantamento||today())}"></label>
        <label class="field"><span>Produtor / plantio</span><input id="estSearch240" list="estListData240" autocomplete="off" value="${html240(selected?estimateLabel240(selected):(d.produtor_nome_informado||''))}" placeholder="Digite nome, CPF ou comunidade" oninput="estSearchChanged240()"><datalist id="estListData240">${optsHtml}</datalist></label>
        <input id="estPlanting240" type="hidden" value="${E240.plantioId||''}">
        <div id="estCadastro240" class="estimate-register240"></div>
        <div class="fields-2"><label class="field"><span>CPF</span><input id="estCpf240" value="${html240(d.produtor_cpf_informado||selected?.cpf_cnpj||'')}"></label><label class="field"><span>Comunidade</span><input id="estComm240" value="${html240(d.comunidade_informada||selected?.comunidade||'')}"></label></div>
        <div class="fields-2"><label class="field"><span>Ano de plantio</span><input id="estYear240" type="number" min="1990" max="2100" value="${html240(d.ano_plantio_informado||selected?.ano_plantio||'')}"></label><label class="field"><span>Área (ha)</span><input id="estArea240" type="number" min="0" step="0.001" value="${html240(d.area_ha||selected?.area_ha||'')}"></label></div>
        <div class="fields-2"><label class="field"><span>Total de plantas *</span><input id="estTotal240" type="number" min="0" step="1" value="${html240(total)}" oninput="estTargetChanged240()"></label><label class="field"><span>Plantas produtivas</span><input id="estProductive240" type="number" min="0" step="1" value="${html240(d.numero_plantas_produtivas||selected?.numero_plantas_produtivas||total||'')}"></label></div>
        <div class="fields-2"><label class="field"><span>Amostra 10%</span><input id="estTarget240" readonly></label><label class="field"><span>Peso médio do cacho (kg)</span><input id="estWeight240" type="number" min="0" step="0.01" value="${html240(d.peso_medio_kg||'')}"></label></div>
        <div id="estGps240" class="gps-box estimate-gps240"><span class="gps-icon">⌖</span><div class="gps-info"><b>${E240.gps?'Localização disponível':'GPS do levantamento'}</b><small>${E240.gps?E240.gps.latitude.toFixed(6)+', '+E240.gps.longitude.toFixed(6):'Use a localização cadastrada ou capture o GPS.'}</small></div><button type="button" class="btn secondary" onclick="estCaptureGps240()">Capturar GPS</button></div>
      </div>
      <div id="estSummary240" class="estimate-summary240"></div>
      <div class="form-card sample-card240">
        <div class="sample-head240"><div><h3>Ficha ampliada</h3><p id="estProgress240">Selecione um produtor para calcular a amostra.</p></div><div class="btn-row"><button type="button" class="btn secondary" onclick="estAddRow240()">＋ Planta</button><button type="button" class="btn secondary" onclick="estZero240()">Zerar vazios</button></div></div>
        <div class="sample-scroll240"><table class="sample-table240"><thead><tr><th rowspan="2" class="plant-sticky240">PLANTA</th><th rowspan="2">LINHA</th><th colspan="2">INFLORESCÊNCIA</th><th colspan="2">CACHOS</th><th rowspan="2" class="obs-col240">OBSERVAÇÃO</th></tr><tr><th>ANTESE</th><th>FECUNDA</th><th>VERDE</th><th>MADURO</th></tr></thead><tbody id="estBody240"></tbody></table></div>
      </div>
      <div class="form-card"><div class="photo-picker"><b>Fotos do levantamento</b><p class="help">Ficam salvas no aparelho e sobem quando sincronizar.</p><div class="btn-row"><button type="button" class="btn primary" onclick="native('openCamera','estimate240')">📷 Tirar foto</button><button type="button" class="btn secondary" onclick="document.getElementById('estFiles240').click()">🖼 Galeria</button></div><input id="estFiles240" type="file" style="display:none" accept="image/*" multiple onchange="estGallery240(this.files)"><div id="estPhotoGrid240" class="photo-grid"></div></div>
        <label class="field" style="margin-top:14px"><span>Observações gerais</span><textarea id="estObs240">${html240(d.observacoes||'')}</textarea></label>
        <label class="field"><span>Justificativa para envio incompleto</span><textarea id="estJust240" placeholder="Obrigatória somente quando houver dados pendentes.">${html240(d.justificativa_incompleta||'')}</textarea></label>
        <div class="estimate-actions240"><button type="button" class="btn secondary" onclick="saveEstimateDraft240()">Salvar rascunho</button><button type="button" class="btn primary" onclick="sendEstimate240()">Enviar estimativa</button></div>
      </div>`;
    if(selected)applyPlant240(selected,false);else renderCadastro240(null);
    syncTarget240(false);renderRows240();renderEstimatePhotos240();updateEstimate240();
  });
};

window.estSearchChanged240=function(){
  const value=document.getElementById('estSearch240')?.value||'',p=findEstimatePlant240(value);
  if(p){E240.plantioId=+p.plantio_id;document.getElementById('estPlanting240').value=String(p.plantio_id);applyPlant240(p,true);}
  else{E240.plantioId=0;if(document.getElementById('estPlanting240'))document.getElementById('estPlanting240').value='';renderCadastro240(null);}
};
function applyPlant240(p,resetRows=true){
  if(!p)return;E240.plantioId=+p.plantio_id;
  const s=document.getElementById('estSearch240');if(s)s.value=estimateLabel240(p);
  document.getElementById('estPlanting240').value=String(p.plantio_id);
  document.getElementById('estCpf240').value=p.cpf_cnpj||'';
  document.getElementById('estComm240').value=p.comunidade||'';
  document.getElementById('estYear240').value=p.ano_plantio||'';
  document.getElementById('estArea240').value=num240(p.area_ha)||'';
  document.getElementById('estTotal240').value=Math.round(num240(p.numero_plantas))||'';
  document.getElementById('estProductive240').value=Math.round(num240(p.numero_plantas_produtivas||p.numero_plantas))||'';
  if(p.latitude&&p.longitude&&!E240.gps){E240.gps={latitude:+p.latitude,longitude:+p.longitude,accuracy:null,captured_at:'',source:'cadastro'};renderEstimateGps240();}
  renderCadastro240(p);const target=sampleTarget240(p.numero_plantas);if(resetRows){E240.rows=[];ensureRows240(target,true)}else ensureRows240(Math.max(target,E240.rows.length),false);renderRows240();syncTarget240(false);updateEstimate240();
}
function renderCadastro240(p){
  const el=document.getElementById('estCadastro240');if(!el)return;
  if(!p){el.innerHTML='<div class="estimate-register-empty240"><b>Cadastro não selecionado</b><span>Você pode continuar manualmente, mas selecionar o cadastro evita digitação e usa a estrutura oficial.</span></div>';return}
  el.innerHTML=`<div><small>Produtor</small><b>${html240(p.nome_produtor||'—')}</b></div><div><small>Propriedade</small><b>${html240(p.nome_propriedade||'—')}</b></div><div><small>Município</small><b>${html240(p.municipio||'—')}</b></div><div><small>Comunidade</small><b>${html240(p.comunidade||'—')}</b></div><div><small>Plantio</small><b>${html240(p.ano_plantio||'—')}</b></div><div><small>Estrutura</small><b>${Math.round(num240(p.numero_plantas)).toLocaleString('pt-BR')} plantas</b></div>`;
}
window.estTargetChanged240=function(){syncTarget240(true);renderCadastro240(selectedPlant240());updateEstimate240()};
function syncTarget240(adjust=true){
  const total=Math.max(0,Math.round(num240(document.getElementById('estTotal240')?.value))),target=sampleTarget240(total),t=document.getElementById('estTarget240');
  if(t)t.value=target?target+' plantas':'Informe o total';
  if(adjust){ensureRows240(target,true);renderRows240();}
  const p=document.getElementById('estProgress240');if(p){const c=calcEstimate240();p.innerHTML=target?`Amostra de 10%: <b>${c.filled}</b> de <b>${target}</b> plantas preenchidas. Total: <b>${total.toLocaleString('pt-BR')}</b>.`:'Informe o total de plantas para montar a amostra.'}
}
window.estAddRow240=function(){ensureRows240(E240.rows.length+1,false);renderRows240();updateEstimate240()};
window.estRemoveRow240=function(i){if(i<0||i>=E240.rows.length)return;E240.rows.splice(i,1);E240.rows.forEach((r,j)=>r.planta=j+1);renderRows240();updateEstimate240()};
window.estZero240=function(){E240.rows.forEach(r=>['antese','fecunda','verde','maduro'].forEach(k=>{if(r[k]===''||r[k]==null)r[k]=0}));renderRows240();updateEstimate240()};
window.estRow240=function(i,k,v){if(!E240.rows[i])return;E240.rows[i][k]=v;updateEstimate240()};
function renderRows240(){
  const body=document.getElementById('estBody240');if(!body)return;
  body.innerHTML=E240.rows.map((r,i)=>`<tr><th class="plant-sticky240">${String(i+1).padStart(2,'0')}</th><td><input type="number" min="0" step="1" inputmode="numeric" value="${html240(r.linha??'')}" oninput="estRow240(${i},'linha',this.value)"></td><td><input type="number" min="0" step="1" inputmode="numeric" value="${html240(r.antese??'')}" oninput="estRow240(${i},'antese',this.value)"></td><td><input type="number" min="0" step="1" inputmode="numeric" value="${html240(r.fecunda??'')}" oninput="estRow240(${i},'fecunda',this.value)"></td><td><input type="number" min="0" step="1" inputmode="numeric" value="${html240(r.verde??'')}" oninput="estRow240(${i},'verde',this.value)"></td><td><input type="number" min="0" step="1" inputmode="numeric" value="${html240(r.maduro??'')}" oninput="estRow240(${i},'maduro',this.value)"></td><td class="obs-cell240"><input type="text" maxlength="255" value="${html240(r.observacao??'')}" oninput="estRow240(${i},'observacao',this.value)"><button type="button" class="row-delete240" onclick="estRemoveRow240(${i})">×</button></td></tr>`).join('');
}
function calcEstimate240(){
  let antese=0,fecunda=0,verde=0,maduro=0,filled=0;
  for(const r of E240.rows){if(['antese','fecunda','verde','maduro'].some(k=>r[k]!==''&&r[k]!=null))filled++;antese+=num240(r.antese);fecunda+=num240(r.fecunda);verde+=num240(r.verde);maduro+=num240(r.maduro);}
  const total=Math.max(0,Math.round(num240(document.getElementById('estTotal240')?.value))),target=sampleTarget240(total);return{antese,fecunda,verde,maduro,filled,total,target};
}
function updateEstimate240(){
  const c=calcEstimate240(),el=document.getElementById('estSummary240');if(el)el.innerHTML=`<div><small>Antese</small><b>${c.antese}</b></div><div><small>Fecunda</small><b>${c.fecunda}</b></div><div><small>Verdes</small><b>${c.verde}</b></div><div><small>Maduros</small><b>${c.maduro}</b></div><div><small>Amostra</small><b>${c.filled}/${c.target||0}</b></div>`;
  const p=document.getElementById('estProgress240');if(p)p.innerHTML=c.target?`Amostra de 10%: <b>${c.filled}</b> de <b>${c.target}</b> plantas preenchidas. Total: <b>${c.total.toLocaleString('pt-BR')}</b>.`:'Informe o total de plantas para montar a amostra.';
}
window.estCaptureGps240=function(){toast('Capturando GPS…');native('requestLocation','estimate240')};
function renderEstimateGps240(){const el=document.getElementById('estGps240');if(!el||!E240.gps)return;el.classList.add('ready');el.querySelector('.gps-info').innerHTML=`<b>${E240.gps.source==='cadastro'?'Localização do cadastro':'Localização capturada'}</b><small>${E240.gps.latitude.toFixed(6)}, ${E240.gps.longitude.toFixed(6)}${E240.gps.accuracy?' · ±'+Math.round(E240.gps.accuracy)+' m':''}</small>`}
window.agroLocationResult=function(tag,payload){
  if(tag==='estimate240'){const r=parse(payload,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');E240.gps={latitude:+r.latitude,longitude:+r.longitude,accuracy:+r.accuracy||null,captured_at:r.timestamp||now(),source:'gps'};renderEstimateGps240();return toast('GPS capturado.')}
  if(typeof oldLocation240==='function')return oldLocation240(tag,payload);
};
window.agroCameraResult=function(tag,payload){
  if(tag==='estimate240'){const r=parse(payload,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');E240.photos.push({path:r.path,name:r.name,preview:r.preview||''});renderEstimatePhotos240();return}
  if(typeof oldCamera240==='function')return oldCamera240(tag,payload);
};
window.estGallery240=async function(files){for(const f of [...files]){try{const data=await compress(f),r=parse(native('savePhoto',data,f.name)||'{}',{});if(r.ok)E240.photos.push({path:r.path,name:r.name,preview:data})}catch(_){toast('Não foi possível processar uma foto.','bad')}}renderEstimatePhotos240()};
window.estRemovePhoto240=function(i){E240.photos.splice(i,1);renderEstimatePhotos240()};
function renderEstimatePhotos240(){const el=document.getElementById('estPhotoGrid240');if(el)el.innerHTML=E240.photos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="estRemovePhoto240(${i})">×</span></div>`).join('')}

function estimatePayload240(mode){
  const p=selectedPlant240(),manual=(document.getElementById('estSearch240')?.value||'').trim();
  return{
    id:0,plantio_id:p?+p.plantio_id:null,produtor_id:p?+p.produtor_id:null,tecnico_id:null,
    data_levantamento:document.getElementById('estDate240')?.value||today(),peso_medio_kg:num240(document.getElementById('estWeight240')?.value),percentual_perdas:0,
    observacoes:document.getElementById('estObs240')?.value||'',justificativa_incompleta:(document.getElementById('estJust240')?.value||'').trim(),modo_salvamento:mode,
    produtor_nome_informado:p?.nome_produtor||manual,produtor_cpf_informado:p?.cpf_cnpj||(document.getElementById('estCpf240')?.value||'').trim(),
    comunidade_informada:p?.comunidade||(document.getElementById('estComm240')?.value||'').trim(),ano_plantio_informado:num240(p?.ano_plantio||document.getElementById('estYear240')?.value)||null,
    numero_plantas:Math.round(num240(document.getElementById('estTotal240')?.value)),numero_plantas_produtivas:Math.round(num240(document.getElementById('estProductive240')?.value)),
    area_ha:num240(document.getElementById('estArea240')?.value),latitude:E240.gps?.latitude??'',longitude:E240.gps?.longitude??'',precisao_metros:E240.gps?.accuracy??'',gps_capturado_em:E240.gps?.captured_at||'',
    programacao_ref:E240.programRef||'',plantas:E240.rows.map((r,i)=>({planta:i+1,linha:r.linha===''?null:num240(r.linha),antese:r.antese,fecunda:r.fecunda,verde:r.verde,maduro:r.maduro,observacao:r.observacao||''}))
  };
}
function estimateMissing240(p){
  const c=calcEstimate240(),r=[];if(!p.numero_plantas)r.push('total de plantas');if(!p.area_ha)r.push('área');if(!p.peso_medio_kg)r.push('peso médio');if(!c.filled)r.push('amostra');if(c.target&&c.filled<c.target)r.push('amostra abaixo de 10%');
  const used=E240.rows.filter(x=>['linha','antese','fecunda','verde','maduro','observacao'].some(k=>x[k]!==''&&x[k]!=null));if(used.some(x=>['antese','fecunda','verde','maduro'].some(k=>x[k]===''||x[k]==null)))r.push('campos da ficha em branco');return r;
}
window.saveEstimateDraft240=function(){const p=estimatePayload240('RASCUNHO'),f=JSON.stringify(E240.photos.map(x=>({path:x.path,name:x.name||''}))),r=result(native('saveEstimateDraft',E240.draftUuid,JSON.stringify(p),f),'Rascunho salvo no aparelho.');if(r.ok){E240.draftUuid=r.uuid||E240.draftUuid;setTimeout(estimates228,140)}};
window.sendEstimate240=function(){const p=estimatePayload240('ENVIAR');if(!p.produtor_nome_informado)return toast('Informe ou selecione o produtor.','warn');const missing=estimateMissing240(p);if(missing.length&&!p.justificativa_incompleta){toast('A coleta está incompleta. Informe a justificativa antes de enviar.','warn');document.getElementById('estJust240')?.focus();return}const f=JSON.stringify(E240.photos.map(x=>({path:x.path,name:x.name||'',categoria:'ESTIMATIVA'}))),r=result(native('queueOperation','estimativa.save',JSON.stringify(p),f),S.online?'Estimativa preparada para envio.':'Estimativa salva no aparelho.');if(r.ok){if(E240.draftUuid)native('deleteEstimateDraft',E240.draftUuid);load();native('scheduleAutoSync');setTimeout(estimates228,160)}};

vehicleOwnerChanged=function(){
  oldVehicleOwner240();
  setTimeout(()=>{const v=(D.veiculos||[]).find(x=>+x.id===+(document.getElementById('vv')?.value||0));const box=[...document.querySelectorAll('#screen h3')].find(h=>/Itens de segurança/i.test(h.textContent||''))?.parentElement;if(v&&box){const type=String(v.tipo||'VEÍCULO').toUpperCase();const count=box.querySelectorAll('.check-item').length;let tag=box.querySelector('.vehicle-filter-note240');if(!tag){tag=document.createElement('div');tag.className='vehicle-filter-note240';box.prepend(tag)}tag.innerHTML=`<b>${html240(type)}</b><span>${count} item(ns) compatível(is) do cadastro. Itens do outro tipo não são exibidos.</span>`}},20);
};

home=function(){
  oldHome240();
  setTimeout(()=>{
    const grid=[...document.querySelectorAll('#screen .grid-2')][0];if(!grid)return;
    if(!document.querySelector('[data-v240="estimate"]'))grid.insertAdjacentHTML('beforeend',`<button data-v240="estimate" class="action-card" onclick="estimates228()"><span class="ico">▦</span><span><strong>Estimativas</strong><small>${manager240()?'Acompanhar equipe':'Ficha 10% + cadastro'}</small></span></button>`);
    if(manager240()&&!document.querySelector('[data-v240="approval"]'))grid.insertAdjacentHTML('beforeend',`<button data-v240="approval" class="action-card pending" onclick="approvals()"><span class="ico">✓</span><span><strong>Central de aprovações</strong><small>Programações · checklists · manutenção</small></span></button>`);
  },70);
};

try{const oldQ240=queueName;queueName=t=>t==='estimativa.save'?'Estimativa de produção':t==='maintenance.request'?'Solicitação de manutenção':t==='maintenance.decision'?'Decisão da manutenção':t==='chat.message'?'Mensagem do chat':t==='chat.conversation'?'Conversa do chat':oldQ240(t)}catch(_){}

})();
