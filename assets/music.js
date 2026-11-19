/* Музыка: файл assets/song.mp3 (с 0:27), запасная мелодия синтезируется. Стартует при первом касании. */
(function(){
  var AC=window.AudioContext||window.webkitAudioContext,btn=document.getElementById('music');
  if(!btn) return;
  var BPM=66,B=60/BPM,BARS=16,ctx=null,master=null,wet=null,timer=0,nextT=0,on=false;
  var FM=[41,[53,57,60,64]],DM=[38,[50,57,60,65]],BB=[46,[58,62,65,69]],C=[48,[55,60,64,67]],
      GM=[43,[55,58,62,65]],C7=[48,[55,58,64,67]],AM=[45,[57,60,64,67]],CS=[48,[55,58,65,67]];
  var CH=[FM,DM,BB,C,FM,DM,BB,C,GM,C7,FM,AM,BB,GM,CS,FM];
  var PAT=[0,2,1,3,2,3,1,2];
  var MEL=[[72,1.5],[76,.5],[77,2],[74,1.5],[72,.5],[69,2],[77,2],[74,1],[72,1],[76,1.5],[74,.5],[72,2],
           [76,1],[77,1],[81,2],[77,1.5],[76,.5],[74,2],[74,1],[77,1],[79,1],[77,1],[76,2],[72,1],[67,1],
           [74,1.5],[77,.5],[79,2],[79,2],[76,1],[74,1],[77,2],[76,1],[72,1],[76,1.5],[74,.5],[72,2],
           [77,2],[81,1],[79,1],[77,1.5],[74,.5],[70,2],[72,2],[70,1],[67,1],[72,1],[69,1],[65,2]];
  function fr(m){return 440*Math.pow(2,(m-69)/12)}
  function pluck(m,t,dur,vol){
    var o=ctx.createOscillator(),o2=ctx.createOscillator(),o3=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain(),g3=ctx.createGain();
    o.type='sine';o.frequency.value=fr(m);o2.type='triangle';o2.frequency.value=fr(m)*2;o3.type='sine';o3.frequency.value=fr(m)*3;g2.gain.value=.16;g3.gain.value=.05;
    o.connect(g);o2.connect(g2);g2.connect(g);o3.connect(g3);g3.connect(g);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    g.connect(master);g.connect(wet);
    o.start(t);o2.start(t);o3.start(t);o.stop(t+dur+.05);o2.stop(t+dur+.05);o3.stop(t+dur+.05);
  }
  function pad(m,t,dur,vol){
    var d,o,g;
    for(d=-1;d<=1;d+=2){
      o=ctx.createOscillator();g=ctx.createGain();o.type='sine';o.frequency.value=fr(m);o.detune.value=d*5;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+1.3);g.gain.setValueAtTime(vol,t+dur-1.4);g.gain.linearRampToValueAtTime(0,t+dur);
      o.connect(g);g.connect(master);g.connect(wet);o.start(t);o.stop(t+dur+.05);
    }
  }
  function loop(t0){
    var b,i,c,t,beat=0;
    for(b=0;b<BARS;b++){
      c=CH[b];t=t0+b*4*B;
      pluck(c[0],t,4*B*.98,.2);
      for(i=0;i<4;i++) pad(c[1][i],t,4*B,.022);
      for(i=0;i<8;i++) pluck(c[1][PAT[i]],t+i*B/2,1.5,.05);
    }
    for(i=0;i<MEL.length;i++){pluck(MEL[i][0],t0+beat*B,MEL[i][1]*B+1.4,.12);beat+=MEL[i][1]}
  }
  function schedule(){
    if(!ctx) return;
    loop(nextT);nextT+=BARS*4*B;
    timer=setTimeout(schedule,Math.max(500,(nextT-ctx.currentTime-5)*1000));
  }
  function impulse(){
    var len=Math.floor(ctx.sampleRate*3.2),buf=ctx.createBuffer(2,len,ctx.sampleRate),ch,d,i;
    for(ch=0;ch<2;ch++){d=buf.getChannelData(ch);for(i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4)}
    return buf;
  }
  function ui(playing){
    btn.classList.toggle('on',playing);btn.setAttribute('aria-pressed',playing?'true':'false');
    btn.setAttribute('aria-label',playing?'Выключить музыку':'Включить музыку');
  }
  function startSynth(){
    if(on||!AC) return;
    try{
      ctx=new AC();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
      var cv=ctx.createConvolver();cv.buffer=impulse();wet=ctx.createGain();wet.gain.value=.6;wet.connect(cv);cv.connect(master);
      ctx.onstatechange=function(){if(ctx) ui(ctx.state==='running')};
      nextT=ctx.currentTime+.15;schedule();
      master.gain.setValueAtTime(0,ctx.currentTime);master.gain.linearRampToValueAtTime(.8,ctx.currentTime+2.5);
      on=true;
      if(ctx.resume) ctx.resume();
      ui(ctx.state==='running');
    }catch(e){ctx=null;return}
  }
  function stopSynth(){
    if(!on) return;
    on=false;clearTimeout(timer);
    var c=ctx,m=master;
    try{m.gain.cancelScheduledValues(c.currentTime);m.gain.setValueAtTime(m.gain.value,c.currentTime);m.gain.linearRampToValueAtTime(0,c.currentTime+.5)}catch(e){}
    c.onstatechange=null;
    setTimeout(function(){try{c.close()}catch(e){}},700);
    ctx=null;master=null;ui(false);
  }
  function unlockSynth(){if(ctx&&ctx.state!=='running'&&ctx.resume) ctx.resume()}

  /* ---- песня: файл assets/song.mp3, старт с 0:27 и по кругу; при сбое — своя мелодия ---- */
  var START=27,au=new Audio(),ytFail=false,ytWant=false,ytPlaying=false,mode='yt',failT=0,began=false;
  au.preload='auto';au.src='assets/song.mp3';
  window.__songReady=new Promise(function(res){au.addEventListener('canplaythrough',res,{once:true});au.addEventListener('error',res,{once:true});setTimeout(res,12000)});
  au.addEventListener('playing',function(){ytPlaying=true;clearTimeout(failT);if(ytWant) ui(true)});
  au.addEventListener('pause',function(){ytPlaying=false;if(mode==='yt') ui(false)});
  au.addEventListener('ended',function(){try{au.currentTime=START;au.play()}catch(e){}});
  au.addEventListener('error',function(){ytFail=true;fallback()});
  function fallback(){
    if(!ytWant||mode==='synth') return;
    mode='synth';ytFail=true;startSynth();
  }
  function ytGo(){
    var p;
    if(!began){
      began=true;
      if(au.readyState>=1){try{au.currentTime=START}catch(e){}}
      else au.addEventListener('loadedmetadata',function(){try{au.currentTime=START}catch(e){}},{once:true});
    }
    try{p=au.play();if(p&&p.catch)p.catch(function(){})}catch(e){}
  }

  function playing(){return mode==='synth'?on:ytWant}
  function start(){
    ytWant=true;
    if(ytFail){mode='synth';startSynth();return}
    mode='yt';ui(true);
    ytGo();
    clearTimeout(failT);
    failT=setTimeout(function(){if(ytWant&&!ytPlaying&&ytFail) fallback()},6000);
    setTimeout(function(){if(ytWant&&mode==='yt'&&!ytPlaying) ui(false)},1800);
  }
  function stop(){
    ytWant=false;clearTimeout(failT);
    if(mode==='yt'){try{au.pause()}catch(e){} ui(false)}
    else stopSynth();
  }
  function unlock(){
    if(mode==='yt'){if(ytWant&&!ytPlaying){ytGo()}}
    else unlockSynth();
  }
  window.olyaMusic={time:function(){return(mode==='yt'&&ytPlaying)?au.currentTime:-1},stop:function(){if(playing())stop()},start:function(){if(!playing()){btn.classList.add('touched');start()}unlock()}};
  btn.addEventListener('click',function(e){
    e.stopPropagation();btn.classList.add('touched');
    if(playing()&&mode==='yt'&&!ytPlaying){unlock();return}
    if(playing()&&mode==='synth'&&ctx&&ctx.state!=='running'){unlock();return}
    playing()?stop():start();
  });
  function done(){return mode==='yt'?ytPlaying:(ctx&&ctx.state==='running')}
  function first(e){
    if(e.target&&e.target.closest&&e.target.closest('#music')) return;
    if(!btn.classList.contains('touched')){btn.classList.add('touched');start()}
    unlock();
    setTimeout(function(){
      if(done()){
        document.removeEventListener('click',first,true);document.removeEventListener('touchend',first,true);
        document.removeEventListener('keydown',first,true);
      }
    },900);
  }
  document.addEventListener('click',first,true);
  document.addEventListener('touchend',first,true);
  document.addEventListener('keydown',first,true);
  if(!window.MUSIC_NOAUTO&&window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches){
    btn.classList.add('touched');start();
  }
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden){ if(mode==='yt'&&ytWant&&!ytPlaying){ytGo()} return }
    if(mode==='synth'&&ctx&&on){ctx.suspend&&ctx.suspend()}
  });
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&mode==='synth'&&ctx&&on){ctx.resume&&ctx.resume()}});
})();
