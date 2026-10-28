// Pure combat rules shared by the simulation and regression tests.
export const COMBO_WINDOW = 3.5;
export function combatBonus(combo, sourceY = 0, targetY = 0, ranged = false) {
  const momentum = 1 + Math.min(20, Math.max(0, combo)) * .01;
  return momentum * (ranged && sourceY > targetY + .9 ? 1.2 : 1);
}
export function verticalOverlap(aY, aHeight, bY, bHeight, margin = 0) {
  return aY <= bY + bHeight + margin && bY <= aY + aHeight + margin;
}
export function segmentHitsBody(from, to, target, radius, height) {
  // Swept cylinder test prevents fast pearls skipping a small target at 30fps.
  const dx=to.x-from.x,dz=to.z-from.z,dy=to.y-from.y;
  const ox=from.x-target.x,oz=from.z-target.z;
  const a=dx*dx+dz*dz,b=2*(ox*dx+oz*dz),c=ox*ox+oz*oz-radius*radius;
  let enter=0,exit=1;
  if(a<1e-9){if(c>0)return false;}
  else {const disc=b*b-4*a*c;if(disc<0)return false;const root=Math.sqrt(disc);enter=Math.max(enter,(-b-root)/(2*a));exit=Math.min(exit,(-b+root)/(2*a));}
  const lo=target.y-.15,hi=target.y+height;
  if(Math.abs(dy)<1e-9){if(from.y<lo||from.y>hi)return false;}
  else {const t0=(lo-from.y)/dy,t1=(hi-from.y)/dy;enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));}
  return enter<=exit;
}
export function waveProfile(stage, time, duration) {
  const phase=Math.max(0,Math.min(1,time/duration));
  return { count:2+stage+Math.floor(phase*3), interval:Math.max(.72,2.45-phase*1.45),
    health:1.12+stage*.5+time*.002, speed:1.08+stage*.08+phase*.12,
    types:['crumb',...(phase>.09?['runner']:[]),...(phase>.23?['shooter']:[]),...(phase>.4?['tank','splitter']:[])] };
}
export function landingImpact(distance) {
  if(distance<1.2)return null;
  return {radius:Math.min(5.4,2.3+distance*.65),damage:Math.min(90,25+distance*14)};
}

export function readyWeaponIndex(weapons, startIndex = 0) {
  for(let step=0;step<weapons.length;step++){const i=(startIndex+step)%weapons.length;if(weapons[i].timer<=0)return i;}
  return -1;
}
