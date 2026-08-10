(function(){
'use strict';
const EST='ESTIMATIVA_JSON:';
const ST={gps:null,photos:[]};

const originalEstimateForm=window.estimateForm227;
window.estimateForm227=function(programRef=''){ST.gps=null;ST.photos=[];return originalEstimateForm(programRef)};

const previousLocation=window.agroLocationResult;
window.agroLocationResult=function(tag,s){
  if(tag!=='estimate')return typeof previousLocation==='function'?previousLocation(tag,s):undefined;
  const r=parse(s,{});if(!r.ok)return toast(r.error||'GPS indisponível.','bad');ST.gps=r;
  const b=$('#eGpsBox');if(b){b.classList.add('ready');b.querySelector('.gps-info').innerHTML=`<b>Localização capturada</b><small>${(+r.latitude).toFixed(6)}, ${(+r.longitude).toFixed(6)}${r.accuracy?' · ±'+Math.round(r.accuracy)+' m':''}</small>`}
};
const previousCamera=window.agroCameraResult;
window.agroCameraResult=function(tag,s){
  if(tag!=='estimate')return typeof previousCamera==='function'?previousCamera(tag,s):undefined;
  const r=parse(s,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');ST.photos.push({path:r.path,preview:r.preview||''});drawEstimatePhotos();toast('Foto da estimativa salva no aparelho.')
};
function drawEstimatePhotos(){const el=$('#ePhotos');if(el)el.innerHTML=ST.photos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="A227RemoveEstimatePhoto(${i})">×</span></div>`).join('')}
window.A227RemoveEstimatePhoto=function(i){ST.photos.splice(i,1);drawEstimatePhotos()};

function localEst(){return (Q||[]).filter(q=>q.type==='ponto.create'&&q.status!=='SYNCED').map(q=>{const p=parse(q.payload_json,{});return p.tipo_registro==='ESTIMATIVA'?{...p,_queue:q}:null}).filter(Boolean)}
function serverEst(){return (D.pontos||[]).map(p=>{const o=String(p.observacao||'');if(!o.startsWith(EST))return null;try{return {...JSON.parse(o.slice(EST.length)),id:p.id,_server:true,fotos:p.fotos||0,tecnico_nome:p.tecnico_nome,tecnico_matricula:p.tecnico_matricula}}catch(e){return null}}).filter(Boolean)}
window.estimates227=function(){load();open(()=>{const server=serverEst(),local=localEst();$('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Estimativas</h1><p>Coleta produtiva em campo</p></div><button class="btn primary right" onclick="estimateForm227()">＋ Nova</button></div><div class="stats"><div class="stat"><b>${server.length}</b><span>Sincronizadas</span></div><div class="stat"><b>${local.length}</b><span>Pendentes</span></div><div class="stat"><b>${(D.produtores||[]).length}</b><span>Produtores</span></div></div><div class="list">${[...local,...server].slice(0,150).map(e=>`<div class="row-card"><span class="dot"></span><div class="body"><b>${esc(e.produtor_nome||'Estimativa')}</b><small>${br(e.data_estimativa)} · ${esc(e.comunidade_nome||'')} ${e._queue?'· salva no aparelho':'· sincronizada'}</small></div><span class="badge">${e._queue?'Pendente':'Salva'}</span></div>`).join('')||'<div class="card empty"><b>Nenhuma estimativa registrada</b></div>'}</div>`})};
window.saveEstimate227=function(programRef=''){
 const pid=+$('#eProd').value;if(!pid)return toast('Selecione o produtor.','warn');const p=(D.produtores||[]).find(x=>+x.id===pid)||{},plid=+$('#ePlant').value||null,pl=(D.plantios||[]).find(x=>+x.id===plid)||{};
 const est={tipo_registro:'ESTIMATIVA',produtor_id:pid,produtor_nome:p.nome||'',plantio_id:plid,ano_plantio:pl.ano_plantio||null,comunidade_id:pl.comunidade_id||null,comunidade_nome:pl.comunidade_nome||'',data_estimativa:$('#eDate').value||today(),plantas_amostradas:+$('#ePlants').value||0,inflorescencias_antese:+$('#eAntese').value||0,inflorescencias_fecundadas:+$('#eFec').value||0,cachos_verdes:+$('#eGreen').value||0,cachos_maduros:+$('#eMature').value||0,abortamentos:+$('#eAbort').value||0,latitude:ST.gps?.latitude||pl.latitude||null,longitude:ST.gps?.longitude||pl.longitude||null,precisao_metros:ST.gps?.accuracy||null,observacao_tecnico:$('#eObs').value.trim(),capturado_em:now()};
 const payload={tipo_registro:'ESTIMATIVA',produtor_id:pid,plantio_id:plid,nome_produtor:p.nome||'',cpf_produtor:p.cpf||null,comunidade_id:est.comunidade_id,latitude:+est.latitude,longitude:+est.longitude,precisao_metros:est.precisao_metros,capturado_em:est.capturado_em,observacao:EST+JSON.stringify(est)};
 if(!Number.isFinite(payload.latitude)||!Number.isFinite(payload.longitude))return toast('Capture o GPS ou selecione um plantio com localização.','warn');if(programRef.startsWith('server:'))payload.programacao_id=+programRef.slice(7);if(programRef.startsWith('local:'))payload.programacao_client_uuid=programRef.slice(6);
 const r=result(native('queueOperation','ponto.create',JSON.stringify(payload),JSON.stringify(ST.photos.map(x=>({path:x.path,categoria:'ESTIMATIVA'})))),'Estimativa salva no aparelho.');if(r.ok){load();setTimeout(estimates227,250)}
};
})();