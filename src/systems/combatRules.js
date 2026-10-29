export const ACTIONS={sword:{duration:.68,impact:.29,cost:12},cast:{duration:.85,impact:.34,cost:20},drink:{duration:1.65,impact:1.02,cost:0}};
export function crossedImpact(previous,next,kind){return previous<ACTIONS[kind].impact&&next>=ACTIONS[kind].impact;}
export function inAttackArc(dx,dz,yaw,range=3.1,cosine=.45){
  const distance=Math.hypot(dx,dz);
  return distance<=range && (distance<.01||(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/distance>cosine);
}
