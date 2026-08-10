(function(){
  'use strict';

  // Administrador deve receber a mesma visão gerencial completa no aplicativo.
  try{
    isManager=function(){
      return ['SUPERVISOR','GERENTE','DIRETOR','ADMIN','ADMINISTRADOR','ADMINISTRATOR'].includes(String(role()||'').toUpperCase());
    };
  }catch(e){}

  function countsText(c){
    if(!c)return '';
    const parts=[];
    if(+c.produtores)parts.push(c.produtores+' produtores');
    if(+c.atividades)parts.push(c.atividades+' atividades');
    if(+c.veiculos)parts.push(c.veiculos+' veículos');
    if(+c.comunidades)parts.push(c.comunidades+' comunidades');
    if(+c.programacoes)parts.push(c.programacoes+' programações');
    return parts.slice(0,4).join(' · ');
  }

  // Um único botão faz as duas direções: aparelho -> servidor e servidor -> aparelho.
  try{
    syncBoth=function(){
      load();
      const on=!!native('isOnline');
      updateNet(on);
      if(!on)return toast('Sem internet. Continue trabalhando: os registros ficam salvos no aparelho.','warn');
      const chip=document.getElementById('netChip');
      if(chip){chip.textContent='Sincronizando';chip.className='chip syncing';}
      toast('Enviando coletas e baixando atualizações…');
      native('syncNow');
    };
  }catch(e){}

  window.agroSyncResult=function(payload){
    const r=parse(payload,{});
    load();
    updateNet(!!native('isOnline'));
    const resumo=countsText(r.contagens);
    if(r.base_atualizada){
      toast((r.message||'Sincronização concluída.')+(resumo?' '+resumo+'.':''),r.falhas>0?'warn':'');
      setTimeout(function(){
        load();
        if(typeof FORM!=='undefined'&&FORM&&typeof syncScreen==='function')syncScreen();
        else if(typeof home==='function')home();
      },300);
      return;
    }
    if(r.ok)toast(r.message||'Sincronização concluída.');
    else toast(r.error||r.erro_base||'Não foi possível atualizar as bases.','bad');
    if(typeof FORM!=='undefined'&&FORM&&typeof syncScreen==='function')syncScreen();
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

  window.agroLoginProgress=function(payload){
    const r=parse(payload,{}),b=document.getElementById('loginBtn');
    if(b&&r.message){b.disabled=true;b.textContent=r.message;}
  };

  // ---------- mapa base ----------
  const style=document.createElement('style');
  style.textContent=`
    .map-shell{position:relative;overflow:hidden;background:#e8efe9!important}
    .map-tile-layer{position:absolute;inset:0;overflow:hidden;z-index:0;background:linear-gradient(180deg,#e8efe9,#f3f7f4)}
    .map-tile-layer img{position:absolute;display:block;max-width:none;user-select:none;pointer-events:none}
    .map-tile-layer .offline-map-note{position:absolute;left:12px;bottom:12px;padding:6px 9px;border-radius:10px;background:rgba(255,255,255,.88);color:#61736c;font-size:10px;font-weight:700}
    #mapCanvas{position:relative!important;z-index:2!important;background:transparent!important}
    .map-tools,.map-info,.map-watermark{z-index:4!important}
    .map-watermark{background:rgba(255,255,255,.82)!important;padding:4px 7px!important;border-radius:8px!important}
  `;
  document.head.appendChild(style);

  let tileKey='';
  function clampLat(v){return Math.max(-85.0511,Math.min(85.0511,+v));}
  function worldX(lon,z){return ((+lon+180)/360)*256*Math.pow(2,z);}
  function worldY(lat,z){lat=clampLat(lat)*Math.PI/180;return (1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*256*Math.pow(2,z);}
  function chooseZoom(b,w,h){
    const lon=Math.max(.0001,b.maxLng-b.minLng),lat=Math.max(.0001,b.maxLat-b.minLat);
    const zx=Math.log2(Math.max(1,w/256)*360/lon);
    const zy=Math.log2(Math.max(1,h/256)*170/lat);
    return Math.max(5,Math.min(17,Math.floor(Math.min(zx,zy))));
  }
  function ensureTileLayer(){
    const shell=document.querySelector('.map-shell');if(!shell)return null;
    let layer=shell.querySelector('.map-tile-layer');
    if(!layer){layer=document.createElement('div');layer.className='map-tile-layer';shell.insertBefore(layer,shell.firstChild);}
    const wm=shell.querySelector('.map-watermark');if(wm)wm.textContent='AgroDominium · © OpenStreetMap';
    return layer;
  }
  function renderBaseTiles(){
    try{
      const layer=ensureTileLayer(),canvas=document.getElementById('mapCanvas');
      if(!layer||!canvas||!MAP||!MAP.bounds)return;
      const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,b=MAP.bounds;
      if(w<10||h<10)return;
      const z=chooseZoom(b,w,h);
      const minX=worldX(b.minLng,z),maxX=worldX(b.maxLng,z),topY=worldY(b.maxLat,z),bottomY=worldY(b.minLat,z);
      const sx=w/Math.max(1,maxX-minX),sy=h/Math.max(1,bottomY-topY);
      const key=[z,b.minLat.toFixed(4),b.maxLat.toFixed(4),b.minLng.toFixed(4),b.maxLng.toFixed(4),Math.round(w),Math.round(h)].join('|');
      if(tileKey!==key){
        tileKey=key;layer.innerHTML='';
        let tx0=Math.floor(minX/256),tx1=Math.floor(maxX/256),ty0=Math.floor(topY/256),ty1=Math.floor(bottomY/256),count=0;
        const maxTile=Math.pow(2,z)-1;
        tx0=Math.max(0,tx0);ty0=Math.max(0,ty0);tx1=Math.min(maxTile,tx1);ty1=Math.min(maxTile,ty1);
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(++count>72)break;
          const img=document.createElement('img');
          img.src=`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
          img.alt='';img.decoding='async';
          img.style.left=((tx*256-minX)*sx)+'px';img.style.top=((ty*256-topY)*sy)+'px';
          img.style.width=(256*sx+1)+'px';img.style.height=(256*sy+1)+'px';
          layer.appendChild(img);
        }
        const note=document.createElement('div');note.className='offline-map-note';note.textContent='Pontos, polígonos e rotas continuam disponíveis offline';layer.appendChild(note);
      }
      layer.style.transformOrigin='50% 50%';
      layer.style.transform=`translate(${MAP.ox||0}px,${MAP.oy||0}px) scale(${MAP.zoom||1})`;
    }catch(e){}
  }

  try{
    const oldMapScreen=mapScreen;
    mapScreen=function(){
      const r=oldMapScreen.apply(this,arguments);
      setTimeout(function(){ensureTileLayer();renderBaseTiles();drawMap();},60);
      return r;
    };

    drawMap=function(){
      const c=document.getElementById('mapCanvas');if(!c||!MAP.bounds)return;
      renderBaseTiles();
      const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));
      const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);const w=r.width,h=r.height;x.clearRect(0,0,w,h);
      if(!document.querySelector('.map-tile-layer img'))drawGrid(x,w,h);
      for(const p of MAP.polys||[]){const pts=p.points.map(q=>project(q,w,h));if(pts.length<3)continue;x.beginPath();x.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(pt=>x.lineTo(pt.x,pt.y));x.closePath();x.fillStyle=p.kind==='community'?'rgba(88,135,190,.08)':'rgba(14,107,69,.10)';x.strokeStyle=p.kind==='community'?'rgba(55,101,160,.55)':'rgba(14,107,69,.62)';x.lineWidth=1.4;x.fill();x.stroke();}
      for(const r0 of MAP.routes||[]){const pts=r0.points.map(q=>project(q,w,h));if(pts.length<2)continue;x.beginPath();x.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(pt=>x.lineTo(pt.x,pt.y));x.strokeStyle='#2563eb';x.lineWidth=4;x.lineCap='round';x.lineJoin='round';x.stroke();}
      for(const item of MAP.items||[]){const p=project(item,w,h);x.beginPath();x.arc(p.x,p.y,item.kind==='visit'?6:5,0,Math.PI*2);x.fillStyle=item.kind==='visit'?'#e27a12':'#0e6b45';x.fill();x.strokeStyle='#fff';x.lineWidth=2.2;x.stroke();}
      if(MAP.current&&Number.isFinite(+MAP.current.latitude)){const p=project({lat:+MAP.current.latitude,lng:+MAP.current.longitude},w,h);x.beginPath();x.arc(p.x,p.y,7.5,0,Math.PI*2);x.fillStyle='#7c3aed';x.fill();x.strokeStyle='#fff';x.lineWidth=2.5;x.stroke();x.beginPath();x.arc(p.x,p.y,14,0,Math.PI*2);x.strokeStyle='rgba(124,58,237,.32)';x.lineWidth=5;x.stroke();}
    };
  }catch(e){}

  // Ao voltar da rede, o status é atualizado imediatamente. O envio automático permanece ativo.
  window.agroNetworkChanged=function(on){
    try{updateNet(!!on);load();if(on&&pending()>0)native('scheduleAutoSync');if(typeof TAB!=='undefined'&&TAB==='home'&&!FORM)home();}catch(e){}
  };
})();
