const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fixture = require('./fixtures/aliens-cup-readings.json');
const context = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../base/common.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../base/calculator.js'), 'utf8'), context);
const calculate = context.window.FFCalculator.calculate;

test('matches the seven manually reviewed captures, including overlaps and an empty slot', () => {
  const rows = calculate(fixture.roster, fixture.lobby, fixture.rooms);
  assert.equal(rows.length, 12);
  for (const [slot, kills, placement, total] of fixture.expected) {
    const row = rows.find(row => row.slot === slot);
    assert.equal(row.kills, kills, `kills in slot ${slot}`);
    assert.equal(row.placement, placement, `position points in slot ${slot}`);
    assert.equal(row.kills + row.placement, total, `total in slot ${slot}`);
  }
  assert.equal(rows.reduce((sum, row) => sum + row.kills, 0), 188);
  assert.equal(rows.reduce((sum, row) => sum + row.rooms[0].kills, 0), 89);
  assert.equal(rows.reduce((sum, row) => sum + row.rooms[1].kills, 0), 99);
});

test('an unreadable position keeps kills, an unknown team needs manual assignment', () => {
  const readings = [[
    { position: 'X', players: [{ name: 'ALN.Kearas', kills: 5 }] },
    { position: 1, players: [{ name: 'Unrelated Player', kills: 2 }] },
  ]];
  const rows = calculate(fixture.roster, fixture.lobby, readings);
  const known = rows.find(row => row.slot === 2);
  assert.equal(known.kills, 5);
  assert.equal(known.placement, 0);
  assert.equal(known.rooms[0].position, 'X');
  assert.equal(rows.find(row => !row.rowId).kills, 2);
});

test('players belonging to conflicting lobby slots do not get assigned automatically', () => {
  const rows = calculate(fixture.roster, fixture.lobby, [[{
    position: 1, players: [{ name: 'ALN.Kearas', kills: 2 }, { name: 'Zowa', kills: 3 }],
  }]]);
  assert.equal(rows.find(row => !row.rowId).kills, 5);
  assert.equal(rows.find(row => row.slot === 2).kills, 0);
  assert.equal(rows.find(row => row.slot === 5).kills, 0);
});
