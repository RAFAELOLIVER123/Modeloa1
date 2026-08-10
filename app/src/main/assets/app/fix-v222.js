(function(){
  'use strict';

  const LOGIN_KEY='agrodominium_v222_login_ok';
  let lastOnline=null;

  function readJson(value,fallback){
    try{return JSON.parse(value);}catch(e){return fallback;}
  }

  function nativeState(){
    try{return readJson(window.AgroNative.getState(),{});}catch(e){return {};}
  }

  function nativeSnapshot(){
    try{return readJson(window.AgroNative.getSnapshot(),{});}catch(e){return {};}
  }

  function snapshotReady(st,snap){
    if(!st || !st.has_snapshot || !snap || typeof snap!=='object')return false;
    const d=snap.data;
    if(!d || typeof d!=='object')return false;
    return ['produtores','programacoes','comunidades','polos','atividades','veiculos','plantios'].some(k=>Array.isArray(d[k]));
  }

  function userReady(st){
    const u=st&&st.user;
    return !!(u && (u.nome || u.username || u.matricula));
  }

  function showLogin(message){
    const overlay=document.getElementById('loginOverlay');
    if(overlay)overlay.classList.remove('hidden');
    if(message && typeof window.toast==='function')window.toast(message,'warn');
  }

  function validateSession(){
    const st=nativeState(),snap=nativeSnapshot();
    const firstRun=localStorage.getItem(LOGIN_KEY)!=='1';
    const valid=!!st.authenticated && userReady(st) && snapshotReady(st,snap);
    if(firstRun || !valid){
      showLogin(firstRun?'Entre novamente para validar o aparelho e baixar sua base de trabalho.':'Faça login com internet para baixar os dados deste aparelho.');
      return false;
    }
    const overlay=document.getElementById('loginOverlay');
    if(overlay)overlay.classList.add('hidden');
    return true;
  }

  function pollNetwork(){
    let online=false;
    try{online=!!window.AgroNative.isOnline();}catch(e){}
    if(lastOnline===null || lastOnline!==online){
      lastOnline=online;
      try{if(typeof window.agroNetworkChanged==='function')window.agroNetworkChanged(online);}catch(e){}
    }
  }

  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(validateSession,120);
    setTimeout(pollNetwork,200);
    setInterval(pollNetwork,2000);
  });

  const originalLoginResult=window.agroLoginResult;
  window.agroLoginResult=function(payload){
    if(typeof originalLoginResult==='function')originalLoginResult(payload);
    setTimeout(function(){
      const result=readJson(payload,{}),st=nativeState(),snap=nativeSnapshot();
      if(result.ok && st.authenticated && userReady(st) && snapshotReady(st,snap)){
        localStorage.setItem(LOGIN_KEY,'1');
        const overlay=document.getElementById('loginOverlay');
        if(overlay)overlay.classList.add('hidden');
        try{if(typeof window.nav==='function')window.nav('home');}catch(e){}
      }else if(result.ok){
        showLogin('O acesso foi reconhecido, mas a base ainda não foi baixada. Mantenha a internet ligada e toque em Entrar novamente.');
      }
    },350);
  };
})();
