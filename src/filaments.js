// Turns Spoolman's spool list into one row per filament: what colors are on hand.

const unique = (values) => [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ''))];

const sum = (values) => {
  const nums = values.filter((v) => typeof v === 'number');
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
};

const colorsOf = (filament) => {
  if (filament.multi_color_hexes) {
    return filament.multi_color_hexes.split(',').map((c) => c.trim()).filter(Boolean);
  }
  return filament.color_hex ? [filament.color_hex] : [];
};

const hasFilamentLeft = (spool) =>
  spool.remaining_weight === null || spool.remaining_weight === undefined || spool.remaining_weight > 0;

export function groupSpools(spools) {
  const groups = new Map();
  for (const spool of spools) {
    if (spool.archived || !spool.filament || !hasFilamentLeft(spool)) continue;
    const key = spool.filament.id;
    if (!groups.has(key)) groups.set(key, { filament: spool.filament, spools: [] });
    groups.get(key).spools.push(spool);
  }

  return [...groups.values()].map(({ filament, spools }) => ({
    id: filament.id,
    name: filament.name ?? null,
    vendor: filament.vendor?.name ?? null,
    material: filament.material ?? null,
    colors: colorsOf(filament),
    multiColorDirection: filament.multi_color_direction ?? null,
    diameter: filament.diameter ?? null,
    density: filament.density ?? null,
    extruderTemp: filament.settings_extruder_temp ?? null,
    bedTemp: filament.settings_bed_temp ?? null,
    articleNumber: filament.article_number ?? null,
    filamentPrice: filament.price ?? null,
    filamentComment: filament.comment || null,
    spoolCount: spools.length,
    remainingWeight: sum(spools.map((s) => s.remaining_weight)),
    usedWeight: sum(spools.map((s) => s.used_weight)),
    locations: unique(spools.map((s) => s.location)),
    lotNumbers: unique(spools.map((s) => s.lot_nr)),
    spoolPrices: unique(spools.map((s) => s.price)),
    spoolComments: unique(spools.map((s) => s.comment)),
    lastUsed: spools.map((s) => s.last_used).filter(Boolean).sort().at(-1) ?? null,
  }));
}
