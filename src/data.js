export const STAGES = [
 {name:'沙发下的远征',place:'客厅 · 晨光地毯',duration:150,color:0xe8c9a6,story:'一觉醒来，沙发变成了山。沿着晨光，找回让世界恢复原样的星星。',boss:'积木守卫'},
 {name:'甜蜜的危机',place:'厨房 · 零食王国',duration:165,color:0xc5ddd1,story:'蜂蜜流成了小河。借用水壶的力量，穿过醒来的零食王国。',boss:'饼干大队长'},
 {name:'花园里的愿望',place:'庭院 · 午后花园',duration:180,color:0xd5e4ac,story:'最后一颗星星藏在花园。小小的勇气，也能赶走大大的麻烦。',boss:'发条玩具国王'}
];
export const WEAPONS = {
 pan:{id:'pan',name:'平底锅',icon:'◒',color:'#d19b75',tag:'近战 · 击退',description:'向前横扫，拍开身边敌人。升级扩大范围并增加连击。',damage:22,cooldown:1.05,range:3.5,evolution:'流星煎锅'},
 tea:{id:'tea',name:'珍珠奶茶',icon:'⦿',color:'#bba1d1',tag:'连射 · 穿透',description:'三连发珍珠，自动瞄准前方。升级增加穿透与连射。',damage:9,cooldown:0.7,range:15,evolution:'珍珠加倍'},
 slipper:{id:'slipper',name:'回旋拖鞋',icon:'↶',color:'#e89c91',tag:'回旋 · 贯穿',description:'拖鞋飞出后回到身边。边移动边改变返回路线。',damage:18,cooldown:1.9,range:12,evolution:'拖鞋风暴'},
 bubbles:{id:'bubbles',name:'泡泡机',icon:'◌',color:'#90c9ce',tag:'控场 · 爆裂',description:'放出漂浮泡泡，减速敌人。泡泡碰撞后产生范围伤害。',damage:12,cooldown:1.35,range:10,evolution:'梦幻泡泡雨'},
 bomb:{id:'bomb',name:'闹钟炸弹',icon:'◷',color:'#dfa362',tag:'延时 · 爆炸',description:'在身后留下闹钟。把追兵引入爆炸圈！',damage:45,cooldown:2.8,range:4,evolution:'准点大爆炸'},
 camera:{id:'camera',name:'拍立得',icon:'▣',color:'#94bca2',tag:'蓄力 · 群体',description:'闪光覆盖前方大片区域，聚怪后拍下精彩瞬间。',damage:32,cooldown:2.9,range:9,evolution:'快乐三连拍'},
 scarf:{id:'scarf',name:'牵牵围巾',icon:'∞',color:'#d69cba',tag:'环绕 · 守护',description:'柔软围巾环绕攻击。控制距离，让外圈擦过敌群。',damage:11,cooldown:0.65,range:2.8,evolution:'抱抱旋风'},
 train:{id:'train',name:'玩具列车',icon:'▰',color:'#8eb4cf',tag:'轨迹 · 冲撞',description:'列车沿你走过的路线前进，利用回转路线撞击追兵。',damage:26,cooldown:2.5,range:12,evolution:'布布特快'}
};
export const ABILITIES = {
 power:{id:'power',name:'再来一口',icon:'✦',color:'#dc9476',tag:'伤害',description:'所有武器伤害 +18%。',stat:'damage',amount:.18},
 haste:{id:'haste',name:'快乐加速',icon:'»',color:'#dbb65b',tag:'攻速',description:'所有武器攻击速度 +15%。',stat:'haste',amount:.15},
 range:{id:'range',name:'大大的拥抱',icon:'◎',color:'#cf9ab9',tag:'范围',description:'攻击范围与爆炸半径 +14%。',stat:'area',amount:.14},
 speed:{id:'speed',name:'一路小跑',icon:'↗',color:'#8cbbab',tag:'移动',description:'移动速度 +10%，冲出包围更轻松。',stat:'speed',amount:.1},
 health:{id:'health',name:'软乎乎',icon:'♡',color:'#d59391',tag:'生存',description:'最大生命 +20，立即恢复 20 点生命。',stat:'maxHp',amount:20},
 magnet:{id:'magnet',name:'零食磁铁',icon:'⊙',color:'#b8a1d0',tag:'拾取',description:'经验拾取半径 +40%。',stat:'magnet',amount:.4},
 regen:{id:'regen',name:'午后小憩',icon:'☼',color:'#c4b46c',tag:'恢复',description:'每秒恢复 0.5 点生命。',stat:'regen',amount:.5},
 armor:{id:'armor',name:'抱紧一点',icon:'◇',color:'#91b5cb',tag:'防御',description:'受到的伤害降低 10%（上限 50%）。',stat:'armor',amount:.1},
 crit:{id:'crit',name:'惊喜时刻',icon:'✧',color:'#e2b66f',tag:'暴击',description:'暴击几率 +12%，暴击造成双倍伤害。',stat:'crit',amount:.12},
 chain:{id:'chain',name:'快乐传染',icon:'⌁',color:'#9fbd84',tag:'连锁',description:'击败敌人有概率引发一次小型爆炸。',stat:'chain',amount:.2},
 leech:{id:'leech',name:'甜甜补给',icon:'♥',color:'#d88999',tag:'回复',description:'每击败 10 名敌人恢复 3 点生命。',stat:'leech',amount:3},
 shield:{id:'shield',name:'安心泡泡',icon:'⬡',color:'#8fcac2',tag:'护盾',description:'进入新区域时获得 25 护盾，立即补充 25。',stat:'shieldBonus',amount:25},
 skill:{id:'skill',name:'默契满满',icon:'✺',color:'#b7a0c8',tag:'技能',description:'角色技能冷却缩短 18%。',stat:'skillHaste',amount:.18},
 lucky:{id:'lucky',name:'小小幸运',icon:'✿',color:'#b2bc6b',tag:'成长',description:'经验获取 +20%。',stat:'luck',amount:.2}
};
export const ENEMIES={
 crumb:{hp:25,speed:1.7,damage:7,r:.4,xp:3},runner:{hp:22,speed:2.1,damage:10,r:.35,xp:4},
 shooter:{hp:35,speed:1.25,damage:8,r:.45,xp:5},tank:{hp:110,speed:.9,damage:14,r:.65,xp:9},
 splitter:{hp:45,speed:1.6,damage:8,r:.5,xp:6},boss:{hp:1200,speed:1.15,damage:18,r:1.25,xp:70}
};
export function makeRun(kind='yier') {return {kind,hp:kind==='bubu'?120:100,maxHp:kind==='bubu'?120:100,shield:0,xp:0,xpNext:12,level:1,stage:0,time:0,totalTime:0,kills:0,currency:0,damage:1,haste:1,area:1,speed:1,magnet:1,regen:0,armor:0,crit:.05,chain:0,leech:0,shieldBonus:0,skillHaste:0,luck:1,skillCD:0,weapons:[{id:kind==='bubu'?'pan':'tea',level:1,timer:.1}],abilities:{},interactions:0};}
export function rollChoices(run,random=Math.random) {
 const all=[];
 for (const w of Object.values(WEAPONS)) {const own=run.weapons.find(x=>x.id===w.id);if(own&&own.level<5) all.push({...w,type:'weapon',tag:own.level===4?'进化 · Lv.5':`升级 · Lv.${own.level+1}`,description:own.level===4?`进化为「${w.evolution}」，攻击形态全面强化。`:`${w.description} 伤害与弹道进一步提升。`});else if(!own&&run.weapons.length<3)all.push({...w,type:'weapon',tag:'新武器 · 占用一格'});}
 for(const a of Object.values(ABILITIES))if((run.abilities[a.id]||0)<4)all.push({...a,type:'ability'});
 const picked=[];const owned=all.filter(x=>x.type==='weapon'&&run.weapons.some(w=>w.id===x.id));
 if(owned.length)picked.push(owned[Math.floor(random()*owned.length)]);
 while(picked.length<3&&all.length){const available=all.filter(x=>!picked.some(p=>p.id===x.id));if(!available.length)break;picked.push(available[Math.floor(random()*available.length)]);}
 return picked.length?picked:[{type:'heal',id:'snack-heal',name:'甜甜补给',icon:'♥',color:'#d88999',tag:'恢复',description:'立即恢复 30 点生命。'}];
}
export function applyChoice(run,c){
 if(c.type==='weapon'){const own=run.weapons.find(w=>w.id===c.id);if(own){own.level=Math.min(5,own.level+1);}else if(run.weapons.length<3)run.weapons.push({id:c.id,level:1,timer:.2});}
 else if(c.type==='ability'&&ABILITIES[c.id]) {const a=ABILITIES[c.id];if((run.abilities[c.id]||0)>=4)return;run.abilities[c.id]=(run.abilities[c.id]||0)+1;run[a.stat]+=a.amount;if(c.id==='health')run.hp=Math.min(run.maxHp,run.hp+20);if(c.id==='shield')run.shield+=25;}
 else if(c.type==='heal'&&c.id==='snack-heal')run.hp=Math.min(run.maxHp,run.hp+30);
}
export function awardXP(run,amount){run.xp+=amount*run.luck;let count=0;while(run.xp>=run.xpNext){run.xp-=run.xpNext;run.level++;run.xpNext=Math.floor(12+run.level*6+run.level**1.4);count++;}return count;}
export function mitigateDamage(run,raw){const damage=raw*(1-Math.min(.5,run.armor));const absorb=Math.min(run.shield,damage);run.shield-=absorb;run.hp=Math.max(0,run.hp-(damage-absorb));return damage-absorb;}
export function moveWithCollisions(x,z,dx,dz,r,obstacles,bounds){
 const minX=bounds.minX+r,maxX=bounds.maxX-r,minZ=bounds.minZ+r,maxZ=bounds.maxZ-r,epsilon=1e-7;
 const clamp=p=>({x:Math.max(minX,Math.min(maxX,p.x)),z:Math.max(minZ,Math.min(maxZ,p.z))});
 const target=clamp({x:x+dx,z:z+dz});
 const clear=p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=minX-epsilon&&p.x<=maxX+epsilon&&p.z>=minZ-epsilon&&p.z<=maxZ+epsilon&&obstacles.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=r+o.r-epsilon);
 let point={...target};
 if(clear(point))return point;
 // Repeated projections usually resolve small frame-to-frame overlaps cheaply.
 // Re-clamping alone is insufficient when an obstacle meets the arena edge.
 for(let pass=0;pass<8;pass++){
  for(const o of obstacles){
   const vx=point.x-o.x,vz=point.z-o.z,d=Math.hypot(vx,vz),radius=r+o.r;
   if(d<radius){point=clamp(d>epsilon?{x:o.x+vx/d*radius,z:o.z+vz/d*radius}:{x:o.x+radius,z:o.z});}
  }
  if(clear(point))return point;
 }
 // At corners or between touching obstacles, search the circle/rectangle and
 // circle/circle intersections. These are the tangential escape points that
 // an axis-only push cannot reach. Choose the closest legal endpoint.
 const candidates=[clamp({x,z}),point];
 const add=(cx,cz)=>{if(Number.isFinite(cx)&&Number.isFinite(cz))candidates.push({x:cx,z:cz});};
 for(const cx of [minX,maxX])for(const cz of [minZ,maxZ])add(cx,cz);
 const circles=obstacles.map(o=>({x:o.x,z:o.z,r:o.r+r}));
 for(let i=0;i<circles.length;i++){
  const o=circles[i],vx=target.x-o.x,vz=target.z-o.z,d=Math.hypot(vx,vz);
  if(d>epsilon)add(o.x+vx/d*o.r,o.z+vz/d*o.r);
  for(let j=0;j<8;j++){const angle=j*Math.PI/4;add(o.x+Math.cos(angle)*o.r,o.z+Math.sin(angle)*o.r);}
  for(const edge of [minX,maxX]){
   const offset=edge-o.x,square=o.r*o.r-offset*offset;
   if(square>=-epsilon){const h=Math.sqrt(Math.max(0,square));add(edge,o.z+h);add(edge,o.z-h);}
  }
  for(const edge of [minZ,maxZ]){
   const offset=edge-o.z,square=o.r*o.r-offset*offset;
   if(square>=-epsilon){const h=Math.sqrt(Math.max(0,square));add(o.x+h,edge);add(o.x-h,edge);}
  }
  for(let j=0;j<i;j++){
   const other=circles[j],sx=other.x-o.x,sz=other.z-o.z,gap=Math.hypot(sx,sz);
   if(gap<=epsilon||gap>o.r+other.r+epsilon||gap<Math.abs(o.r-other.r)-epsilon)continue;
   const along=(o.r*o.r-other.r*other.r+gap*gap)/(2*gap),h=Math.sqrt(Math.max(0,o.r*o.r-along*along));
   const bx=o.x+sx/gap*along,bz=o.z+sz/gap*along;
   add(bx-sz/gap*h,bz+sx/gap*h);add(bx+sz/gap*h,bz-sx/gap*h);
  }
 }
 let best=null,bestDistance=Infinity;
 for(const candidate of candidates)if(clear(candidate)){
  const distance=(candidate.x-target.x)**2+(candidate.z-target.z)**2;
  if(distance<bestDistance){best=candidate;bestDistance=distance;}
 }
 // A completely obstructed arena has no collision-free solution. Still return
 // a finite in-bounds point rather than trapping the update loop or emitting NaN.
 return best||clamp({x,z});
}
