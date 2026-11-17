import * as E from '../src/engine.js';
let wins=[];
for (const crop of [256,384]) for (const room of [3.5,4,5,6,8]) for (const sk of ['ar0234','ov9281']) {
  const sizes=[];for(let L=1.5;L<=room-1+1e-9;L+=0.5)sizes.push(L); if(!sizes.length) continue;
  const o={crop,ph:1.8,cov:2.2,roomW:room,roomD:room,minA:30,maxA:120,minN:2,need:1};
  const rows=['landscape','portrait'].flatMap(or=>E.sweep(sk,{...o,orient:or},sizes));
  const b=E.pickLens(rows); wins.push(`${crop} room${room} ${sk}: ${b.f} ${b.orient} [${b.ns.map(x=>x??'·').join(' ')}]`);
}
console.log(wins.join('\n'));
