import assert from 'node:assert/strict';
import {buildShareURL} from '../viewer/share-url.js';

const base='http://127.0.0.1:65119/viewer/?dataset=full&gamma=1&color=dls&dsu=old&junk=1';
const plain=new URL(buildShareURL(base,{color:'section',inventory:null,scenario:'base',dsu:null}));
assert.equal(plain.pathname,'/viewer/');
assert.deepEqual([...plain.searchParams],[['dataset','full'],['gamma','1'],['ref','share']],'stale view parameters are replaced by the current state');

const full=new URL(buildShareURL(base,{color:'operator',inventory:'township',scenario:'high',dsu:'SPC 123'}));
assert.equal(full.searchParams.get('color'),'operator');assert.equal(full.searchParams.get('inventory'),'township');assert.equal(full.searchParams.get('scenario'),'high');assert.equal(full.searchParams.get('dsu'),'SPC 123');

const hidden=new URL(buildShareURL('https://example.com/viewer/?showcase=tour',{color:'tvd',inventory:'bogus',scenario:'high'}));
assert.equal(hidden.searchParams.get('showcase'),'tour');assert.equal(hidden.searchParams.has('inventory'),false);assert.equal(hidden.searchParams.has('scenario'),false);
console.log('share url tests passed');
