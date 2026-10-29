// Damped spring driven by hand acceleration. Bounded substeps keep it stable
// when the window stalls; the free surface then settles back under gravity.
export function createSlosh() {
  const state={x:0,z:0,vx:0,vz:0};
  return {
    state,
    impulse(x,z){state.vx+=Math.max(-3,Math.min(3,x));state.vz+=Math.max(-3,Math.min(3,z));},
    update(dt){
      let remaining=Math.min(.12,Math.max(0,dt));
      while(remaining>0){const h=Math.min(1/120,remaining);remaining-=h;
        state.vx+=(-23*state.x-3.8*state.vx)*h;state.vz+=(-23*state.z-3.8*state.vz)*h;
        state.x=Math.max(-.5,Math.min(.5,state.x+state.vx*h));state.z=Math.max(-.5,Math.min(.5,state.z+state.vz*h));
      }
      return state;
    },
    reset(){Object.assign(state,{x:0,z:0,vx:0,vz:0});},
  };
}
