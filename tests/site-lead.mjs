import assert from 'node:assert/strict';
import {buildLead,mailtoFor,readAttribution,validateLead} from '../site/lead.js';
import {SITE} from '../site/config.js';

assert.deepEqual(readAttribution('?utm_source=linkedin&utm_campaign=pilot&x=1',{}),{utm_source:'linkedin',utm_campaign:'pilot'});
assert.deepEqual(readAttribution('?utm_source=later',{ref:'share'}),{ref:'share'},'first touch wins');
assert.deepEqual(readAttribution('',null),{});

const now=new Date('2026-10-27T00:00:00Z');
const lead=buildLead({name:' Dana ',email:' Dana@Example.COM ',company:'Acme Minerals',role:'mineral',interest:'pilot',area:'T152N R96W',notes:'x'.repeat(5000),website:'ignored'},{attribution:{utm_source:'email'},page:'/site/',now});
assert.equal(lead.name,'Dana');assert.equal(lead.email,'dana@example.com');assert.equal(lead.notes.length,2000);assert.equal('website' in lead,false);
assert.equal(lead.submittedAt,'2026-10-27T00:00:00.000Z');assert.deepEqual(lead.attribution,{utm_source:'email'});
assert.deepEqual(validateLead(lead),{});

const missing=validateLead(buildLead({email:'nope',role:'astronaut',interest:'report'},{now}));
assert.deepEqual(Object.keys(missing).sort(),['area','company','email','name','role']);
assert.equal(validateLead(buildLead({name:'A',email:'a@b.co',company:'C',role:'other',interest:'demo'},{now})).area,undefined,'area is optional for a demo');
assert.ok(validateLead(buildLead({name:'A',email:'a@b.co',company:'C',role:'other',interest:'free-lunch'},{now})).interest);

const mail=mailtoFor(lead,'sales@example.com');
assert.ok(mail.startsWith('mailto:sales%40example.com?subject=Founder%20pilot%20%C2%B7%20Acme%20Minerals&body='));
const body=decodeURIComponent(mail.split('body=')[1]);
assert.match(body,/Role: Mineral \/ royalty acquisition/);assert.match(body,/Area of interest: T152N R96W/);assert.match(body,/Source: utm_source=email/);

assert.ok(SITE.plans.some(p=>p.featured),'one plan is highlighted');
for(const plan of SITE.plans)assert.ok(plan.name&&plan.price&&plan.features.length&&plan.cta,plan.id);
console.log('site lead tests passed');
