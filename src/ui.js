const icons = {
  heart:'<path d="M12 20s-8-4.7-8-10a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.3-8 10-8 10Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',
  sound:'<path d="m11 5-6 5H2v4h3l6 5ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 5-6 5H2v4h3l6 5ZM17 9l5 6M22 9l-5 6"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  book:'<path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9h5a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h5"/>',
  leaf:'<path d="M20 3C7 2 2 8 6 15s17 2 14-12ZM5 20 16 9"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>',
  hand:'<path d="M8 13V5a2 2 0 0 1 4 0v7-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 5-4 7-8 6l-8-7a2 2 0 0 1 3-3l3 3"/>',
  restart:'<path d="M3 10a9 9 0 1 1 1 9M3 4v6h6"/>',
  camera:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="m8 7 2-4h4l2 4"/><circle cx="12" cy="14" r="4"/>',
  pan:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M6 9a4 4 0 0 1 4-4"/>',
  tea:'<path d="m5 7 2 14h10l2-14ZM3 7h18M12 7l3-5"/><circle cx="10" cy="16" r=".5"/><circle cx="14" cy="18" r=".5"/>',
  slipper:'<path d="M7 4c5-3 9 2 10 8s-1 9-6 9S4 17 4 12s1-6 3-8ZM5 11c5-4 9-2 12 2"/>',
  bubbles:'<circle cx="9" cy="14" r="6"/><circle cx="17" cy="6" r="4"/><circle cx="19" cy="18" r="2"/>',
  bomb:'<circle cx="11" cy="14" r="8"/><path d="m14 6 2-4 4 1M19 1v4M17 3h4"/>',
  scarf:'<path d="M5 4h14v6H5ZM8 10v12h5V10m1 0v9h5v-9"/>',
  train:'<rect x="3" y="5" width="13" height="14" rx="3"/><path d="M5 3h9M7 9h5m4 4h4v6h-4"/><circle cx="7" cy="21" r="1"/><circle cx="15" cy="21" r="1"/>',
};
const svg=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.star}</svg>`;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const avatar=(kind,extra='')=>`<svg class="bear-avatar ${extra}" viewBox="0 0 150 140" fill="none" aria-hidden="true"><path d="M35 30c-20-24-41 4-20 22M115 30c20-24 41 4 20 22" fill="${kind==='bubu'?'#d49c7b':'#4b2a23'}" stroke="#4b2a23" stroke-width="5"/>${kind==='bubu'?'<path d="M25 34c-7-10-15 0-8 7m108-7c7-10 15 0 8 7" stroke="#4b2a23" stroke-width="8"/>':''}<path d="M75 18C28 18 13 36 13 72c0 18-4 27 6 37 12 12 30 13 56 13s44-1 56-13c10-10 6-19 6-37 0-36-15-54-62-54Z" fill="${kind==='bubu'?'#d49c7b':'#fffdf6'}" stroke="#4b2a23" stroke-width="5"/><circle cx="39" cy="97" r="13" fill="${kind==='bubu'?'#ffd084':'#ffb6ac'}"/><circle cx="111" cy="97" r="13" fill="${kind==='bubu'?'#ffd084':'#ffb6ac'}"/><circle cx="50" cy="81" r="5" fill="#4b2a23"/><circle cx="100" cy="81" r="5" fill="#4b2a23"/><path d="M68 88q0 8 7 3 7 5 7-3" stroke="#4b2a23" stroke-width="4" stroke-linecap="round"/>${kind==='yier'?'<path d="m65 125 10 5 10-5v13l-10-5-10 5Z" fill="#4b2a23"/>':''}</svg>`;
const stages=['阳光客厅','零食厨房','秘密庭院'];
const timeText=n=>`${String(Math.floor(Math.max(0,n||0)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,n||0)%60)).padStart(2,'0')}`;

export class UI {
  constructor(callbacks={}) {
    this.callbacks=callbacks;this.character='yier';this.muted=false;this.lastWeapons='';this.toastTimer=0;
    this.overlay=document.createElement('div');this.overlay.id='overlay';document.body.append(this.overlay);
    this.hud=document.createElement('div');this.hud.id='hud';this.hud.hidden=true;document.body.append(this.hud);
    this.touch=document.createElement('div');this.touch.id='touch-controls';this.touch.hidden=true;
    this.touch.innerHTML=`<div id="look-zone" aria-label="拖动转动视角"></div><div id="move-zone" aria-label="左侧任意位置拖动移动"><span class="move-hint">左侧任意位置拖动 · 移动</span></div><div id="joystick" aria-hidden="true" hidden><div class="joystick-cross"></div><div id="joystick-knob"></div></div><div class="touch-actions"><button id="interact-btn" aria-label="与场景互动">${svg('hand')}<span>互动</span></button><button id="skill-btn" aria-label="释放角色技能">${svg('bolt')}<span>技能</span><i id="skill-cooldown"></i></button></div><span class="look-hint">右侧滑动 · 转动视角</span>`;
    document.body.append(this.touch);
    this.toastEl=document.createElement('div');this.toastEl.id='toast';this.toastEl.setAttribute('role','status');document.body.append(this.toastEl);
  }
  shell(mode,content){this.overlay.hidden=false;this.overlay.dataset.mode=mode;this.overlay.style.backgroundImage=mode==='menu'?`linear-gradient(90deg,rgba(250,244,229,.92) 0%,rgba(250,244,229,.64) 29%,rgba(250,244,229,.04) 58%,rgba(225,212,184,.12) 100%),url('${import.meta.env.BASE_URL}art/tiny-world.jpg')`:'';this.overlay.innerHTML=content;}
  bind(selector,event,fn){this.overlay.querySelector(selector)?.addEventListener(event,fn);}
  showMenu(){
    this.hud.hidden=true;this.touch.hidden=true;
    this.shell('menu',`<div class="menu-layout"><div class="brand-corner"><span class="brand-mark">${svg('leaf')}</span><span>一二布布的世界<small>把日常，变成冒险</small></span></div><section class="menu-copy"><div class="eyebrow"><span></span> 缩小一点，快乐大一点</div><h1>小小<br><span>大冒险</span><i>✦</i></h1><div class="hero-rule"></div><p>爬上书本高台，借弹跳越过包围。<br>和一二布布一起，把家变成冒险乐园。</p><div class="menu-meta"><span>${svg('star')} 随机构筑</span><span>${svg('leaf')} 生活机关</span><span>${svg('heart')} 高低冒险</span></div></section><section class="launch-panel"><div class="panel-heading"><span class="eyebrow">冒险准备室</span><span class="chapter-pill">01 — 03</span></div><h2>今天，谁来出发？</h2><p class="muted">选择你的冒险搭档</p><div class="character-grid"><button class="character-card ${this.character==='yier'?'selected':''}" data-character="yier"><span class="selection-dot"></span>${avatar('yier')}<strong>一二</strong><span class="character-role">灵巧 · 突进</span><small>蹦蹦突进，穿过包围</small></button><button class="character-card ${this.character==='bubu'?'selected':''}" data-character="bubu"><span class="selection-dot"></span>${avatar('bubu')}<strong>布布</strong><span class="character-role">守护 · 反击</span><small>抱枕反击，稳稳开路</small></button></div><div class="skill-summary"><span class="skill-emblem">${svg('bolt')}</span><div><strong id="selected-skill">${this.character==='yier'?'蹦蹦突进':'抱枕反击'}</strong><p id="selected-description">${this.character==='yier'?'短距离冲刺，突破敌人的包围。':'短暂守护后释放冲击，推开附近敌人。'}</p></div></div><button class="primary-button start-button" id="start-game"><span>开始冒险<small>自动瞄准 · 高台弹跳 · 爽快连击</small></span>${svg('arrow')}</button><div class="menu-tools"><button id="help-button">${svg('book')} 怎么玩</button><button id="sound-button" aria-label="切换声音">${svg(this.muted?'mute':'sound')}<span>${this.muted?'声音关':'声音开'}</span></button><label class="quality-control">画质<select id="quality-select" aria-label="画质"><option value="high">精致</option><option value="low">流畅</option></select></label></div></section><footer class="menu-footer"><span>一二布布 · 小小大冒险</span><span>非商业同人作品 · 角色原作 黄小B</span><span class="desktop-only">耳机戴好，冒险就要开始了 ${svg('sound')}</span></footer></div>`);
    this.overlay.querySelectorAll('[data-character]').forEach(el=>el.addEventListener('click',()=>{this.character=el.dataset.character;this.overlay.querySelectorAll('[data-character]').forEach(c=>c.classList.toggle('selected',c===el));this.overlay.querySelector('#selected-skill').textContent=this.character==='yier'?'蹦蹦突进':'抱枕反击';this.overlay.querySelector('#selected-description').textContent=this.character==='yier'?'短距离冲刺，突破敌人的包围。':'短暂守护后释放冲击，推开附近敌人。';this.callbacks.onCharacterSelect?.(this.character);}));
    this.bind('#start-game','click',()=>this.callbacks.onStart?.(this.character));
    this.bind('#help-button','click',()=>this.showHelp());
    this.bind('#sound-button','click',()=>{this.muted=!this.muted;this.callbacks.onMute?.(this.muted);const b=this.overlay.querySelector('#sound-button');b.innerHTML=`${svg(this.muted?'mute':'sound')}<span>${this.muted?'声音关':'声音开'}</span>`;});
    this.bind('#quality-select','change',e=>this.callbacks.onQuality?.(e.target.value));
  }
  showHelp(){
    this.shell('help',`<div class="modal-wrap"><section class="help-panel modal-panel"><button class="close-button" id="close-help" aria-label="关闭">${svg('close')}</button><span class="eyebrow">冒险小手册</span><h2>小身体，大本领。</h2><p class="muted">横屏时视野最开阔。武器会自动瞄准，你只需移动走位、收集成长，巧妙利用坡道与高台。</p><div class="help-grid"><article><span class="help-number">01</span><h3>移动与视角</h3><p class="desktop-copy"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 或方向键移动，拖动鼠标或按 Q/E 调整镜头。<kbd>空格</kbd>释放技能。</p><p class="mobile-copy">将手机横过来，在屏幕左侧任意位置按住并拖动即可移动，松手停止；右侧滑动调整镜头。点击闪电按钮释放角色技能。</p></article><article><span class="help-number">02</span><h3>武器与成长</h3><p>击败敌人后收集经验，升级时三选一。不同武器与能力会产生不同的战斗方式。</p></article><article><span class="help-number">03</span><h3>让房间帮你战斗</h3><p>靠近带光圈的机关，按 <kbd>F</kbd> 或点击互动。风扇、多米诺、零食罐都有惊喜。</p></article><article><span class="help-number">04</span><h3>把高低差变成优势</h3><p>沿坡道登上高台，利用弹跳机关越过包围。腾空落地会掀起震波；连续击败敌人，保持清场节奏！</p></article></div><button class="primary-button" id="help-back">准备好了 ${svg('arrow')}</button></section></div>`);
    this.bind('#close-help','click',()=>this.showMenu());this.bind('#help-back','click',()=>this.showMenu());
  }
  startHUD(character='yier'){
    this.character=character;this.lastWeapons='';this.hideOverlay();this.hud.hidden=false;this.touch.hidden=false;
    this.hud.innerHTML=`<div class="hud-top"><section class="player-panel"><div class="player-avatar">${avatar(character)}</div><div class="player-info"><div class="player-label"><strong>${character==='bubu'?'布布':'一二'}</strong><span id="level-label">等级 1</span><span id="shield-label"></span></div><div class="health-track"><div id="health-fill"></div></div><div class="health-numbers"><span id="hp-label">100 / 100</span><span>生命</span></div></div></section><section class="stage-panel"><span class="stage-kicker" id="stage-kicker">第一章</span><strong id="stage-label">阳光客厅</strong><span class="stage-time" id="time-label">00:00</span></section><div class="hud-actions"><div class="currency-pill">${svg('coin')}<span id="currency-label">0</span></div><button class="icon-button" id="pause-button" aria-label="暂停游戏">${svg('pause')}</button></div></div><div class="objective-pill"><span class="pulse-dot"></span><span id="objective-label">探索房间，收集经验</span></div><div class="combat-strip"><div id="combo-panel" class="combo-panel" hidden><div class="combo-main"><strong id="combo-count">0</strong><span>连击<small id="combo-caption">越来越顺</small></span></div><div class="combo-track"><i id="combo-fill"></i></div></div><div id="terrain-panel" class="terrain-panel" hidden><span class="terrain-symbol">↥</span><div><strong id="terrain-label">高地优势</strong><small id="terrain-caption">视野更开阔</small></div><span id="terrain-height"></span></div></div><div class="boss-panel" id="boss-panel" hidden><div><strong id="boss-name">发条玩具国王</strong><span id="boss-hp-label"></span></div><div class="boss-track"><i id="boss-fill"></i></div></div><div class="hud-bottom"><div class="weapon-section"><span class="hud-caption">我的装备</span><div id="weapon-slots"></div></div><div class="desktop-skill"><span class="skill-key">空格</span><div><strong>${character==='yier'?'蹦蹦突进':'抱枕反击'}</strong><span id="desktop-skill-status">技能就绪</span></div>${svg('bolt')}</div><div class="desktop-controls"><span><kbd>WASD</kbd> 移动</span><span>拖动鼠标 转向</span><span><kbd>F</kbd> 互动</span><span><kbd>Esc</kbd> 暂停</span></div></div><div class="experience-track"><div id="xp-fill"></div><span id="xp-label">下一次成长</span></div><div id="interact-prompt" hidden><kbd>F</kbd><span id="interact-text">互动</span></div><div class="kill-pill">${svg('star')}<span id="kills-label">0</span> 击败</div><div class="crosshair"><span></span></div><div id="threat-indicators" aria-hidden="true"></div>`;
    this.hud.querySelector('#pause-button').addEventListener('click',()=>this.callbacks.onPause?.());
  }
  update(s={}){
    this.lastState=s;
    if(this.hud.hidden)return;
    const el=id=>this.hud.querySelector(`#${id}`);
    const set=(id,value)=>{const e=el(id);if(e)e.textContent=value;};
    const hp=Math.max(0,s.hp??100), max=Math.max(1,s.maxHp??100);
    el('health-fill').style.width=`${Math.min(100,hp/max*100)}%`;
    el('health-fill').classList.toggle('critical',hp/max<.3);
    set('hp-label',`${Math.ceil(hp)} / ${Math.ceil(max)}`);set('level-label',`等级 ${s.level||1}`);
    set('shield-label',s.shield>0?`护盾 ${Math.ceil(s.shield)}`:'');
    set('stage-label',typeof s.stage==='string'?s.stage:stages[s.stage||0]||'最终挑战');
    set('stage-kicker',`第${['一','二','三'][Number(s.stage)||0]||'三'}章`);set('time-label',timeText(s.time));
    set('kills-label',s.kills||0);set('currency-label',s.currency||0);set('objective-label',s.objective||'收集经验，让自己变得更强');
    const combat=s.run||s,combo=Math.max(0,Math.floor(combat.comboCount||0)),comboTime=Math.max(0,combat.comboTimer||0),comboPanel=el('combo-panel');
    comboPanel.hidden=combo<2||comboTime<=0;
    if(!comboPanel.hidden){
      set('combo-count',combo);set('combo-caption',combo>=30?'全场沸腾':combo>=15?'势不可挡':combo>=8?'越来越顺':'保持节奏');
      el('combo-fill').style.transform=`scaleX(${Math.min(1,comboTime/Math.max(.1,combat.comboMaxTimer||3.5))})`;
      comboPanel.dataset.tier=combo>=30?'4':combo>=15?'3':combo>=8?'2':'1';
      if(combo>this.lastCombo)el('combo-count').animate?.([{transform:'scale(1.22)'},{transform:'scale(1)'}],{duration:180,easing:'ease-out'});
    }
    this.lastCombo=combo;
    const elevation=Math.max(0,combat.elevation||0),airborne=!!combat.airborne,highGround=!!combat.highGround,terrain=el('terrain-panel');
    terrain.hidden=!airborne&&!highGround&&elevation<.45&&!(combat.bonusXPTime>0);
    if(!terrain.hidden){terrain.classList.toggle('airborne',airborne);set('terrain-label',airborne?'腾空蓄势':highGround?'高地优势':'星星加成');set('terrain-caption',combat.bonusXPTime>0?`经验 ×2 · ${Math.ceil(combat.bonusXPTime)} 秒`:airborne?'准备落地震波':'远程高打低 +20%');set('terrain-height',elevation>0?`${elevation.toFixed(1)}m`:'');}

    el('xp-fill').style.width=`${Math.max(0,Math.min(100,(s.xp||0)/Math.max(1,s.xpNext||1)*100))}%`;
    set('xp-label',`${Math.floor(s.xp||0)} / ${Math.ceil(s.xpNext||1)}`);
    const boss=el('boss-panel');boss.hidden=!(s.bossMaxHp>0);if(!boss.hidden){el('boss-fill').style.width=`${Math.max(0,s.bossHp/s.bossMaxHp*100)}%`;set('boss-hp-label',`${Math.max(0,Math.ceil(s.bossHp))}`);set('boss-name',s.bossName||'发条玩具国王');}
    const slots=s.weaponSlots||[],key=JSON.stringify(slots);if(key!==this.lastWeapons){this.lastWeapons=key;el('weapon-slots').innerHTML=Array.from({length:3},(_,i)=>slots[i]?`<div class="weapon-slot filled" title="${escapeHTML(slots[i].name)}"><span class="weapon-symbol">${svg(slots[i].id)}</span><div><strong>${escapeHTML(slots[i].name)}</strong><small>${'●'.repeat(Math.min(5,slots[i].level||1))}${'○'.repeat(Math.max(0,5-(slots[i].level||1)))}</small></div></div>`:`<div class="weapon-slot empty"><span>＋</span><small>待发现</small></div>`).join('');}
    const ready=s.skillReady??s.skillCD<=0;const cd=Math.max(0,Math.ceil(s.skillCD||0));
    set('desktop-skill-status',ready?'技能就绪':`${cd} 秒后就绪`);
    const skill=document.getElementById('skill-btn');skill.classList.toggle('cooling',!ready);skill.setAttribute('aria-label',ready?'释放角色技能':`技能冷却 ${cd} 秒`);document.getElementById('skill-cooldown').textContent=ready?'':cd;
    const threats=(s.threats||[]).filter(t=>Number.isFinite(t.angle)).slice(0,3);
    const threatLayer=el('threat-indicators');
    const rear=threats.map(t=>{const a=t.angle,dist=Math.max(0,t.distance||0),x=50+Math.sin(a)*43,y=50-Math.cos(a)*37;return `<span class="threat-indicator ${dist<4?'urgent':''}" style="left:${x}%;top:${y}%;--angle:${a}rad"><i>▲</i><small>${dist<4?'靠近':'后方'}</small></span>`;}).join('');
    if(threatLayer&&threatLayer.innerHTML!==rear)threatLayer.innerHTML=rear;
    const label=s.interactLabel||'';el('interact-prompt').hidden=!label;set('interact-text',label);const ib=document.getElementById('interact-btn');ib.classList.toggle('available',!!label);ib.querySelector('span').textContent=label?'互动':'靠近机关';
  }
  choiceCard(c,index){return `<button class="choice-card" data-choice="${index}" style="--choice-color:${/^#[0-9a-f]{3,8}$/i.test(c.color||'')?c.color:'#e88a69'}"><span class="choice-tag">${escapeHTML(c.tag||'成长选择')}</span><span class="choice-icon">${svg(icons[c.icon]?c.icon:icons[c.id]?c.id:'star')}</span><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.description)}</p><span class="choice-action">选择这项能力 ${svg('arrow')}</span></button>`;}
  showChoices(choices,title='成长时刻',subtitle='选择一项能力，让冒险变得不一样。'){
    this.shell('choices',`<div class="modal-wrap"><section class="choices-panel"><div class="choice-heading"><span class="eyebrow">每一步，都有新惊喜</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle)}</p></div><div class="choices-grid">${choices.map((c,i)=>this.choiceCard(c,i)).join('')}</div><p class="choice-footnote">时间已暂停，慢慢选。</p></section></div>`);
    this.overlay.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{b.disabled=true;this.callbacks.onChoose?.(choices[Number(b.dataset.choice)]);}));
  }
  showStageClear(stage=0,choices=[]){
    const currency=Math.floor(this.lastState?.currency||0),canBuy=currency>=30;
    this.shell('stage-clear',`<div class="modal-wrap"><section class="stage-clear-panel modal-panel"><span class="completion-seal">${svg('leaf')}</span><span class="eyebrow">${escapeHTML(stages[Number(stage)]||stage||'这个房间')} · 完成</span><h2>星星补给站</h2><p class="muted">选择一项升级（30 零食币），或保留零食币继续出发。</p><div class="shop-balance">${svg('coin')} 当前拥有 <strong>${currency}</strong> 零食币 ${canBuy?'':'<span>· 零食币不足，可以跳过补给</span>'}</div>${choices.length?`<div class="choices-grid compact ${canBuy?'':'cannot-buy'}">${choices.map((c,i)=>this.choiceCard({...c,tag:'30 零食币 · 购买并出发'},i)).join('')}</div>`:'<div class="chapter-path"><span class="done">客厅</span><i></i><span>厨房</span><i></i><span>庭院</span></div>'}<button class="primary-button" id="next-stage">跳过补给，前往${stages[(Number(stage)||0)+1]||'下一场冒险'} ${svg('arrow')}</button><p class="shop-note">购买后自动前往下一关 · 每站限选一项</p></section></div>`);
    this.bind('#next-stage','click',()=>this.callbacks.onNextStage?.());
    this.overlay.querySelectorAll('[data-choice]').forEach(b=>{b.disabled=!canBuy;b.addEventListener('click',()=>{if(!canBuy)return;b.disabled=true;this.callbacks.onChoose?.(choices[Number(b.dataset.choice)]);});});
  }
  showPause(){
    this.shell('pause',`<div class="modal-wrap"><section class="pause-panel modal-panel"><div class="pause-symbol">${svg('pause')}</div><span class="eyebrow">休息一下也没关系</span><h2>冒险，稍等一下。</h2><p class="muted">这个小世界会在这里等你。</p><button class="primary-button" id="resume-game">继续冒险 ${svg('play')}</button><button class="secondary-button" id="restart-game">${svg('restart')} 重新出发</button><button class="text-button" id="back-menu">返回准备室</button></section></div>`);
    this.bind('#resume-game','click',()=>this.callbacks.onResume?.());this.bind('#restart-game','click',()=>this.callbacks.onRestart?.());this.bind('#back-menu','click',()=>this.callbacks.onMenu?this.callbacks.onMenu():this.showMenu());
  }
  showResult(win,stats={}){
    this.touch.hidden=true;
    const kills=stats.kills??0,time=stats.time??0,level=stats.level??1;
    this.shell('result',`<div class="modal-wrap"><section class="result-panel modal-panel"><div class="result-art">${avatar(this.character)}<span>${win?'✦':'♡'}</span></div><span class="eyebrow">${win?'今天的你，超级了不起':'每次出发，都在变得更勇敢'}</span><h2>${win?'小小英雄，大大胜利！':'先抱抱，再出发。'}</h2><p class="muted">${win?'家里的每一个角落，都留下了你的冒险故事。':'带着这次的发现，下次一定能走得更远。'}</p><div class="result-stats"><div><strong>${timeText(time)}</strong><span>冒险时间</span></div><div><strong>${kills}</strong><span>击败敌人</span></div><div><strong>${level}</strong><span>成长等级</span></div></div><button class="primary-button" id="result-restart">再来一场冒险 ${svg('restart')}</button><button class="text-button" id="result-menu">返回准备室</button></section></div>`);
    this.bind('#result-restart','click',()=>this.callbacks.onRestart?.());this.bind('#result-menu','click',()=>this.callbacks.onMenu?this.callbacks.onMenu():this.showMenu());
  }
  hideOverlay(){this.overlay.hidden=true;this.overlay.dataset.mode='';}
  toast(text){clearTimeout(this.toastTimer);this.toastEl.textContent=text;this.toastEl.classList.add('visible');this.toastTimer=setTimeout(()=>this.toastEl.classList.remove('visible'),3200);}
}
