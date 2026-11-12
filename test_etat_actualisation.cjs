const assert=require('node:assert/strict'),health=require('./etat_actualisation.js');
assert.equal(health.expectedSession('2026-11-16T09:00:00Z'),'2026-11-13');
assert.equal(health.expectedSession('2026-12-25T20:00:00Z',{closedDates:['2026-12-25']}),'2026-12-24');
assert.equal(health.label({session:'2026-11-12',checkedAt:'2026-11-12T20:00:00Z'},'2026-11-13T10:00:00Z').state,'ok');
assert.equal(health.label({session:'2026-11-12',checkedAt:'2026-11-13T19:00:00Z'},'2026-11-13T20:00:00Z').state,'stale');
assert.equal(health.label({session:'2026-11-12',collectionState:'degraded',checkedAt:'2026-11-12T19:00:00Z'},'2026-11-12T20:00:00Z').state,'degraded');
console.log('Fraîcheur : horaires, week-ends, jours fermés et pannes vérifiés.');
