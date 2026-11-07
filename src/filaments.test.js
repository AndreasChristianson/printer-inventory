import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSpools } from './filaments.js';

const pla = { id: 1, name: 'Galaxy Black', material: 'PLA', color_hex: '111111', vendor: { name: 'Acme' } };
const silk = { id: 2, name: 'Rainbow', material: 'PLA', multi_color_hexes: 'ff0000,00ff00', vendor: null };

test('groups spools by filament and sums remaining weight', () => {
  const rows = groupSpools([
    { filament: pla, remaining_weight: 400, location: 'Shelf A', lot_nr: 'L1' },
    { filament: pla, remaining_weight: 600, location: 'Shelf A', lot_nr: 'L2' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].spoolCount, 2);
  assert.equal(rows[0].remainingWeight, 1000);
  assert.deepEqual(rows[0].locations, ['Shelf A']);
  assert.deepEqual(rows[0].lotNumbers, ['L1', 'L2']);
  assert.equal(rows[0].vendor, 'Acme');
});

test('drops archived and empty spools', () => {
  const rows = groupSpools([
    { filament: pla, remaining_weight: 0 },
    { filament: silk, remaining_weight: 100, archived: true },
  ]);
  assert.equal(rows.length, 0);
});

test('keeps spools with unknown remaining weight', () => {
  const rows = groupSpools([{ filament: pla }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].remainingWeight, null);
});

test('uses multi-color hexes when present', () => {
  const [row] = groupSpools([{ filament: silk, remaining_weight: 50 }]);
  assert.deepEqual(row.colors, ['ff0000', '00ff00']);
  assert.equal(row.vendor, null);
});
