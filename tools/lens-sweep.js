const E=require('../src/engine.js');
const base={orient:'landscape',crop:256,ph:1.8,cov:2.2,minA:30,maxA:120,need:1};
for (const room of [5,6,8]) {
  const sizes=[];for(let L=1.5;L<=room-1+1e-9;L+=0.5)sizes.push(L);
  const o={...base,roomW:room,roomD:room};
  for (const s of ['ar0234','ov9281']) {
    const rows=E.sweep(s,o,sizes);
    console.log(`room ${room} ${s} sizes ${sizes.join(',')} -> pick ${E.pickLens(rows)}`);
    rows.forEach(r=>console.log('   ',r.f, r.ns.map(x=>x??'·').join(' ')));
  }
}
