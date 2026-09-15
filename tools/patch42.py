from pathlib import Path

p = Path('app/src/main/assets/game.html')
s = p.read_text()

css41 = r'''
/* DamaCub 4.1: GPU-composited piece motion; board stays static during CPU turns. */
.board{contain:layout paint;transform:translateZ(0);backface-visibility:hidden}
.cells,.pieces{transform:translateZ(0);backface-visibility:hidden}
.piece-slot{left:0!important;top:0!important;transition:transform .30s cubic-bezier(.22,.74,.22,1),opacity .14s ease;will-change:transform,opacity;transform-origin:center center;backface-visibility:hidden}
.disc{transition:transform .16s ease,opacity .14s ease,filter .16s ease;backface-visibility:hidden}
.piece-slot.jumping{z-index:60;transition-duration:.46s}
.piece-slot.jumping .disc{transform:translateY(-16%) scale(1.15);filter:drop-shadow(0 13px 7px rgba(0,0,0,.40))}
.piece-slot.under-jump .disc{transform:scale(.91);filter:brightness(.78)}
.piece-slot.captured .disc{transform:scale(.18) rotate(16deg)}
'''
css42 = r'''
/* DamaCub 4.2: larger true-centered board + smooth GPU movement. */
.game{position:relative;display:block;padding:0;overflow:hidden}
.topbar{position:fixed;left:50%;top:max(7px,env(safe-area-inset-top));transform:translateX(-50%);width:min(96vw,760px);height:52px;display:flex;align-items:center;justify-content:space-between;z-index:80;pointer-events:auto}
.board-shell{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(98vw,900px,calc(100vh - 12px));height:auto;max-width:none;max-height:none;aspect-ratio:1/1;z-index:10}
.bottom-status{position:fixed;left:50%;bottom:max(5px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:70;height:20px;width:max-content;padding:0 9px;border-radius:999px;background:rgba(11,16,32,.66);backdrop-filter:blur(6px)}
.board{border-width:4px;border-radius:16px}
.piece-slot{transition:transform .31s cubic-bezier(.22,.74,.22,1),opacity .14s ease}
.piece-slot.jumping{transition-duration:.50s}
.piece-slot.jumping .disc{transform:translateY(-19%) scale(1.17);filter:drop-shadow(0 15px 8px rgba(0,0,0,.43))}
@media (orientation:landscape){.board-shell{width:min(96vh,900px,98vw)}.topbar{width:min(98vw,900px);height:46px}.bottom-status{display:flex}}
'''
if 'DamaCub 4.1: GPU-composited' not in s:
    s = s.replace('</style>', css41 + '\n' + css42 + '\n</style>', 1)
elif 'DamaCub 4.2: larger true-centered board' not in s:
    s = s.replace('</style>', css42 + '\n</style>', 1)

def replace_between(start_token, end_token, replacement):
    global s
    a = s.index(start_token)
    b = s.index(end_token, a)
    s = s[:a] + replacement + '\n' + s[b:]

replace_between('function chains(', 'function legal(',
"function captureWalk(b,r,c,p,origin,path,caps){var js=jumpsFrom(b,r,c,p),all=[],i,j,nb,np,npth,ncaps,m;for(i=0;i<js.length;i++){j=js[i];nb=clone(b);nb[r][c]=E;nb[j.cap[0]][j.cap[1]]=E;np=p;if((p===H&&j.r===0)||(p===A&&j.r===7))np=p>0?HK:AK;nb[j.r][j.c]=np;npth=path.concat([{r:j.r,c:j.c}]);ncaps=caps.concat([j.cap]);m={from:{r:origin.r,c:origin.c},to:{r:j.r,c:j.c},path:npth.slice(),caps:ncaps.slice()};all.push(m);all=all.concat(captureWalk(nb,j.r,j.c,np,origin,npth,ncaps))}return all}\nfunction captureOptions(b,r,c,p){return captureWalk(b,r,c,p,{r:r,c:c},[],[])}")
replace_between('function legal(', 'function applySim(',
"function legal(b,s){var moves=[],r,c,p,ds,cs,i,rr,cc;for(r=0;r<8;r++)for(c=0;c<8;c++){p=b[r][c];if(side(p)!==s)continue;cs=captureOptions(b,r,c,p);for(i=0;i<cs.length;i++)moves.push(cs[i]);ds=moveDirs(p);for(i=0;i<ds.length;i++){rr=r+ds[i][0];cc=c+ds[i][1];if(inside(rr,cc)&&b[rr][cc]===E)moves.push({from:{r:r,c:c},to:{r:rr,c:cc},path:[{r:rr,c:cc}],caps:[]})}}return moves}")
replace_between('function applySim(', 'function buildCells(',
"function applySim(b,m){var nb=clone(b),p=nb[m.from.r][m.from.c],i,dest;nb[m.from.r][m.from.c]=E;for(i=0;i<m.path.length;i++){if(m.caps[i])nb[m.caps[i][0]][m.caps[i][1]]=E;dest=m.path[i];if((p===H&&dest.r===0)||(p===A&&dest.r===7))p=p>0?HK:AK}dest=m.path[m.path.length-1];nb[dest.r][dest.c]=p;return nb}")
replace_between('function setPos(', 'function rebuildPieces(', "function setPos(node,r,c){node.style.transform='translate3d('+(c*100)+'%,'+(r*100)+'%,0)'}")
replace_between('function selectPiece(', 'function count(', "function selectPiece(r,c,lm){var list=lm.filter(function(m){return m.from.r===r&&m.from.c===c});if(!list.length){toast('Sem jogada para esta peça');playError();return}selected={r:r,c:c};targets=list;playSelect();markLegal()}")
replace_between('function animateMove(', 'function commitMove(',
"function animateMove(m,done){var p=board[m.from.r][m.from.c],node=pieceMap[key(m.from.r,m.from.c)],i=0,curR=m.from.r,curC=m.from.c;if(!node){done();return}delete pieceMap[key(curR,curC)];node.classList.remove('selected-piece');clearMarks();function next(){if(i>=m.path.length){var end=m.path[m.path.length-1];pieceMap[key(end.r,end.c)]=node;done();return}var dest=m.path[i],cap=m.caps[i],victim=cap?pieceMap[key(cap[0],cap[1])]:null,dur=cap?500:300;if(cap){node.classList.add('jumping');if(victim){setTimeout(function(){if(victim&&victim.parentNode)victim.classList.add('under-jump')},Math.round(dur*.43))}}setPos(node,dest.r,dest.c);setTimeout(function(){node.classList.remove('jumping');if((p===H&&dest.r===0)||(p===A&&dest.r===7)){p=p>0?HK:AK;if(!node.classList.contains('king')){node.classList.add('king');playKing()}}if(cap&&victim){victim.classList.remove('under-jump');playCapture();victim.classList.add('captured');delete pieceMap[key(cap[0],cap[1])];setTimeout(function(){if(victim.parentNode)victim.parentNode.removeChild(victim)},150)}else playMove();curR=dest.r;curC=dest.c;i++;setTimeout(next,cap?185:45)},dur)}next()}")

s = s.replace("choices=targets.filter(function(m){return m.to.r===r&&m.to.c===c});if(choices.length){doHuman(choices[0]);return}",
              "choices=targets.filter(function(m){return m.to.r===r&&m.to.c===c});if(choices.length){choices.sort(function(a,b){return b.caps.length-a.caps.length});doHuman(choices[0]);return}")

s = s.replace('var board=[],cells=[],pieceMap={},selected=null,targets=[],humanTurn=true,locked=false,level=1,gameOver=false,soundOn=true,audioCtx=null,hintMove=null;',
              'var board=[],cells=[],pieceMap={},selected=null,targets=[],humanTurn=true,locked=false,level=1,gameOver=false,soundOn=true,audioCtx=null,hintMove=null,musicTimer=null,musicStep=0;')
needle = "function playSelect(){tone(440,.055,.025,'sine')}function playMove(){tone(250,.065,.025,'triangle')}function playCapture(){tone(155,.11,.05,'square');tone(360,.09,.03,'triangle',.035)}function playKing(){tone(520,.12,.035,'sine');tone(780,.15,.025,'sine',.07)}function playError(){tone(120,.08,.025,'square')}function playEnd(win){if(win){tone(523,.15,.04,'sine');tone(659,.16,.04,'sine',.12);tone(784,.25,.04,'sine',.24)}else{tone(220,.14,.035,'triangle');tone(164,.24,.035,'triangle',.12)}}"
if needle not in s:
    raise SystemExit('SFX base nao encontrado')
s = s.replace(needle, needle + "\nfunction musicBeat(){var notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23,246.94,329.63,392,329.63,220,293.66,349.23,293.66],f;if(!soundOn||document.hidden||!document.getElementById('start').classList.contains('hidden')){musicTimer=null;return}f=notes[musicStep%notes.length];tone(f,.34,.0065,'sine');if(musicStep%4===0)tone(f/2,.55,.0045,'triangle',.02);musicStep++;musicTimer=setTimeout(musicBeat,430)}\nfunction startMusic(){if(!soundOn||musicTimer||document.hidden||!document.getElementById('start').classList.contains('hidden'))return;musicBeat()}function stopMusic(){if(musicTimer){clearTimeout(musicTimer);musicTimer=null}}", 1)

replace_between('function setLevel(', 'function showHint(',
"function setLevel(n,reset){level=n;var all=document.querySelectorAll('[data-level]'),i;for(i=0;i<all.length;i++)all[i].classList.toggle('active',parseInt(all[i].getAttribute('data-level'),10)===n);document.getElementById('startDiffName').textContent=levelNames[n];document.getElementById('diffCurrent').textContent=levelNames[n];if(document.getElementById('start').classList.contains('hidden'))toast('Nível: '+levelNames[n]+' • próxima jogada do robô')}")
s = s.replace("document.getElementById('play').onclick=function(){ensureAudio();document.getElementById('start').classList.add('hidden');newGame();tone(440,.08,.025,'sine');tone(660,.1,.025,'sine',.06)};",
              "document.getElementById('play').onclick=function(){ensureAudio();document.getElementById('start').classList.add('hidden');newGame();tone(440,.08,.025,'sine');tone(660,.1,.025,'sine',.06);setTimeout(startMusic,180)};")
s = s.replace("document.getElementById('soundToggle').onclick=function(){soundOn=!soundOn;this.textContent=soundOn?'Ligado':'Mudo';this.classList.toggle('on',soundOn);if(soundOn){ensureAudio();playSelect()}};",
              "document.getElementById('soundToggle').onclick=function(){soundOn=!soundOn;this.textContent=soundOn?'Ligado':'Mudo';this.classList.toggle('on',soundOn);if(soundOn){ensureAudio();playSelect();startMusic()}else stopMusic()};")
s = s.replace("window.DamaCubBack=function(){", "document.addEventListener('visibilitychange',function(){if(document.hidden)stopMusic();else startMusic()});\nwindow.DamaCubBack=function(){", 1)

s = s.replace('<div class="row-label">Dica</div><small>Veja um vídeo e marque uma jogada</small>', '<div class="row-label">Anúncio recompensado</div><small>Assista e receba uma dica</small>')
s = s.replace("rewardBtn.textContent=ready?'Vídeo':'Carregando…'", "rewardBtn.textContent=ready?'Anúncio':'Carregando…'")

p.write_text(s)

g = Path('app/build.gradle')
gs = g.read_text()
for old in ('versionCode 4', 'versionCode 5'):
    gs = gs.replace(old, 'versionCode 6')
for old in ("versionName '4.0'", "versionName '4.1'"):
    gs = gs.replace(old, "versionName '4.2'")
g.write_text(gs)

assert 'function captureOptions' in s
assert "width:min(98vw,900px,calc(100vh - 12px))" in s
assert 'musicBeat' in s and 'startMusic' in s
setlevel = s[s.index('function setLevel('):s.index('function showHint(')]
assert 'newGame' not in setlevel
assert 'Anúncio recompensado' in s
assert 'ca-app-pub-8790498111791129/6529171280' in gs
