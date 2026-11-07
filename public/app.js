// All view state lives in the URL, so any view can be shared as a link, e.g.
//   /?material=PLA            /?material=PLA,PETG&sort=remaining&dir=desc
//   /?vendor=Polymaker&q=blue
const $ = (id) => document.getElementById(id);
const els = {
  q: $('q'), vendor: $('vendor'), sort: $('sort'), dir: $('dir'),
  materials: $('materials'), grid: $('grid'), empty: $('empty'),
  count: $('count'), share: $('share'), updated: $('updated'),
};

const SORTS = ['color', 'name', 'material', 'vendor', 'remaining'];
const norm = (s) => (s ?? '').toString().trim().toLowerCase();

function readState() {
  const p = new URLSearchParams(location.search);
  const list = (k) => p.getAll(k).flatMap((v) => v.split(',')).map(norm).filter(Boolean);
  return {
    materials: new Set(list('material')),
    vendor: p.get('vendor') ?? '',
    q: p.get('q') ?? '',
    sort: SORTS.includes(p.get('sort')) ? p.get('sort') : 'color',
    dir: p.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

function writeState(s) {
  const p = new URLSearchParams();
  if (s.materials.size) p.set('material', [...s.materials].join(','));
  if (s.vendor) p.set('vendor', s.vendor);
  if (s.q) p.set('q', s.q);
  if (s.sort !== 'color') p.set('sort', s.sort);
  if (s.dir !== 'asc') p.set('dir', s.dir);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

let state = readState();
let rows = [];

function hue(hex) {
  if (!hex || hex.length < 6) return { h: 999, s: 0, l: 0 };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  // Greys, black and white sort after the rainbow, dark to light.
  return s < 0.12 ? { h: 400, s, l } : { h: (h * 60 + 360) % 360, s, l };
}

const compare = {
  color: (a, b) => {
    const x = hue(a.colors[0]), y = hue(b.colors[0]);
    return x.h - y.h || x.l - y.l;
  },
  name: (a, b) => norm(a.name).localeCompare(norm(b.name)),
  material: (a, b) => norm(a.material).localeCompare(norm(b.material)) || compare.color(a, b),
  vendor: (a, b) => norm(a.vendor).localeCompare(norm(b.vendor)) || compare.color(a, b),
  remaining: (a, b) => (a.remainingWeight ?? -1) - (b.remainingWeight ?? -1),
};

function matches(r) {
  if (state.materials.size && !state.materials.has(norm(r.material))) return false;
  if (state.vendor && norm(r.vendor) !== norm(state.vendor)) return false;
  if (state.q) {
    const hay = [r.name, r.vendor, r.material, ...r.locations, r.filamentComment, ...r.spoolComments, ...r.colors]
      .map(norm).join(' ');
    if (!norm(state.q).split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

const grams = (g) => (g === null ? 'unknown' : g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function swatch(r) {
  const c = r.colors.map((h) => `#${h}`);
  if (!c.length) return 'repeating-linear-gradient(45deg,#ccc 0 8px,#eee 8px 16px)';
  if (c.length === 1) return c[0];
  return r.multiColorDirection === 'longitudinal'
    ? `linear-gradient(90deg, ${c.join(', ')})`
    : `linear-gradient(90deg, ${c.map((x, i) => `${x} ${(i / c.length) * 100}% ${((i + 1) / c.length) * 100}%`).join(', ')})`;
}

function card(r) {
  const temps = [r.extruderTemp && `nozzle ${r.extruderTemp}°C`, r.bedTemp && `bed ${r.bedTemp}°C`].filter(Boolean).join(', ');
  const prices = [r.filamentPrice, ...r.spoolPrices].filter((p) => p !== null);
  const extra = [
    ['Spools', r.spoolCount],
    ['Diameter', r.diameter && `${r.diameter} mm`],
    ['Temps', temps],
    ['Location', r.locations.join(', ')],
    ['Lot', r.lotNumbers.join(', ')],
    ['Article #', r.articleNumber],
    ['Price', prices.length && [...new Set(prices)].join(', ')],
    ['Used so far', r.usedWeight && grams(r.usedWeight)],
    ['Last used', r.lastUsed && new Date(r.lastUsed).toLocaleDateString()],
    ['Notes', [r.filamentComment, ...r.spoolComments].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v);

  return `<article class="card">
    <div class="swatch" style="background:${esc(swatch(r))}" role="img"
      aria-label="Color ${esc(r.colors.map((h) => '#' + h).join(', ') || 'unknown')}"></div>
    <div class="body">
      <h2>${esc(r.name ?? 'Unnamed')}</h2>
      <p class="meta"><span class="tag">${esc(r.material ?? '?')}</span> ${esc(r.vendor ?? '')}</p>
      <p class="left">${grams(r.remainingWeight)} left${r.spoolCount > 1 ? ` · ${r.spoolCount} spools` : ''}</p>
      <details><summary>Details</summary>
        <dl>${extra.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </details>
    </div>
  </article>`;
}

function renderControls() {
  const materials = [...new Map(rows.filter((r) => r.material).map((r) => [norm(r.material), r.material])).entries()]
    .sort(([a], [b]) => a.localeCompare(b));
  els.materials.innerHTML = materials.map(([key, label]) =>
    `<button type="button" class="chip" data-material="${esc(key)}" aria-pressed="${state.materials.has(key)}">${esc(label)}</button>`
  ).join('');

  const vendors = [...new Set(rows.map((r) => r.vendor).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  els.vendor.innerHTML = '<option value="">All vendors</option>' +
    vendors.map((v) => `<option${norm(v) === norm(state.vendor) ? ' selected' : ''}>${esc(v)}</option>`).join('');

  els.q.value = state.q;
  els.sort.value = state.sort;
  els.dir.value = state.dir;
}

function render() {
  const shown = rows.filter(matches).sort(compare[state.sort]);
  if (state.dir === 'desc') shown.reverse();
  els.grid.innerHTML = shown.map(card).join('');
  els.empty.hidden = shown.length > 0;
  els.count.textContent = `${shown.length} of ${rows.length} filaments`;
  for (const chip of els.materials.children) chip.setAttribute('aria-pressed', state.materials.has(chip.dataset.material));
  writeState(state);
}

els.materials.addEventListener('click', (e) => {
  const key = e.target.closest('.chip')?.dataset.material;
  if (!key) return;
  state.materials.has(key) ? state.materials.delete(key) : state.materials.add(key);
  render();
});
els.q.addEventListener('input', () => { state.q = els.q.value.trim(); render(); });
els.vendor.addEventListener('change', () => { state.vendor = els.vendor.value; render(); });
els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });
els.dir.addEventListener('change', () => { state.dir = els.dir.value; render(); });
els.share.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    els.share.textContent = 'Link copied';
  } catch {
    els.share.textContent = 'Copy the address bar';
  }
  setTimeout(() => (els.share.textContent = 'Copy link to this view'), 2000);
});

try {
  const res = await fetch('/api/filaments');
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  rows = data.filaments;
  els.updated.textContent = `Inventory as of ${new Date(data.updatedAt).toLocaleString()}`;
  renderControls();
  render();
} catch {
  els.grid.innerHTML = '<p class="empty">The inventory is unavailable right now. Try again in a bit.</p>';
} finally {
  els.grid.setAttribute('aria-busy', 'false');
}
