(function(){
  'use strict';

  let loginTimer=null;

  function j(v,f){try{return JSON.parse(v);}catch(e){return f;}}
  function state(){try{return j(window.AgroNative.getState(),{});}catch(e){return {};}}
  function snapshot(){try{return j(window.AgroNative.getSnapshot(),{});}catch(e){return {};}}
  function ready(){
    const s=state(),snap=snapshot(),u=s.user||{},d=snap.data||{};
    const hasUser=!!(u.nome||u.username||u.matricula);
    const hasData=['produtores','programacoes','comunidades','polos','atividades','veiculos','plantios'].some(k=>Array.isArray(d[k]));
    return !!s.authenticated && !!s.has_snapshot && hasUser && hasData;
  }
  function button(text,disabled){
    const b=document.getElementById('loginBtn');
    if(!b)return;
    b.textContent=text||'Entrar';
    b.disabled=!!disabled;
  }
  function showLogin(){
    const o=document.getElementById('loginOverlay');
    if(o)o.classList.remove('hidden');
  }
  function hideLogin(){
    const o=document.getElementById('loginOverlay');
    if(o)o.classList.add('hidden');
  }
  function notify(msg,type){
    try{if(typeof window.toast==='function')window.toast(msg,type||'');}catch(e){}
  }

  window.doLogin=function(){
    const u=(document.getElementById('loginUser')?.value||'').trim();
    const p=document.getElementById('loginPass')?.value||'';
    if(!u||!p){notify('Informe usuário e senha.','warn');return;}
    if(!window.AgroNative || typeof window.AgroNative.login!=='function'){
      notify('O aplicativo não conseguiu acessar o módulo de login. Feche e abra novamente.','bad');
      return;
    }

    if(loginTimer)clearTimeout(loginTimer);
    button('Validando acesso…',true);
    try{
      window.AgroNative.login(u,p);
    }catch(e){
      button('Entrar',false);
      notify('Não foi possível iniciar o login.','bad');
      return;
    }

    loginTimer=setTimeout(function(){
      button('Entrar',false);
      notify('A conexão demorou demais. Confira a internet e tente novamente.','bad');
    },50000);
  };

  window.agroLoginProgress=function(payload){
    const r=j(payload,{});
    if(r.message)button(r.message,true);
  };

  window.agroLoginResult=function(payload){
    if(loginTimer){clearTimeout(loginTimer);loginTimer=null;}
    const r=j(payload,{});
    if(!r.ok){
      button('Entrar',false);
      showLogin();
      notify(r.error||'Não foi possível entrar.','bad');
      return;
    }

    button('Abrindo…',true);
    setTimeout(function(){
      if(ready()){
        try{if(typeof window.load==='function')window.load();}catch(e){}
        hideLogin();
        try{if(typeof window.nav==='function')window.nav('home');}catch(e){}
      }else{
        button('Entrar',false);
        showLogin();
        notify('O acesso foi validado, mas os dados ainda não foram baixados. Tente novamente com a internet ativa.','bad');
      }
    },250);
  };

  function enterHandler(e){
    if(e.key==='Enter'){
      e.preventDefault();
      window.doLogin();
    }
  }

  document.addEventListener('DOMContentLoaded',function(){
    const user=document.getElementById('loginUser');
    const pass=document.getElementById('loginPass');
    if(user)user.addEventListener('keydown',enterHandler);
    if(pass)pass.addEventListener('keydown',enterHandler);

    setTimeout(function(){
      if(ready()){
        hideLogin();
        try{if(typeof window.nav==='function')window.nav('home');}catch(e){}
      }else{
        showLogin();
        button('Entrar',false);
      }
    },180);
  });
})();
