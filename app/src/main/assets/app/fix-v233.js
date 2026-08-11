(function(){
'use strict';

const M233={photos:[]};
const previousMaintenanceForm233=window.maintenanceForm231;
const previousCamera233=window.agroCameraResult;

function draw233(){const el=document.getElementById('mGrid231');if(!el)return;el.innerHTML=M233.photos.map((x,i)=>`<div class="thumb">${x.preview?`<img src="${x.preview}">`:'<div class="photo-placeholder">📷</div>'}<span onclick="removeMaintenancePhoto231(${i})">×</span></div>`).join('')}

window.maintenanceForm231=function(){M233.photos=[];previousMaintenanceForm233();setTimeout(draw233,30)};
window.removeMaintenancePhoto231=function(i){M233.photos.splice(i,1);draw233()};
window.maintenanceGallery231=async function(files){for(const f of [...files]){try{const data=await compress(f),r=parse(native('savePhoto',data,f.name)||'{}',{});if(r.ok)M233.photos.push({path:r.path,name:r.name,preview:data});else toast(r.error||'Não foi possível salvar a foto.','bad')}catch(_){toast('Não foi possível processar a foto.','bad')}}draw233()};
window.agroCameraResult=function(tag,payload){if(tag==='maintenance231'){const r=parse(payload,{});if(!r.ok)return toast(r.error||'Foto não registrada.','bad');M233.photos.push({path:r.path,name:r.name,preview:r.preview||''});draw233();toast('Foto salva no aparelho.');return}if(typeof previousCamera233==='function')previousCamera233(tag,payload)};

window.saveMaintenance231=function(){
  const vid=+document.getElementById('mVeh231')?.value||0,v=(D.veiculos||[]).find(x=>+x.id===vid)||{},checked=[...document.querySelectorAll('.mItem231:checked')],km=Number(document.getElementById('mKm231')?.value);
  if(!vid)return toast('Selecione o veículo.','warn');
  if(!document.getElementById('mDate231')?.value)return toast('Informe a data da parada.','warn');
  if(!Number.isFinite(km)||km<0)return toast('Informe o KM do veículo.','warn');
  if(!checked.length)return toast('Marque pelo menos um item de manutenção.','warn');
  const p={
    veiculo_id:vid,moto_id:vid,placa:v.placa||'',veiculo_tipo:v.tipo||'',veiculo_modelo:v.modelo||'',
    data_parada:document.getElementById('mDate231').value,km_parada:km,
    prioridade:document.getElementById('mPri231')?.value||'NORMAL',
    previsao_retorno:document.getElementById('mReturn231')?.value||null,
    moto_imobilizada:document.getElementById('mStop231')?.checked?1:0,
    itens:checked.map(x=>({id:+x.value,nome:x.dataset.name,categoria:x.dataset.cat})),
    fornecedor:document.getElementById('mShop231')?.value.trim()||'',
    telefone_oficina:document.getElementById('mPhone231')?.value.trim()||'',
    numero_orcamento:document.getElementById('mBudgetNo231')?.value.trim()||'',
    valor_orcamento:+document.getElementById('mBudget231')?.value||null,
    solicitacao:document.getElementById('mDesc231')?.value.trim()||'',
    status:'AGUARDANDO_APROVACAO',created_at:now()
  };
  const files=M233.photos.map(x=>({path:x.path,categoria:'MANUTENCAO'}));
  const r=result(native('queueOperation','maintenance.request',JSON.stringify(p),JSON.stringify(files)),'Solicitação de manutenção salva no aparelho.');
  if(r.ok){load();native('scheduleAutoSync');setTimeout(()=>window.maintenance231&&maintenance231(),180)}
};

})();