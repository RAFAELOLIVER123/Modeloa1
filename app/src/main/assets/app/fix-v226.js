(function(){
  'use strict';

  function countsText(c){
    if(!c)return '';
    const p=[];
    if(+c.produtores)p.push(c.produtores+' produtores');
    if(+c.atividades)p.push(c.atividades+' atividades');
    if(+c.veiculos)p.push(c.veiculos+' veículos');
    if(+c.comunidades)p.push(c.comunidades+' comunidades');
    if(+c.programacoes)p.push(c.programacoes+' programações');
    return p.slice(0,5).join(' · ');
  }

  // ADMIN e ADMINISTRADOR recebem a visão completa de gestão no aplicativo.
  try{
    isManager=function(){
      const r=String((S.user||{}).perfil_codigo||(S.user||{}).perfil||'').toUpperCase();
      return ['SUPERVISOR','GERENTE','DIRETOR','ADMIN','ADMINISTRADOR','ADMINISTRATOR'].includes(r);
    };
  }catch(e){}

  // Só existe uma operação de sincronização: envia o que está no celular e baixa as bases novas.
  try{
    refreshData=function(){syncNow();};
    syncNow=function(){
      load();
      const on=!!native('isOnline');
      net(on);S.online=on;
      if(!on)return toast('Sem internet. Continue trabalhando: os registros ficam salvos no aparelho.','warn');
      const c=document.getElementById('netChip');
      if(c){c.textContent='Sincronizando';c.className='chip syncing';}
      toast('Enviando coletas e baixando bases…');
      native('syncNow');
    };
    window.syncBoth=syncNow;
  }catch(e){}

  window.agroSyncProgress=function(payload){
    const r=parse(payload,{});if(r.message)toast(r.message);
  };

  window.agroSyncResult=function(payload){
    const r=parse(payload,{});
    load();net(!!native('isOnline'));S.online=!!native('isOnline');
    const resumo=countsText(r.contagens);
    if(r.base_atualizada){
      const msg=(r.message||'Sincronização concluída.')+(resumo?' '+resumo+'.':'');
      toast(msg,r.falhas>0?'warn':'');
      setTimeout(function(){load();if(form)syncScreen();else home();},300);
      return;
    }
    if(r.ok)toast(r.message||'Sincronização concluída.');
    else toast(r.error||r.erro_base||'Não foi possível baixar as bases.','bad');
    if(form)syncScreen();
  };

  window.agroRefreshResult=window.agroSyncResult;

  window.agroLoginProgress=function(payload){
    const r=parse(payload,{}),b=document.getElementById('loginBtn');
    if(b&&r.message){b.disabled=true;b.textContent=r.message;}
  };

  window.agroLoginResult=function(payload){
    const r=parse(payload,{}),b=document.getElementById('loginBtn');
    if(b){b.disabled=false;b.textContent='Entrar';}
    if(!r.ok)return toast(r.error||'Não foi possível entrar.','bad');
    load();
    const resumo=countsText(r.contagens);
    document.getElementById('loginOverlay')?.classList.add('hidden');
    if(resumo)toast('Base carregada: '+resumo+'.');
    nav('home');
  };

  try{
    syncScreen=function(){
      load();
      open(()=>{
        const resumo=[
          `${(D.produtores||[]).length} produtores`,
          `${(D.atividades||[]).length} atividades`,
          `${(D.veiculos||[]).length} veículos`,
          `${(D.comunidades||[]).length} comunidades`
        ].join(' · ');
        $('#screen').innerHTML=`<div class="page-head">${back()}<div><h1>Sincronização</h1><p>${S.online?'Internet disponível':'Tudo continua salvo no celular'}</p></div></div><div class="sync-card"><div class="sync-status"><div class="sync-ring">⇅</div><div><b>${pending()} registro(s) aguardando</b><small>${esc(resumo)}</small></div></div><button class="btn primary full" style="margin-top:16px" onclick="syncNow()">⇅ Sincronizar</button><p class="help">O mesmo botão envia suas coletas e baixa produtores, atividades, veículos, comunidades, programações, pontos e demais atualizações.</p></div><div class="section-title"><h2>Fila local</h2></div><div class="card">${Q.map(q=>`<div class="queue-item"><span class="qicon">•</span><div class="qbody"><b>${esc(queueName(q.type))}</b><small>${esc(q.last_error||'Salvo no aparelho')}</small></div><span class="qstatus">${esc(queueStatus(q.status))}</span></div>`).join('')||'<div class="empty"><b>Nada pendente</b></div>'}</div>`;
      });
    };

    profile=function(){
      load();const u=S.user||{},gs=S.groups||[];
      $('#screen').innerHTML=`<div class="page-head"><div><h1>Perfil</h1><p>Configurações e dados do aparelho</p></div></div><div class="card"><div class="profile-head"><div class="avatar">${esc((u.nome||'U').slice(0,1))}</div><div><h2>${esc(u.nome||'Usuário')}</h2><p>${esc(u.matricula||u.username||'')} · ${esc(u.perfil_nome||u.perfil_codigo||'')}</p></div></div><div class="menu-list"><div class="menu-row"><span>◉</span><b>Grupo de trabalho</b><select onchange="changeGroup(this.value)">${gs.map(g=>`<option value="${g.id}" ${+g.id===+S.group_id?'selected':''}>${esc(g.nome)}</option>`).join('')}</select></div>${isManager()?`<button class="menu-row" onclick="approvals()"><span>✓</span><b>Aprovações</b><em>${(D.aprovacoes_programacoes||[]).length+(D.checklists_pendentes||[]).length}</em></button>`:''}<button class="menu-row" onclick="checklistReports()"><span>▰</span><b>Checklists de veículos</b><em>Ver relatórios</em></button><button class="menu-row" onclick="syncScreen()"><span>⇅</span><b>Sincronizar</b><em>${pending()} pendente(s)</em></button><button class="menu-row" onclick="logout()"><span>↪</span><b>Sair</b></button></div></div>`;
    };

    changeGroup=function(v){
      const r=result(native('setGroup',+v));
      if(r.ok){load();if(native('isOnline'))syncNow();else profile();}
    };
  }catch(e){}

  // ---------- mapa com base cartográfica ----------
  const style=document.createElement('style');
  style.textContent=`
    .offline-map{position:relative!important;overflow:hidden!important;background:#e8efe9!important;min-height:360px}
    .agro-tile-layer{position:absolute;inset:0;z-index:0;overflow:hidden;background:linear-gradient(180deg,#e8efe9,#f3f7f4)}
    .agro-tile-layer img{position:absolute;display:block;max-width:none;pointer-events:none;user-select:none}
    #mcanvas{position:relative!important;z-index:2!important;background:transparent!important;width:100%!important;height:100%!important;min-height:360px}
    .map-watermark{z-index:4!important;background:rgba(255,255,255,.88)!important;padding:4px 7px!important;border-radius:8px!important}
    .map-cache-note{position:absolute;left:10px;bottom:10px;z-index:4;padding:5px 8px;border-radius:9px;background:rgba(255,255,255,.88);font-size:10px;color:#60736b;font-weight:700}
  `;
  document.head.appendChild(style);

  function clampLat(v){return Math.max(-85.0511,Math.min(85.0511,+v));}
  function wx(lon,z){return ((+lon+180)/360)*256*Math.pow(2,z);}
  function wy(lat,z){lat=clampLat(lat)*Math.PI/180;return (1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*256*Math.pow(2,z);}
  function boundsOf(all){
    if(!all.length){const l=S.last_location||{};if(Number.isFinite(+l.latitude)&&Number.isFinite(+l.longitude))all=[{lat:+l.latitude,lng:+l.longitude}];}
    if(!all.length)return null;
    let minLat=90,maxLat=-90,minLng=180,maxLng=-180;
    all.forEach(p=>{if(Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)){minLat=Math.min(minLat,+p.lat);maxLat=Math.max(maxLat,+p.lat);minLng=Math.min(minLng,+p.lng);maxLng=Math.max(maxLng,+p.lng);}});
    if(minLat>maxLat)return null;
    const dpLat=Math.max(.003,(maxLat-minLat)*.12),dpLng=Math.max(.003,(maxLng-minLng)*.12);
    return {minLat:minLat-dpLat,maxLat:maxLat+dpLat,minLng:minLng-dpLng,maxLng:maxLng+dpLng};
  }
  function chooseZ(b,w,h){
    const lon=Math.max(.0001,b.maxLng-b.minLng),lat=Math.max(.0001,b.maxLat-b.minLat);
    return Math.max(5,Math.min(17,Math.floor(Math.min(Math.log2(Math.max(1,w/256)*360/lon),Math.log2(Math.max(1,h/256)*170/lat)))));
  }
  function tileLayer(b,w,h){
    const shell=document.querySelector('.offline-map');if(!shell||!b)return;
    let layer=shell.querySelector('.agro-tile-layer');if(!layer){layer=document.createElement('div');layer.className='agro-tile-layer';shell.insertBefore(layer,shell.firstChild);}
    layer.innerHTML='';
    const z=chooseZ(b,w,h),minX=wx(b.minLng,z),maxX=wx(b.maxLng,z),topY=wy(b.maxLat,z),bottomY=wy(b.minLat,z),sx=w/Math.max(1,maxX-minX),sy=h/Math.max(1,bottomY-topY);
    let tx0=Math.floor(minX/256),tx1=Math.floor(maxX/256),ty0=Math.floor(topY/256),ty1=Math.floor(bottomY/256),count=0;const m=Math.pow(2,z)-1;
    tx0=Math.max(0,tx0);ty0=Math.max(0,ty0);tx1=Math.min(m,tx1);ty1=Math.min(m,ty1);
    for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
      if(++count>72)break;
      const img=document.createElement('img');img.alt='';img.decoding='async';img.src=`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
      img.style.left=((tx*256-minX)*sx)+'px';img.style.top=((ty*256-topY)*sy)+'px';img.style.width=(256*sx+1)+'px';img.style.height=(256*sy+1)+'px';layer.appendChild(img);
    }
    const note=document.createElement('div');note.className='map-cache-note';note.textContent='Rotas e pontos funcionam offline';layer.appendChild(note);
    const wm=shell.querySelector('.map-watermark');if(wm)wm.textContent='AgroDominium · © OpenStreetMap';
  }

  try{
    const oldMap=map;
    map=function(mode='mine'){
      oldMap(mode);
      setTimeout(function(){drawMap(mapItems(mode),routeMapItems(mode));},50);
    };

    drawMap=function(points,routes){
      const c=document.getElementById('mcanvas');if(!c)return;
      const rr=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=rr.width,h=Math.max(360,rr.height||360);
      c.width=Math.max(1,Math.round(w*d));c.height=Math.max(1,Math.round(h*d));
      const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);
      const all=[...(points||[]),...(routes||[])],b=boundsOf(all);
      if(!b){x.fillStyle='#789087';x.font='14px sans-serif';x.fillText('Nenhuma localização disponível. Sincronize a base.',22,45);return;}
      tileLayer(b,w,h);
      const latSpan=Math.max(.000001,b.maxLat-b.minLat),lngSpan=Math.max(.000001,b.maxLng-b.minLng);
      const xy=p=>[(+p.lng-b.minLng)/lngSpan*w,h-(+p.lat-b.minLat)/latSpan*h];
      const by={};(routes||[]).forEach(p=>(by[p.sessao]??=[]).push(p));
      x.lineWidth=4;x.strokeStyle='#2563eb';x.lineCap='round';x.lineJoin='round';
      Object.values(by).forEach(arr=>{x.beginPath();arr.forEach((p,i)=>{const [px,py]=xy(p);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();});
      (points||[]).slice(0,5000).forEach((p,i)=>{const [px,py]=xy(p);x.fillStyle='#0b7a4d';x.beginPath();x.arc(px,py,5.2,0,Math.PI*2);x.fill();x.strokeStyle='#fff';x.lineWidth=2;x.stroke();if(i<60&&p.name){x.font='600 10px sans-serif';x.fillStyle='#17372c';x.fillText(String(p.name).slice(0,24),px+7,py-7);}});
      const l=S.last_location||{};if(Number.isFinite(+l.latitude)&&Number.isFinite(+l.longitude)){const [px,py]=xy({lat:+l.latitude,lng:+l.longitude});x.fillStyle='#7c3aed';x.beginPath();x.arc(px,py,7,0,Math.PI*2);x.fill();x.strokeStyle='#fff';x.lineWidth=2;x.stroke();}
    };
  }catch(e){}

  window.agroNetworkChanged=function(on){
    try{net(!!on);S.online=!!on;if(on&&pending()>0)native('scheduleAutoSync');if(tab==='home'&&!form)home();}catch(e){}
  };
})();
