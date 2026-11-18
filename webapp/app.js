// VFFS operator panel, web page 2.1. Plain JavaScript, no libraries (the ESP32 serves it without internet).
// Works three ways: served by the ESP32, opened from a PC (type the ESP32 address on the Connection page),
// or with the built-in test machine (sim.js) when there is no hardware at all.
'use strict';

const $ = id => document.getElementById(id);
const VERSION = '2.1';

const STATES = { 0: 'Idle', 5: 'Homing', 10: 'Preheat', 20: 'Filling', 30: 'Running', 40: 'Stopping', 50: 'Manual', 90: 'Fault', 99: 'Emergency stop' };
const ALARMS = {
  0: 'Safety circuit open', 1: 'Air pressure low', 2: 'Film axis fault', 3: 'Jaw lift driver fault',
  4: 'Homing time-out (30 s)', 5: 'Thermocouple fault, jaws', 6: 'Thermocouple fault, band', 7: 'Film dancer at its limit',
  8: 'Hopper low', 9: 'Heating time-out (15 min)', 10: 'Camera does not answer', 11: 'Main contactor KM1 feedback',
  20: 'Emergency stop pressed', 21: 'Guard open', 22: 'Link to the HMI lost'
};
const MANUAL = [
  { group: 'Weigh buckets', items: [[0, 'Gate 1'], [1, 'Gate 2'], [2, 'Gate 3'], [3, 'Door 1'], [4, 'Door 2'], [5, 'Door 3'], [6, 'Diverter A'], [7, 'Diverter B']] },
  { group: 'Sealing and cutting', items: [[8, 'Back-seal band'], [9, 'Cross-seal jaws'], [10, 'Knife', 1], [11, 'Reject pusher', 1], [17, 'Jaw lift up', 1], [18, 'Jaw lift down', 1]] },
  { group: 'Film, conveyor and camera', items: [[16, 'Jog film', 1], [12, 'Unwind motor'], [13, 'Conveyor'], [14, 'Camera light'], [15, 'Camera trigger', 1], [19, 'Home all axes', 1]] }
];
const SETTINGS = [
  { k: 'bpm', name: 'Target speed', unit: 'bags/min', lim: [20, 60], step: 1, dec: 0, slider: true },
  { k: 'bagLen', name: 'Bag length', unit: 'mm', lim: [50, 120], step: 1, dec: 0 },
  { k: 'target', name: 'Target weight', unit: 'g', lim: [10, 100], step: 0.5, dec: 1 },
  { k: 'spJaws', name: 'Jaw set point', unit: '°C', lim: [80, 180], step: 1, dec: 0 },
  { k: 'spBand', name: 'Band set point', unit: '°C', lim: [80, 180], step: 1, dec: 0 }
];
const MAX_FILM_SPEED = 75;      // mm/s, the same limit as in the PLC  [ASSUMED]
const LOWER_MARGIN = 2.5;       // g under the target = lower limit (27.5 g for 30 g)

// ---------- connection ----------
// mode: 'none' | 'esp' | 'test'.  state: 'idle' | 'connecting' | 'connected' | 'lost' | 'failed'
const conn = { mode: 'none', base: '', state: 'idle', msg: '', fails: 0, auto: true };
const servedByHttp = location.protocol === 'http:' || location.protocol === 'https:';
let S = null, lastOk = 0, pin = '', formTouched = false, manualUnlocked = false;
const histCache = {}; let histRange = '10m', doses = null, alog = null;
const holdTimers = {};

function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
function load(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
function saved() { return load('vffsMachines', []); }
function normAddr(a) {
  a = (a || '').trim().replace(/\/+$/, '');
  if (!a) return '';
  if (!/^https?:\/\//i.test(a)) a = 'http://' + a;
  return a;
}
function addrLabel(base) { return base === '' ? location.host || 'this page' : base.replace(/^https?:\/\//, ''); }

async function apiGet(path, timeout, base) {
  if (base === undefined && conn.mode === 'test') return Sim.get(path);
  const b = base === undefined ? conn.base : base;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout || 3000);
  try {
    const r = await fetch(b + path, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function post(path, data) {
  const body = Object.assign({ pin: pin }, data);
  try {
    let j;
    if (conn.mode === 'test') j = await Sim.post(path, body);
    else {
      const r = await fetch(conn.base + path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
      j = await r.json();
    }
    if (j.result === 6) { pin = ''; manualUnlocked = false; }
    return j;
  } catch (e) { return { ok: false, result: 0, msg: 'No answer from the ESP32.' }; }
}

async function connect(mode, base) {
  if (conn.state === 'connecting') return;
  if (conn.mode === 'test' && mode !== 'test') Sim.stop();
  Object.assign(conn, { mode: mode, base: base || '', state: 'connecting', msg: '', fails: 0 });
  S = null; doses = null; alog = null; for (const k in histCache) delete histCache[k];
  pin = ''; manualUnlocked = false; formTouched = false;
  if (mode === 'test') Sim.start();
  render();
  try {
    S = await apiGet('/api/status', 4000);
    conn.state = 'connected'; lastOk = Date.now();
    store('vffsLast', { mode: mode, base: conn.base });
    if (mode === 'esp' && conn.base !== '') { const list = saved().filter(m => m !== conn.base); list.unshift(conn.base); store('vffsMachines', list.slice(0, 6)); }
    toast(mode === 'test' ? 'Connected to the test machine.' : 'Connected to ' + addrLabel(conn.base) + '.');
    loadPageData();
  } catch (e) {
    conn.state = 'failed'; conn.mode = 'none';
    conn.msg = 'No answer from ' + addrLabel(conn.base) + '. Check the address and that this device is on the same Wi-Fi as the ESP32.';
    if (location.protocol === 'https:' && /^http:/.test(conn.base)) conn.msg += ' This page is opened over https, and browsers block plain http addresses from it. Open the page from the ESP32 itself instead.';
  }
  render();
}
function disconnect() {
  if (conn.mode === 'test') Sim.stop();
  Object.assign(conn, { mode: 'none', state: 'idle', msg: '' });
  S = null; store('vffsLast', null);
  render();
}
function live() { return conn.state === 'connected' && S; }
function canSend() { return live() && S.link.modbusOk; }

// ---------- small helpers ----------
function icon(name) { return '<svg class="ic" viewBox="0 -960 960 960" aria-hidden="true"><path d="' + (ICONS[name] || '') + '"/></svg>'; }
function drawIcons(root) { (root || document).querySelectorAll('i[data-icon]').forEach(e => { e.outerHTML = icon(e.dataset.icon); }); }
function fx(v, n) { return Number(v).toFixed(n); }
function flag(b) { return S ? (S.flags >> b) & 1 : 0; }
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function ago(s) { if (s < 60) return s + ' s ago'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; return Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min ago'; }
function setText(id, t) { const e = $(id); if (e.textContent !== String(t)) e.textContent = t; }
function setHtml(el, h) { if (el._h !== h) { el.innerHTML = h; el._h = h; } }   // only touch the page when something changed
function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = bad ? 'bad' : ''; }, 3200); }

function confirmSend(title, rows, okText) {
  return new Promise(resolve => {
    const d = $('dlg');
    $('dlgTitle').textContent = title;
    $('dlgBody').innerHTML = '<table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
    $('dlgOk').textContent = okText || 'Send';
    $('dlgPin').value = pin;
    d.returnValue = '';
    d.onclose = () => { const ok = d.returnValue === 'ok'; if (ok) pin = $('dlgPin').value; resolve(ok); };
    d.showModal();
    if (!pin) $('dlgPin').focus();
  });
}
async function command(cmd, title, text) {
  if (!await confirmSend(title, [['Command', text], ['Machine state now', S ? STATES[S.state] || S.state : 'unknown']])) return;
  const j = await post('/api/cmd', { cmd: cmd });
  toast(j.ok ? text + ': done' : j.msg, !j.ok);
  poll();
}

// ---------- pages ----------
function page() { return (location.hash || '#dashboard').slice(1); }
function showPage() {
  let p = page();
  if (p === 'test' && conn.mode !== 'test') { location.hash = '#connection'; return; }
  document.querySelectorAll('.page').forEach(s => { s.hidden = s.id !== 'page-' + p; });
  document.querySelectorAll('.side a').forEach(a => a.classList.toggle('on', a.dataset.page === p));
  closeMenu();
  $('main').scrollTop = 0;
  loadPageData();
  render();
}
function closeMenu() { $('side').classList.remove('open'); $('scrim').classList.remove('open'); }

function activeAlarms() {
  const a = [];
  if (!S) return a;
  for (let b = 0; b < 12; b++) if ((S.alarms >> b) & 1) a.push(ALARMS[b]);
  if (flag(4)) a.push(ALARMS[20]);
  if (flag(5)) a.push(ALARMS[21]);
  if (!S.link.modbusOk) a.push(ALARMS[22]);
  return a;
}
function stateClass(s) { return s === 30 ? 'ok' : (s === 90 || s === 99) ? 'danger' : (s === 0 ? '' : 'warn'); }

function renderHeader() {
  const cs = $('chipState'), cl = $('chipLink'), test = conn.mode === 'test';
  $('testTag').hidden = !test; $('navTest').hidden = !test;
  let linkText, linkCls, linkIcon;
  if (conn.state === 'connecting') { linkText = 'Connecting...'; linkCls = 'warn'; linkIcon = 'sync'; }
  else if (conn.mode === 'none') { linkText = 'Not connected'; linkCls = ''; linkIcon = 'link_off'; }
  else if (conn.state === 'lost') { linkText = 'Link lost'; linkCls = 'danger'; linkIcon = 'wifi_off'; }
  else if (!S.link.modbusOk) { linkText = 'PLC link lost'; linkCls = 'danger'; linkIcon = 'wifi_off'; }
  else { linkText = test ? 'Test machine' : 'PLC online'; linkCls = 'ok'; linkIcon = test ? 'science' : 'wifi'; }
  cl.className = 'chip link ' + linkCls;
  if (cl._i !== linkIcon) { cl.querySelector('svg').outerHTML = icon(linkIcon); cl._i = linkIcon; }
  setText('chipLinkText', linkText);
  if (live()) { cs.className = 'chip ' + stateClass(S.state); setText('chipStateText', STATES[S.state] || 'State ' + S.state); }
  else { cs.className = 'chip'; setText('chipStateText', conn.state === 'connecting' ? 'Connecting' : conn.state === 'lost' ? 'No data' : 'Offline'); }

  // banner
  const p = page(), b = $('banner'), al = live() ? activeAlarms() : [];
  let text = '', btn = '', cls = 'banner', go = '';
  if (conn.mode === 'none' && p !== 'connection') { text = conn.state === 'failed' ? conn.msg : 'Not connected to a machine.'; btn = 'Connect'; go = '#connection'; cls += ' info'; }
  else if (conn.state === 'connecting') { text = 'Connecting to ' + (conn.mode === 'test' ? 'the test machine' : addrLabel(conn.base)) + '...'; cls += ' info'; }
  else if (conn.state === 'lost') { text = conn.auto ? 'No answer from the ESP32. Trying again... The values shown are old.' : 'The link to the ESP32 was lost. The values shown are old.'; btn = conn.auto ? '' : 'Connect'; go = '#connection'; }
  else if (al.length) { text = al.length === 1 ? al[0] : al.length + ' active alarms: ' + al.slice(0, 2).join(', ') + (al.length > 2 ? ', ...' : ''); if (p !== 'alarms') { btn = 'Open'; go = '#alarms'; } }
  b.hidden = !text; b.className = cls; setText('bannerText', text);
  $('bannerBtn').hidden = !btn; $('bannerBtn').textContent = btn; $('bannerBtn').dataset.go = go;
  $('navAlarmCount').hidden = al.length === 0; setText('navAlarmCount', al.length);
  // values that are not live are dimmed
  $('main').classList.toggle('stale', !(live() && conn.state !== 'lost'));
}

function render() {
  renderHeader();
  const p = page();
  if (p === 'connection') renderConnection();
  if (p === 'test') renderTest();
  if (p === 'about') renderAbout();
  if (!S) return;
  if (p === 'dashboard') renderDashboard();
  if (p === 'control') renderControl();
  if (p === 'manual') renderManual();
  if (p === 'weighing') renderWeighing();
  if (p === 'alarms') renderAlarms();
}

function renderDashboard() {
  setText('dBpm', fx(S.bpm, 1)); setText('dSetBpm', fx(S.set.bpm, 0));
  setText('dGood', S.good); setText('dMade', S.made); setText('dRej', S.rejected);
  setText('dRejPct', S.made ? fx(100 * S.rejected / S.made, 1) : '0.0');
  setText('dMean', fx(S.meanDose, 2)); setText('dGive', fx(S.giveAway, 2));
  const ds = $('dState'); setText('dState', STATES[S.state] || S.state); ds.className = 'statebig ' + stateClass(S.state);
  document.querySelectorAll('#dSteps li').forEach(li => {
    const s = +li.dataset.s; li.className = S.state > 30 ? '' : (s < S.state ? 'done' : s === S.state ? 'now' : '');
  });
  setText('dLast', fx(S.lastDose, 2)); setText('dLane', S.lane); setText('dRemote', flag(6) ? 'Enabled' : 'Off');
  for (const [k, t, sp] of [['Tj', S.tJaws, S.set.spJaws], ['Tb', S.tBand, S.set.spBand]]) {
    setText('d' + k, fx(t, 1));
    const bar = $('d' + k + 'Bar'); bar.style.width = Math.max(0, Math.min(100, t / 200 * 100)) + '%'; bar.className = Math.abs(t - sp) < 5 ? 'ok' : '';
    $('d' + k + 'Sp').style.left = (sp / 200 * 100) + '%';
  }
  setText('dSpJ', fx(S.set.spJaws, 0)); setText('dSpB', fx(S.set.spBand, 0));
  setText('dHeat', flag(8) || flag(9) ? 'Heater fault' : flag(1) ? (flag(0) ? 'Heaters on, temperature reached' : 'Heaters on, heating up') : 'Heaters off');
  const h = histCache['10m'];
  if (h) lineChart($('cDash'), [{ data: h.bpm, color: css('--c1') }], { stepS: h.stepS, min: 0, max: 70 });
}

// ----- control
function buildSettings() {
  $('setRows').innerHTML = SETTINGS.map(s =>
    '<div class="set"><div class="set-h"><span class="set-n">' + s.name + '</span><span class="set-u">' + s.unit + ', ' + s.lim[0] + ' to ' + s.lim[1] + '</span>' +
    '<span class="set-plc">In the PLC: <b id="r_' + s.k + '">-</b></span></div><div class="set-c">' +
    (s.slider ? '<input type="range" id="sl_' + s.k + '" min="' + s.lim[0] + '" max="' + s.lim[1] + '" step="' + s.step + '" aria-label="' + s.name + '">' : '') +
    '<div class="stepper"><button type="button" data-k="' + s.k + '" data-d="-1" aria-label="Less">' + icon('remove') + '</button>' +
    '<input type="number" id="s_' + s.k + '" min="' + s.lim[0] + '" max="' + s.lim[1] + '" step="' + s.step + '" inputmode="decimal" aria-label="' + s.name + '">' +
    '<button type="button" data-k="' + s.k + '" data-d="1" aria-label="More">' + icon('add') + '</button></div></div></div>').join('');
  for (const s of SETTINGS) {
    $('s_' + s.k).addEventListener('input', () => { formTouched = true; if (s.slider) $('sl_' + s.k).value = $('s_' + s.k).value; renderControl(); });
    if (s.slider) $('sl_' + s.k).addEventListener('input', () => { formTouched = true; $('s_' + s.k).value = $('sl_' + s.k).value; renderControl(); });
  }
  $('setRows').querySelectorAll('.stepper button').forEach(b => b.addEventListener('click', () => {
    const s = SETTINGS.find(x => x.k === b.dataset.k), inp = $('s_' + s.k);
    let v = (parseFloat(inp.value) || s.lim[0]) + s.step * +b.dataset.d;
    v = Math.min(s.lim[1], Math.max(s.lim[0], v));
    inp.value = fx(v, s.dec); if (s.slider) $('sl_' + s.k).value = v;
    formTouched = true; renderControl();
  }));
}
function fillForm() {
  for (const s of SETTINGS) { $('s_' + s.k).value = fx(S.set[s.k], s.dec); if (s.slider) $('sl_' + s.k).value = S.set[s.k]; }
  formTouched = false;
}
function formValues() { const v = {}; for (const s of SETTINGS) v[s.k] = parseFloat($('s_' + s.k).value); return v; }
function formErrors(v) {
  const e = [];
  for (const s of SETTINGS) if (!(v[s.k] >= s.lim[0] && v[s.k] <= s.lim[1])) e.push(s.name + ' must be ' + s.lim[0] + ' to ' + s.lim[1] + ' ' + s.unit + '.');
  const speed = v.bagLen * v.bpm / 60;
  if (speed > MAX_FILM_SPEED) e.push('Film speed would be ' + fx(speed, 1) + ' mm/s; the limit is ' + MAX_FILM_SPEED + ' mm/s. Lower the speed or the bag length.');
  return e;
}
function renderControl() {
  if (!formTouched) fillForm();
  const v = formValues();
  for (const s of SETTINGS) { setText('r_' + s.k, fx(S.set[s.k], s.dec)); $('s_' + s.k).classList.toggle('changed', Math.abs(v[s.k] - S.set[s.k]) > 0.01); }
  const errs = formErrors(v), rem = flag(6), idle = S.state === 0;
  setText('sCheck', errs.length ? errs.join(' ') : 'Film speed with these values: ' + fx(v.bagLen * v.bpm / 60, 1) + ' mm/s (limit ' + MAX_FILM_SPEED + ').');
  $('sCheck').style.color = errs.length ? css('--danger') : '';
  setText('cNote', !live() ? 'Not connected. Connect on the Connection page.' : !S.link.modbusOk ? 'The link to the PLC is down. Only the buttons on the machine work.' : !rem ? 'Remote control is switched off at the HMI. Only Stop is accepted.' : !idle ? 'Settings can be sent only when the machine is in Idle.' : '');
  const can = canSend();
  $('bStart').disabled = !(can && rem && idle && !flag(2));
  $('bStop').disabled = !can;
  $('bReset').disabled = !(can && rem);
  $('bHeatOn').disabled = !(can && rem) || !!flag(10); $('bHeatOff').disabled = !(can && rem) || !flag(10);
  $('bClear').disabled = !(can && rem && idle);
  $('bApply').disabled = !(can && rem && idle) || errs.length > 0;
}

// ----- manual
function buildManual() {
  $('mGroups').innerHTML = MANUAL.map(g => '<div class="card"><h2>' + g.group + '</h2>' + g.items.map(it =>
    '<div class="mrow"><span>' + it[1] + '</span><button class="btn" data-bit="' + it[0] + '" data-hold="' + (it[2] ? 1 : 0) + '">' + (it[2] ? 'Hold' : 'Off') + '</button></div>').join('') + '</div>').join('');
  $('mGroups').querySelectorAll('button').forEach(b => {
    const bit = +b.dataset.bit;
    if (b.dataset.hold === '1') {
      const start = e => { e.preventDefault(); if (b.disabled || holdTimers[bit]) return; b.setPointerCapture && b.setPointerCapture(e.pointerId); manualSend(bit, 1); holdTimers[bit] = setInterval(() => manualSend(bit, 1, true), 300); b.classList.add('active'); };
      const stop = () => { if (!holdTimers[bit]) return; clearInterval(holdTimers[bit]); delete holdTimers[bit]; manualSend(bit, 0); b.classList.remove('active'); };
      b.addEventListener('pointerdown', start); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, stop));
      b.addEventListener('contextmenu', e => e.preventDefault());
    } else b.addEventListener('click', () => manualSend(bit, (S.manual >> bit) & 1 ? 0 : 1));
  });
}
async function manualSend(bit, on, quiet) {
  const j = await post('/api/manual', { bit: bit, on: on });
  if (!j.ok) { if (!quiet) toast(j.msg, true); }
  else if (S) S.manual = on ? (S.manual | (1 << bit)) >>> 0 : (S.manual & ~(1 << bit)) >>> 0;
  renderManual();
}
function renderManual() {
  const man = flag(3), rem = flag(6), can = canSend() && man && rem && manualUnlocked;
  const n = $('mNote');
  n.className = 'note' + (can ? ' ok' : '');
  setText('mNote', !live() ? 'Not connected.' : !man ? 'The machine is not in manual mode. Turn the manual selector on the machine first (in test mode: on the Test panel).' : !rem ? 'Remote control is switched off at the HMI.' : !manualUnlocked ? 'Enter the control PIN to use this page.' : 'Manual mode is active. Buttons marked Hold work only while you press them.');
  $('mUnlock').hidden = manualUnlocked;
  $('mGroups').querySelectorAll('button').forEach(b => {
    b.disabled = !can;
    if (b.dataset.hold !== '1') { const on = (S.manual >> +b.dataset.bit) & 1; setText2(b, on ? 'On' : 'Off'); b.classList.toggle('active', !!on); }
  });
}
function setText2(el, t) { if (el.textContent !== t) el.textContent = t; }

// ----- weighing
function buildWeighing() {
  $('wBuckets').innerHTML = [1, 2, 3].map(i => '<div class="card bucket" id="wb' + i + '"><div class="head"><h2>Bucket ' + i + '</h2><span class="sub" id="wn' + i + '"></span></div>' +
    '<div class="wv"><span id="ww' + i + '">-</span><small> g</small></div><div class="bar"><span id="wbar' + i + '"></span><em id="wt' + i + '"></em></div>' +
    '<div class="btnrow"><button class="btn" data-tare="' + i + '">Tare</button></div></div>').join('');
  $('wBuckets').querySelectorAll('button').forEach(b => b.addEventListener('click', () => command('tare' + b.dataset.tare, 'Set bucket ' + b.dataset.tare + ' to zero?', 'Tare bucket ' + b.dataset.tare)));
}
function renderWeighing() {
  const full = S.set.target * 1.3;
  for (let i = 1; i <= 3; i++) {
    const w = S.w[i - 1];
    setText('ww' + i, fx(w, 1));
    const bar = $('wbar' + i); bar.style.width = Math.max(0, Math.min(100, w / full * 100)) + '%'; bar.className = w >= S.set.target ? 'ok' : '';
    $('wt' + i).style.left = (S.set.target / full * 100) + '%';
    $('wb' + i).classList.toggle('next', S.lane === i);
    setText('wn' + i, S.lane === i ? 'Next to empty' : '');
  }
  $('wBuckets').querySelectorAll('button').forEach(b => { b.disabled = !(canSend() && flag(6) && (S.state === 0 || S.state === 50)); });
  setText('wMean', fx(S.meanDose, 2)); setText('wGive', fx(S.giveAway, 2));
  setText('wUnder', S.under); setText('wOver', S.over); setText('wWaits', S.waits);
  if (doses) {
    const t = doses.target, d = doses.doses;
    barChart($('cDoses'), d, { min: t - 5, max: t + 5, base: t - 5, lines: [[t, 'Target ' + fx(t, 1) + ' g', css('--text')], [t - LOWER_MARGIN, 'Lower limit ' + fx(t - LOWER_MARGIN, 1) + ' g', css('--danger')]], bad: v => v < t - LOWER_MARGIN });
    barChart($('cGive'), d.map(v => v - t), { min: -3, max: 4, base: 0, lines: [[0, 'Target', css('--text')]], bad: v => v < -LOWER_MARGIN });
  }
}

// ----- alarms
function renderAlarms() {
  const al = activeAlarms();
  setHtml($('aActive'), al.length ? al.map(a => '<li>' + icon('error') + a + '</li>').join('') : '<li class="none">' + icon('check_circle') + 'No active alarm</li>');
  $('aReset').disabled = !(canSend() && flag(6));
  if (alog) setHtml($('aLog'), alog.log.length ? alog.log.map(e => '<tr><td>' + ago(Math.max(0, alog.uptimeS - e.t)) + '</td><td>' + (ALARMS[e.code] || 'Code ' + e.code) + '</td><td><span class="tag ' + (e.on ? 'on">Came' : 'off">Gone') + '</span></td></tr>').join('') : '<tr><td colspan="3" class="sub">No event since the ESP32 started.</td></tr>');
  const h = histCache[histRange];
  if (h) {
    const o = { stepS: h.stepS };
    lineChart($('cBpm'), [{ data: h.bpm, color: css('--c1') }], Object.assign({ min: 0, max: 70 }, o));
    lineChart($('cDose'), [{ data: h.dose, color: css('--c1') }], Object.assign({ pad: 1 }, o));
    lineChart($('cTemp'), [{ data: h.tJaws, color: css('--c1'), name: 'Jaws' }, { data: h.tBand, color: css('--c2'), name: 'Band' }], Object.assign({ min: 0, max: 200 }, o));
    lineChart($('cRej'), [{ data: h.rej, color: css('--c2') }], Object.assign({ min: 0, pad: 1 }, o));
  }
}

// ----- connection
function kv(rows) { return rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join(''); }
function machineList() {
  const list = [];
  if (servedByHttp) list.push({ mode: 'esp', base: '', name: 'This ESP32', where: location.host + ' (the address of this page)', icon: 'developer_board' });
  for (const b of saved()) list.push({ mode: 'esp', base: b, name: 'ESP32 at ' + addrLabel(b), where: b, icon: 'router', del: true });
  list.push({ mode: 'test', base: '', name: 'Test machine', where: 'Simulation inside this page. No hardware needed.', icon: 'science' });
  return list;
}
function renderConnection() {
  const st = conn.state, test = conn.mode === 'test';
  const ic = $('kIcon');
  let state, where, cls, ico;
  if (st === 'connecting') { state = 'Connecting...'; where = test ? 'Test machine' : addrLabel(conn.base); cls = 'warn'; ico = 'sync'; }
  else if (conn.mode === 'none') { state = st === 'failed' ? 'Could not connect' : 'Not connected'; where = st === 'failed' ? conn.msg : 'Choose a machine below, or type its address.'; cls = st === 'failed' ? 'danger' : ''; ico = 'link_off'; }
  else if (st === 'lost') { state = 'Link lost'; where = (conn.auto ? 'Trying again... ' : '') + (test ? 'Test machine' : addrLabel(conn.base)); cls = 'danger'; ico = 'wifi_off'; }
  else { state = 'Connected'; where = test ? 'Test machine (simulation)' : addrLabel(conn.base) + (S.link.demo ? ' (ESP32 in demo mode)' : ''); cls = 'ok'; ico = test ? 'science' : 'wifi'; }
  ic.className = 'connicon ' + cls; setHtml(ic, icon(ico));
  setText('kState', state); setText('kWhere', where);
  $('kDisconnect').hidden = conn.mode === 'none';
  const cur = m => conn.mode === m.mode && conn.base === m.base && conn.mode !== 'none';
  setHtml($('kList'), machineList().map((m, i) => '<li class="' + (cur(m) ? 'on' : '') + '"><span class="mi">' + icon(m.icon) + '</span><span class="mt"><b>' + m.name + '</b><span>' +
    (cur(m) ? (st === 'connected' ? 'Connected' : st === 'lost' ? 'Link lost' : 'Connecting...') : m.where) + '</span></span>' +
    (cur(m) ? '<button class="btn small" data-act="dis">Disconnect</button>' : '<button class="btn small primary" data-act="con" data-i="' + i + '">Connect</button>') +
    (m.del && !cur(m) ? '<button class="mx" data-act="del" data-b="' + m.base + '" aria-label="Forget">' + icon('close') + '</button>' : '') + '</li>').join(''));
  setText('kHint', servedByHttp ? '' : 'This page is opened from a file. To reach a real machine, type the ESP32 address (shown in the Serial Monitor), or open the page from the ESP32 itself. The test machine works without anything.');
  $('kStatusCard').hidden = !live(); $('kCfgCard').hidden = !live();
  if (live()) {
    const L = S.link, age = conn.state === 'connected' ? L.ageMs : Date.now() - lastOk;
    setHtml($('kConn'), kv([
      ['ESP32 address', test ? 'test machine' : L.ip + (L.ap ? ' (own network)' : '')],
      ['Link to the HMI and PLC', L.modbusOk ? (test ? 'Working (simulated)' : L.demo ? 'Demo data (no Modbus)' : 'Working') : 'Lost'],
      ['Last update from the PLC', age < 1500 ? 'Less than 1 s ago' : fx(age / 1000, 1) + ' s ago'],
      ['Modbus cycle time', L.cycleMs + ' ms'], ['Modbus errors', L.errors],
      ['Wi-Fi signal', L.ap ? '-' : L.rssi + ' dBm'], ['ESP32 running for', ago(L.uptimeS).replace(' ago', '')],
      ['Remote control at the HMI', flag(6) ? 'Enabled' : 'Off'], ['PLC sees this gateway', flag(7) ? 'Yes' : 'No']
    ]));
    const a = document.activeElement && document.activeElement.id;
    if (!['kSlave', 'kBaud', 'kPoll'].includes(a) && !renderConnection.touched) { $('kSlave').value = L.slave; $('kBaud').value = L.baud; $('kPoll').value = L.pollMs; }
  }
}
async function search() {
  const cands = [...new Set([...(servedByHttp ? [''] : []), 'http://vffs.local', 'http://192.168.4.1', ...saved()])];
  $('kSearch').disabled = true; setText('kSearchMsg', 'Searching ' + cands.length + ' addresses...');
  const found = [];
  await Promise.all(cands.map(async b => { try { const s = await apiGet('/api/status', 2500, b); if (s && s.link) found.push(b); } catch (e) { } }));
  const list = saved();
  for (const b of found) if (b && !list.includes(b)) list.unshift(b);
  store('vffsMachines', list.slice(0, 6));
  $('kSearch').disabled = false;
  setText('kSearchMsg', found.length ? 'Found: ' + found.map(addrLabel).join(', ') : 'No ESP32 found. Type its address (see the Serial Monitor), or check the Wi-Fi.');
  renderConnection._h = null; renderConnection();
}

// ----- test panel
const TEST_SWITCHES = [['remote', 'Remote control (HMI switch)', 'Off: the PLC takes only Stop from the web page and the app.'],
  ['manualSel', 'Manual selector on the machine', 'Works only in Idle. Needed for the Manual page.'],
  ['estop', 'Emergency stop pressed', 'Stops at once. Release it, then Reset.', 1],
  ['guard', 'Guard door open', 'Stops the machine with a fault.', 1],
  ['plcLink', 'Link ESP32 ↔ HMI ↔ PLC', 'Off: the ESP32 still answers but has no PLC data.'],
  ['wifi', 'Wi-Fi to the ESP32', 'Off: the ESP32 does not answer at all.']];
const TEST_FAULTS = [1, 2, 3, 5, 6, 7, 9, 10, 11];
const TEST_DATA = [['doseOffset', 'Mean dose above the target (g)', 0, 3, 0.1, 1], ['doseSpread', 'Dose spread, ± (g)', 0, 4, 0.1, 1],
  ['rejectPct', 'Bags rejected by the camera (%)', 0, 30, 1, 0], ['fillRate', 'Bucket fill rate (g/s)', 4, 25, 1, 0]];
function sw(id, label, sub, bad) { return '<label class="trow"><span>' + label + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span><span class="switch"><input type="checkbox" id="' + id + '"' + (bad ? ' class="bad"' : '') + '><span></span></span></label>'; }
function buildTest() {
  $('tSwitches').innerHTML = TEST_SWITCHES.map(s => sw('ts_' + s[0], s[1], s[2], s[3])).join('');
  $('tFaults').innerHTML = TEST_FAULTS.map(b => sw('tf_' + b, ALARMS[b], '', 1)).join('');
  $('tData').innerHTML = TEST_DATA.map(d => '<div class="tdata"><span>' + d[1] + '</span><b id="tv_' + d[0] + '"></b><input type="range" id="td_' + d[0] + '" min="' + d[2] + '" max="' + d[3] + '" step="' + d[4] + '"></div>').join('');
  TEST_SWITCHES.forEach(s => $('ts_' + s[0]).addEventListener('change', e => { Sim.setSwitch(s[0], e.target.checked); setTimeout(poll, 300); }));
  TEST_FAULTS.forEach(b => $('tf_' + b).addEventListener('change', e => { Sim.setFault(b, e.target.checked); setTimeout(poll, 300); }));
  TEST_DATA.forEach(d => $('td_' + d[0]).addEventListener('input', e => { Sim.setData(d[0], +e.target.value); renderTest(); }));
  $('tResetSim').onclick = () => { Sim.reset(); for (const k in histCache) delete histCache[k]; poll(); loadPageData(); renderTest(); toast('The test machine started again.'); };
}
function renderTest() {
  if (conn.mode !== 'test') return;
  const s = Sim.sw(), d = Sim.data();
  TEST_SWITCHES.forEach(x => { $('ts_' + x[0]).checked = !!s[x[0]]; });
  TEST_FAULTS.forEach(b => { $('tf_' + b).checked = !!(s.faults & (1 << b)); });
  TEST_DATA.forEach(x => { const r = $('td_' + x[0]); if (document.activeElement !== r) r.value = d[x[0]]; setText('tv_' + x[0], fx(d[x[0]], x[5])); });
}
function renderAbout() {
  setHtml($('kAbout'), kv([['Web page', VERSION], ['ESP32 firmware', live() ? S.link.fw : '-'], ['PLC interface', live() ? 'Version ' + S.link.ifVersion + (S.link.ifVersion === 3 ? '' : ' (this page expects 3)') : '-'], ['PLC program', 'v0.3'], ['Data source', conn.mode === 'test' ? 'Test machine (simulation)' : live() ? (S.link.demo ? 'ESP32 demo mode' : 'S7-1200 through the Weintek HMI') : 'Not connected']]));
}

// ---------- charts (canvas, no library) ----------
function prep(c) {
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height');
  if (!w) return null;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.font = '12px Inter, "Segoe UI", Roboto, Arial, sans-serif';
  return { g: g, w: w, h: h };
}
function niceTicks(min, max, n) {
  const span = max - min || 1, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, t = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) t.push(+v.toFixed(6));
  return t;
}
function axes(g, w, h, min, max, m) {
  g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.lineWidth = 1; g.textAlign = 'right'; g.textBaseline = 'middle';
  const y = v => m.t + (h - m.t - m.b) * (1 - (v - min) / (max - min));
  for (const v of niceTicks(min, max, 4)) { g.beginPath(); g.moveTo(m.l, Math.round(y(v)) + .5); g.lineTo(w - m.r, Math.round(y(v)) + .5); g.stroke(); g.fillText(String(v), m.l - 6, y(v)); }
  return y;
}
function lineChart(c, series, o) {
  const P = prep(c); if (!P) return; const { g, w, h } = P, m = { l: 40, r: series.length > 1 ? 48 : 12, t: 10, b: 22 };
  const all = series.flatMap(s => s.data);
  if (!all.length) { g.fillStyle = css('--muted'); g.textAlign = 'center'; g.fillText('No data yet', w / 2, h / 2); return; }
  let min = o.min !== undefined ? o.min : Math.min(...all) - (o.pad || 0), max = o.max !== undefined ? o.max : Math.max(...all) + (o.pad || 0);
  if (max - min < 0.5) { max += 0.5; if (o.min === undefined) min -= 0.5; }
  const y = axes(g, w, h, min, max, m), n = 120, x = i => m.l + (w - m.l - m.r) * (i / (n - 1));
  g.textBaseline = 'top'; g.fillStyle = css('--muted');
  const total = (n - 1) * o.stepS, parts = w < 420 ? 2 : 4;
  for (let k = 0; k <= parts; k++) { const mins = Math.round(total * (1 - k / parts) / 30) / 2, lab = k === parts ? 'now' : '-' + mins + ' min'; g.textAlign = k === 0 ? 'left' : k === parts ? 'right' : 'center'; g.fillText(lab, x((n - 1) * k / parts), h - m.b + 6); }
  let lastLabelY = null;
  for (const s of series) {
    if (!s.data.length) continue;
    const off = n - s.data.length;
    g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
    s.data.forEach((v, i) => { const X = x(off + i), Y = y(Math.max(min, Math.min(max, v))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
    if (s.name) {
      let ly = y(Math.max(min, Math.min(max, s.data[s.data.length - 1])));
      if (lastLabelY !== null && Math.abs(ly - lastLabelY) < 14) ly = lastLabelY + 14;
      lastLabelY = ly;
      g.fillStyle = s.color; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(s.name, w - m.r + 6, ly);
    }
  }
}
function barChart(c, data, o) {
  const P = prep(c); if (!P) return; const { g, w, h } = P, m = { l: 40, r: 12, t: 24, b: 10 };
  if (!data.length) { g.fillStyle = css('--muted'); g.textAlign = 'center'; g.fillText('No dose yet', w / 2, h / 2); return; }
  const min = Math.min(o.min, ...data), max = Math.max(o.max, ...data), y = axes(g, w, h, min, max, m);
  const n = 40, bw = (w - m.l - m.r) / n, off = n - data.length, base = Math.max(min, o.base);
  data.forEach((v, i) => {
    g.fillStyle = o.bad(v) ? css('--danger') : css('--c1');
    const y0 = y(base), y1 = y(v); g.fillRect(m.l + (off + i) * bw + 1, Math.min(y0, y1), Math.max(1, bw - 2), Math.max(1, Math.abs(y1 - y0)));
  });
  let lx = m.l + 4;
  for (const [v, label, color] of o.lines) {
    g.strokeStyle = color; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(m.l, Math.round(y(v)) + .5); g.lineTo(w - m.r, Math.round(y(v)) + .5); g.stroke(); g.setLineDash([]);
    g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'top';
    if (lx + g.measureText(label).width > w - m.r) { lx = m.l + 4; }
    g.fillText(label, lx, 4); lx += g.measureText(label).width + 16;
  }
}

// ---------- data ----------
let polling = false;
async function poll() {
  if (conn.mode === 'none' || conn.state === 'connecting' || polling) return;
  if (conn.state === 'lost' && !conn.auto) return;
  polling = true;
  try {
    S = await apiGet('/api/status');
    lastOk = Date.now(); conn.fails = 0;
    if (conn.state !== 'connected') { conn.state = 'connected'; toast('Link back.'); loadPageData(); }
  } catch (e) {
    if (++conn.fails >= 3 && conn.state !== 'lost') conn.state = 'lost';
  }
  polling = false;
  render();
}
async function loadPageData() {
  if (!(conn.mode !== 'none' && conn.state === 'connected')) return;
  const p = page();
  try {
    if (p === 'dashboard') histCache['10m'] = await apiGet('/api/history?range=10m');
    if (p === 'alarms') { const r = histRange; histCache[r] = await apiGet('/api/history?range=' + r); alog = await apiGet('/api/alarmlog'); }
    if (p === 'weighing') doses = await apiGet('/api/doses');
    render();
  } catch (e) { }
}

// ---------- start ----------
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('themeBtn').innerHTML = icon(t === 'dark' ? 'light_mode' : 'dark_mode');
  store('vffsTheme', t);
  render();
}
function init() {
  drawIcons(); buildSettings(); buildManual(); buildWeighing(); buildTest();
  conn.auto = load('vffsAuto', true); $('kAuto').checked = conn.auto;
  let t = load('vffsTheme', null);
  if (!t) { try { t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { t = 'light'; } }
  setTheme(t);
  $('themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('menuBtn').onclick = () => { const o = !$('side').classList.contains('open'); $('side').classList.toggle('open', o); $('scrim').classList.toggle('open', o); };
  $('scrim').onclick = closeMenu;
  $('chipLink').onclick = () => { location.hash = '#connection'; };
  $('bannerBtn').onclick = e => { location.hash = e.target.dataset.go; };
  window.addEventListener('hashchange', showPage);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 120); });

  $('bStart').onclick = () => command('start', 'Start the machine?', 'Start');
  $('bStop').onclick = () => command('stop', 'Stop the machine?', 'Stop');
  $('bReset').onclick = $('aReset').onclick = () => command('reset', 'Reset the alarms?', 'Reset');
  $('bHeatOn').onclick = () => command('heat_on', 'Switch the heaters on?', 'Heat on');
  $('bHeatOff').onclick = () => command('heat_off', 'Switch the heaters off?', 'Heat off');
  $('bClear').onclick = () => command('clear', 'Clear all counters?', 'Clear counters');
  $('bRevert').onclick = () => { fillForm(); renderControl(); };
  $('bApply').onclick = async () => {
    const v = formValues(), c = S.set;
    if (!await confirmSend('Send these settings to the PLC?', SETTINGS.map(s => [s.name, fx(c[s.k], s.dec) + ' → ' + fx(v[s.k], s.dec) + ' ' + s.unit]))) return;
    const j = await post('/api/settings', v);
    await poll();
    if (j.ok) { const same = SETTINGS.every(s => Math.abs(S.set[s.k] - v[s.k]) < 0.06); toast(same ? 'The PLC took the new settings.' : 'Sent, but the PLC shows other values. Check "In the PLC".', !same); formTouched = false; }
    else toast(j.msg, true);
    render();
  };
  $('mUnlock').onclick = async () => { if (await confirmSend('Unlock manual control', [['Use', 'Jog and single outputs'], ['Works only if', 'the machine is in manual mode']], 'Unlock')) { const j = await post('/api/manual', { bit: 14, on: (S.manual >> 14) & 1 }); manualUnlocked = j.result !== 6 && j.result !== 0; if (!manualUnlocked) toast(j.msg, true); renderManual(); } };
  document.querySelectorAll('#hRange button').forEach(b => b.onclick = () => { histRange = b.dataset.r; document.querySelectorAll('#hRange button').forEach(x => x.classList.toggle('on', x === b)); loadPageData(); render(); });

  // connection page
  $('kList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'dis') disconnect();
    if (b.dataset.act === 'con') { const m = machineList()[+b.dataset.i]; connect(m.mode, m.base); }
    if (b.dataset.act === 'del') { store('vffsMachines', saved().filter(x => x !== b.dataset.b)); renderConnection(); }
  });
  $('kDisconnect').onclick = disconnect;
  $('kConnect').onclick = () => { const a = normAddr($('kAddr').value); if (!a) { toast('Type an address, for example 192.168.1.50', true); return; } $('kAddr').value = ''; connect('esp', a); };
  $('kAddr').addEventListener('keydown', e => { if (e.key === 'Enter') $('kConnect').click(); });
  $('kSearch').onclick = search;
  $('kAuto').onchange = e => { conn.auto = e.target.checked; store('vffsAuto', conn.auto); };
  $('bTest').onclick = async () => { setText('tResult', 'Testing...'); $('tResult').style.color = ''; const j = await post('/api/test', {}); setText('tResult', (j.msg || '') + (j.ms !== undefined ? ' Answer time ' + j.ms + ' ms.' : '')); $('tResult').style.color = css(j.ok ? '--ok' : '--danger'); };
  ['kSlave', 'kBaud', 'kPoll'].forEach(id => $(id).addEventListener('input', () => { renderConnection.touched = true; }));
  $('bSaveCfg').onclick = async () => {
    const d = { slave: $('kSlave').value, baud: $('kBaud').value, pollMs: $('kPoll').value, newPin: $('kNewPin').value };
    if (!await confirmSend('Save the connection settings?', [['HMI station number', d.slave], ['Baud rate', d.baud], ['Poll time', d.pollMs + ' ms'], ['Control PIN', d.newPin ? 'will change' : 'stays the same']], 'Save')) return;
    const j = await post('/api/config', d);
    if (j.ok) { if (d.newPin) pin = d.newPin; $('kNewPin').value = ''; renderConnection.touched = false; }
    toast(j.ok ? 'Saved.' : j.msg, !j.ok); poll();
  };

  // first connection: the last one used; else the ESP32 that served this page; else the Connection page
  const last = load('vffsLast', null);
  showPage();
  // website demo copy: always start with the built-in test machine
  connect('test', '');
  setInterval(poll, 1000);
  setInterval(loadPageData, 3000);
}
init();
