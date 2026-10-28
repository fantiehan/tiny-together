// Small, layered Web Audio instruments. No downloaded audio or network needed.
export class Audio {
 constructor(){
  this.ctx=null;this.master=null;this.voices=0;this.maxVoices=28;this.tick=0;this.note=0;this.eventTimes=new Map();this.globalEvents=[];
  try{this.muted=localStorage.getItem('tiny-muted')==='1';}catch{this.muted=false;}
 }
 unlock(){
  try{
   if(!this.ctx){
    this.ctx=new(window.AudioContext||window.webkitAudioContext)();
    this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.22;
    const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=15;limiter.ratio.value=7;limiter.attack.value=.003;limiter.release.value=.16;
    this.master.connect(limiter);limiter.connect(this.ctx.destination);
    this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);
    const data=this.noiseBuffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+white*.035)/1.035;data[i]=last*3.4;}
   }
   if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
  }catch{}
 }
 toggle(){this.muted=!this.muted;if(this.master&&this.ctx)this.master.gain.setTargetAtTime(this.muted?0:.22,this.ctx.currentTime,.035);try{localStorage.setItem('tiny-muted',this.muted?'1':'0');}catch{}return this.muted;}
 tone(freq,duration=.12,type='sine',vol=.3,slide=0,delay=0){
  if(!this.ctx||this.muted||this.voices>=this.maxVoices)return;
  const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();this.voices++;
  o.type=type;o.frequency.setValueAtTime(Math.max(25,freq),t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(25,freq+slide),t+duration);
  const attack=Math.min(.008,duration*.12);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.015);
  o.onended=()=>{o.disconnect();g.disconnect();this.voices=Math.max(0,this.voices-1);};
 }
 noise(duration=.12,vol=.2,cutoff=1200,delay=0,kind='lowpass'){
  if(!this.ctx||this.muted||this.voices>=this.maxVoices)return;
  const c=this.ctx,t=c.currentTime+delay,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();this.voices++;
  source.buffer=this.noiseBuffer;filter.type=kind;filter.frequency.setValueAtTime(cutoff,t);filter.Q.value=.6;
  gain.gain.setValueAtTime(Math.max(.0002,vol),t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t,Math.random()*.5);source.stop(t+duration+.015);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};
 }
 allowed(name){
  if(!this.ctx||this.muted)return false;
  const now=this.ctx.currentTime;
  const spacing={hit:.055,shoot:.07,pan:.15,tea:.085,slipper:.17,bubbles:.11,bubble:.11,bomb:.2,blast:.2,camera:.16,scarf:.15,train:.18,critical:.11,crit:.11,block:.15,shield:.15,land:.2,landing:.2,combo:.19,pickup:.07,hurt:.22,skill:.2,level:.25,win:.4,click:.06};
  if(now-(this.eventTimes.get(name)??-10)<(spacing[name]??.1))return false;
  this.globalEvents=this.globalEvents.filter(t=>now-t<.08);
  const priority=['hurt','land','landing','block','shield','skill','level','win','combo'].includes(name);
  if(!priority&&this.globalEvents.length>=5)return false;
  this.eventTimes.set(name,now);this.globalEvents.push(now);return true;
 }
 play(name,options={}){
  if(!this.allowed(name))return;
  if(typeof options==='number')options={count:options};
  const v=Math.max(.35,Math.min(1.35,options.intensity??1)),j=.96+Math.random()*.08;
  const tone=(f,d,t='sine',a=.2,s=0,delay=0)=>this.tone(f*j,d,t,a*v,s,delay);
  switch(name){
   // Inharmonic overtones give the pan a soft metal clang, with a low impact underneath.
   case 'pan':tone(225,.065,'triangle',.35,-95);tone(690,.16,'sine',.2,-70);tone(1077,.095,'sine',.1,-140);this.noise(.045,.17*v,2500);break;
   // A pearl's small round pop and glassy tail differ from a generic laser sound.
   case 'tea':tone(520,.065,'sine',.16,-230);tone(1280,.08,'sine',.055,-380,.015);this.noise(.018,.075*v,3800);break;
   case 'slipper':this.noise(.12,.22*v,1800,0,'bandpass');tone(170,.07,'triangle',.11,-60);break;
   case 'bubbles':case 'bubble':tone(370,.095,'sine',.22,600);tone(1070,.085,'sine',.09,-430,.045);break;
   case 'bomb':case 'blast':this.noise(.28,.48*v,620);this.noise(.11,.16*v,2200);tone(105,.27,'triangle',.46,-72);tone(47,.3,'sine',.17,-17,.025);break;
   case 'camera':this.noise(.035,.21*v,4200);this.noise(.045,.15*v,2600,.065);tone(920,.06,'triangle',.09,-300);break;
   case 'scarf':this.noise(.1,.15*v,1000,0,'bandpass');tone(275,.12,'sine',.08,160);break;
   case 'train':tone(330,.1,'triangle',.11,20);tone(494,.12,'sine',.08,35,.04);this.noise(.08,.13*v,1500,.04);break;
   case 'shoot':tone(470,.06,'sine',.075,190);this.noise(.025,.06*v,2400);break;
   case 'hit':tone(170,.065,'triangle',.14,-85);this.noise(.032,.09*v,1700);break;
   case 'critical':case 'crit':tone(220,.07,'triangle',.23,-80);tone(1175,.11,'sine',.14,200);tone(1568,.13,'sine',.075,-120,.025);this.noise(.04,.14*v,3000);break;
   case 'block':case 'shield':tone(420,.17,'sine',.2,130);tone(845,.22,'sine',.13,240);this.noise(.06,.13*v,3000,0,'highpass');break;
   case 'land':case 'landing':tone(82,.25,'triangle',.42,-47);this.noise(.3,.4*v,510);tone(180,.1,'sine',.17,-120,.025);this.noise(.09,.12*v,1800,.03);break;
   case 'combo':{const step=Math.min(12,Math.max(0,Math.floor((options.count??5)/5)-1)),f=392*Math.pow(2,step/12);tone(f,.16,'sine',.18,20);tone(f*1.25,.14,'sine',.12,30,.045);tone(f*1.5,.22,'sine',.1,30,.09);break;}
   case 'pickup':tone(870,.07,'sine',.065,210);break;
   case 'hurt':tone(130,.17,'triangle',.28,-70);this.noise(.105,.18*v,1000);break;
   case 'skill':tone(260,.22,'sine',.22,530);tone(520,.25,'triangle',.1,300,.06);this.noise(.13,.15*v,2300);break;
   case 'level':tone(523,.19,'sine',.23,0);tone(659,.2,'sine',.19,0,.09);tone(784,.3,'sine',.18,0,.18);tone(1047,.37,'sine',.11,0,.26);break;
   case 'win':[523,659,784,1047].forEach((f,i)=>tone(f,.5,'triangle',.13,0,i*.13));break;
   case 'click':tone(440,.055,'sine',.14,80);break;
  }
 }
 update(dt){
  if(!this.ctx||this.muted)return;
  this.tick-=dt;if(this.tick>0)return;this.tick=.48;
  // Quiet celesta phrase leaves room for distinct combat transients.
  const notes=[261.63,0,329.63,392,0,523.25,440,0,392,0,329.63,293.66,0,329.63,392,0,261.63,0,329.63,392,0,587.33,523.25,0,392,0,329.63,293.66,0,261.63,0,0],index=this.note++%notes.length,f=notes[index];
  if(f){this.tone(f,.55,'sine',.038);this.tone(f*2,.22,'sine',.009);}
  if(index%8===0)this.tone([130.81,164.81,146.83,130.81][Math.floor(index/8)],1.3,'sine',.028);
 }
}
