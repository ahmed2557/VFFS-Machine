// Test machine: a simulation of the ESP32 + HMI + PLC inside the page, for testing without hardware.
// It answers the same /api/... calls with the same JSON and follows the same rules as FB_Remote and
// FC_ApplySettings in the PLC (limits, states, remote switch, manual mode, PIN). Nothing leaves the page.
'use strict';

const Sim = (() => {
  const LIM = { bpm: [20, 60], bagLen: [50, 120], target: [10, 100], spJaws: [80, 180], spBand: [80, 180] };
  const MOMENTARY = [10, 11, 15, 16, 17, 18, 19];
  const RESULT = { 1: 'Done', 2: 'Outside the limits. Nothing was changed.', 3: 'Not allowed in this machine state.', 4: 'Remote control is switched off at the HMI.', 5: 'The PLC did not answer.', 6: 'Wrong PIN.' };
  const JAW_TIMES_S = 0.1 + 0.3 + 0.1 + 0.1;   // jaw close + seal + knife + jaw open, the defaults of DB_Param  [ASSUMED]

  let t0, st, set, sw, data, manual, holdUntil, sim, h10, h60, doses, alog, last, pin, cfg, timer;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function up() { return Math.floor((Date.now() - t0) / 1000); }
  function flag(b) { return (st.flags >> b) & 1; }
  function setFlag(b, on) { st.flags = on ? st.flags | (1 << b) : st.flags & ~(1 << b); }

  function reset() {
    t0 = Date.now();
    pin = '1234';
    cfg = { slave: 1, baud: 9600, pollMs: 500 };
    set = { bpm: 40, bagLen: 70, target: 30, spJaws: 120, spBand: 120 };
    // switches and faults the user can change on the Test panel
    sw = { remote: true, manualSel: false, estop: false, guard: false, plcLink: true, wifi: true, faults: 0 };
    // test data the user can change
    data = { doseOffset: 1.4, doseSpread: 1.2, rejectPct: 3, fillRate: 12 };
    st = { state: 0, alarms: 0, flags: 0, bpm: 0, meanDose: 0, lastDose: 0, giveAway: 0, tJaws: 26, tBand: 26, w: [0, 0, 0], lane: 1,
      made: 1250, good: 1213, rejected: 37, under: 3, over: 11, waits: 2, camTimeouts: 1, marksMissed: 0, ack: 0, result: 0 };
    manual = 0; holdUntil = {}; sim = { t: 0, acc: 0, stateT: 0, heat: false, seq: 0 };
    doses = []; alog = []; last = { alarms: 0, estop: false, guard: false, link: true, h10: Date.now(), h60: Date.now() };
    // history of an earlier run, so the charts have something to show at once
    h10 = { bpm: [], dose: [], tJaws: [], tBand: [], rej: [] }; h60 = { bpm: [], dose: [], tJaws: [], tBand: [], rej: [] };
    for (let i = 0; i < 120; i++) {
      const run10 = i < 100, run60 = i < 118;
      h10.bpm.push(run10 ? +(40 + rnd(-0.6, 0.6)).toFixed(1) : 0); h10.dose.push(+(31.4 + rnd(-0.3, 0.3)).toFixed(2));
      h10.tJaws.push(+(run10 ? 120 + rnd(-1, 1) : 120 - (i - 100) * 3).toFixed(1)); h10.tBand.push(+(run10 ? 120 + rnd(-1, 1) : 120 - (i - 100) * 3.2).toFixed(1)); h10.rej.push(+(2.9 + rnd(-0.1, 0.1)).toFixed(1));
      h60.bpm.push(run60 ? +(40 + rnd(-0.8, 0.8)).toFixed(1) : 0); h60.dose.push(+(31.4 + rnd(-0.4, 0.4)).toFixed(2));
      h60.tJaws.push(+(i < 8 ? 26 + i * 12 : 120 + rnd(-1, 1)).toFixed(1)); h60.tBand.push(+(i < 8 ? 26 + i * 11.5 : 120 + rnd(-1, 1)).toFixed(1)); h60.rej.push(+(i < 8 ? 0 : 3 + rnd(-0.3, 0.3)).toFixed(1));
    }
    for (let i = 0; i < 40; i++) doses.push(+(set.target + data.doseOffset + rnd(-data.doseSpread, data.doseSpread)).toFixed(2));
    st.meanDose = doses.slice(-20).reduce((a, b) => a + b, 0) / 20; st.lastDose = doses[39]; st.giveAway = st.meanDose - set.target;
    log(9, true, 3100); log(9, false, 3000); log(10, true, 1500); log(10, false, 1490);
  }

  function log(code, on, agoS) { alog.unshift({ t: up() - (agoS || 0), code: code, on: !!on }); alog.length = Math.min(alog.length, 40); }

  function command(code, nv) {
    let res = 1;
    if (code === 2) { if (st.state >= 5 && st.state <= 30) { st.state = 40; sim.stateT = 0; } }     // STOP always
    else if (!sw.remote) res = 4;
    else if (code === 1) { if (st.state === 0 && !flag(2) && !st.alarms) { st.state = 5; sim.stateT = 0; } else res = 3; }
    else if (code === 3) { if (!sw.estop && !sw.guard && !sw.faults) { setFlag(2, false); st.alarms = 0; if (st.state === 90 || st.state === 99) st.state = 0; } }
    else if (code === 4) sim.heat = true;
    else if (code === 5) sim.heat = false;
    else if (code === 6) { if (st.state === 0) { Object.assign(st, { made: 0, good: 0, rejected: 0, under: 0, over: 0, waits: 0, camTimeouts: 0, meanDose: 0, lastDose: 0, giveAway: 0 }); doses = []; } else res = 3; }
    else if (code >= 7 && code <= 9) { if (st.state === 0 || st.state === 50) st.w[code - 7] = 0; else res = 3; }
    else if (code === 10) {
      // the same check as FC_ApplySettings
      const speed = nv.bagLen * nv.bpm / 60, ride = speed * JAW_TIMES_S + 2;
      const ok = Object.keys(LIM).every(k => nv[k] >= LIM[k][0] && nv[k] <= LIM[k][1]) && speed <= 75 && ride <= 50;
      if (st.state !== 0) res = 3; else if (!ok) res = 2; else Object.assign(set, nv);
    } else res = 2;
    sim.seq++; st.ack = sim.seq; st.result = res;
    return res;
  }

  function fault(stop) { if (stop && st.state >= 5 && st.state <= 50) { st.state = 90; setFlag(2, true); } }

  function step(dt) {
    sim.t += dt; sim.stateT += dt;
    // switches and faults
    st.alarms = sw.faults | ((sw.estop || sw.guard) ? 1 : 0);   // an alarm stays while its cause is there
    setFlag(4, sw.estop); setFlag(5, sw.guard); setFlag(6, sw.remote); setFlag(7, sw.remote && sw.plcLink && sw.wifi);
    if (sw.estop) { if (st.state !== 99) { st.state = 99; setFlag(2, true); } }
    else if (st.alarms) fault(true);
    if (sw.manualSel && st.state === 0) st.state = 50;
    if (!sw.manualSel && st.state === 50) st.state = 0;
    setFlag(3, st.state === 50);
    setFlag(8, !!(sw.faults & (1 << 5))); setFlag(9, !!(sw.faults & (1 << 6)));
    // heaters
    const heat = (sim.heat || (st.state >= 10 && st.state <= 40)) && !sw.estop;
    const tj = heat && !flag(8) ? set.spJaws : 26, tb = heat && !flag(9) ? set.spBand : 26;
    st.tJaws += (tj - st.tJaws) * 0.25 * dt + 0.15 * Math.sin(sim.t / 3);
    st.tBand += (tb - st.tBand) * 0.27 * dt + 0.12 * Math.cos(sim.t / 4);
    const tempOk = Math.abs(st.tJaws - set.spJaws) < 5 && Math.abs(st.tBand - set.spBand) < 5;
    setFlag(0, tempOk); setFlag(1, heat); setFlag(10, sim.heat);
    // sequence
    if (st.state === 5 && sim.stateT > 2) { st.state = 10; sim.stateT = 0; }
    if (st.state === 10 && tempOk) { st.state = 20; sim.stateT = 0; }
    if (st.state === 20 && sim.stateT > 3) { st.state = 30; sim.stateT = 0; }
    if (st.state === 40 && sim.stateT > 1.5) { st.state = 0; }
    if (st.state >= 20 && st.state <= 30) for (let i = 0; i < 3; i++) st.w[i] = Math.min(st.w[i] + data.fillRate * dt * rnd(0.8, 1.2), set.target + 1.6);
    if (st.state === 30) {
      sim.acc += set.bpm / 60 * dt;
      while (sim.acc >= 1) {
        sim.acc -= 1; st.made++;
        const d = set.target + data.doseOffset + rnd(-data.doseSpread, data.doseSpread);
        st.lastDose = d; doses.push(+d.toFixed(2)); if (doses.length > 40) doses.shift();
        const l20 = doses.slice(-20); st.meanDose = l20.reduce((a, b) => a + b, 0) / l20.length; st.giveAway = st.meanDose - set.target;
        if (d < set.target - 2.5) st.under++; if (d > set.target + 2.5) st.over++;
        if (Math.random() * 100 < data.rejectPct) st.rejected++; else st.good++;
        st.lane = st.lane % 3 + 1; st.w[st.lane - 1] = 0;
      }
      st.bpm += (set.bpm - st.bpm) * Math.min(1, 0.8 * dt);
    } else st.bpm *= Math.max(0, 1 - 0.8 * dt);
    if (st.bpm < 0.05) st.bpm = 0;
    // manual bits
    const now = Date.now();
    for (const b of MOMENTARY) if ((manual >> b) & 1 && now > (holdUntil[b] || 0)) manual &= ~(1 << b);
    if (!flag(3) || !sw.remote || !sw.plcLink) manual = 0;
    // alarm log (as the ESP32 does it)
    const ch = st.alarms ^ last.alarms;
    for (let b = 0; b < 12; b++) if ((ch >> b) & 1) log(b, (st.alarms >> b) & 1);
    last.alarms = st.alarms;
    if (sw.estop !== last.estop) { log(20, sw.estop); last.estop = sw.estop; }
    if (sw.guard !== last.guard) { log(21, sw.guard); last.guard = sw.guard; }
    if (sw.plcLink !== last.link) { log(22, !sw.plcLink); last.link = sw.plcLink; }
    // history
    for (const [h, key, every] of [[h10, 'h10', 5000], [h60, 'h60', 30000]]) {
      if (now - last[key] >= every) {
        last[key] = now;
        h.bpm.push(+st.bpm.toFixed(1)); h.dose.push(+st.meanDose.toFixed(2)); h.tJaws.push(+st.tJaws.toFixed(1)); h.tBand.push(+st.tBand.toFixed(1));
        h.rej.push(st.made ? +(100 * st.rejected / st.made).toFixed(1) : 0);
        for (const k in h) if (h[k].length > 120) h[k].shift();
      }
    }
  }

  function status() {
    const r = v => Math.round(v * 100) / 100;
    return {
      state: st.state, alarms: st.alarms, flags: st.flags, bpm: r(st.bpm), meanDose: r(st.meanDose), lastDose: r(st.lastDose), giveAway: r(st.giveAway),
      tJaws: r(st.tJaws), tBand: r(st.tBand), w: st.w.map(x => Math.round(x * 10) / 10), lane: st.lane, made: st.made, good: st.good, rejected: st.rejected,
      under: st.under, over: st.over, waits: st.waits, camTimeouts: st.camTimeouts, marksMissed: st.marksMissed,
      set: Object.assign({}, set), manual: manual >>> 0, ack: st.ack, result: st.result,
      link: { modbusOk: sw.plcLink, ageMs: sw.plcLink ? 150 : 9000, errors: 0, uptimeS: up(), demo: true, fw: 'test machine', ip: 'in this page', rssi: -48, ap: false,
        slave: cfg.slave, baud: cfg.baud, pollMs: cfg.pollMs, cycleMs: 35, ifVersion: 3 }
    };
  }

  function res(r) { return { ok: r === 1, result: r, msg: RESULT[r] || 'No result' }; }
  const delay = ms => new Promise(ok => setTimeout(ok, ms));

  async function get(path) {
    await delay(60);
    if (!sw.wifi) throw new Error('No answer');
    if (path.startsWith('/api/status')) return status();
    if (path.startsWith('/api/history')) { const h = path.includes('range=1h') ? h60 : h10; return Object.assign({ stepS: path.includes('range=1h') ? 30 : 5 }, JSON.parse(JSON.stringify(h))); }
    if (path.startsWith('/api/doses')) return { target: set.target, doses: doses.slice() };
    if (path.startsWith('/api/alarmlog')) return { uptimeS: up(), log: alog.slice() };
    throw new Error('Not found');
  }

  async function post(path, a) {
    await delay(150);
    if (!sw.wifi) throw new Error('No answer');
    if (path === '/api/test') return sw.plcLink ? { ok: true, ms: 35, msg: 'The HMI answered.' } : { ok: false, ms: 1000, msg: 'No answer from the HMI. Check the cable, station number and baud rate.' };
    if (a.pin !== pin) return res(6);
    if (!sw.plcLink && path !== '/api/config') return res(5);
    if (path === '/api/cmd') {
      const code = { start: 1, stop: 2, reset: 3, heat_on: 4, heat_off: 5, clear: 6, tare1: 7, tare2: 8, tare3: 9 }[a.cmd];
      return res(code ? command(code) : 2);
    }
    if (path === '/api/settings') {
      const nv = {}; for (const k in LIM) nv[k] = parseFloat(a[k]);
      if (!Object.keys(LIM).every(k => nv[k] >= LIM[k][0] && nv[k] <= LIM[k][1])) return res(2);
      return res(command(10, nv));
    }
    if (path === '/api/manual') {
      const bit = parseInt(a.bit, 10);
      if (!(bit >= 0 && bit <= 19)) return res(2);
      if (!flag(3)) { manual = 0; return res(3); }
      if (!sw.remote) { manual = 0; return res(4); }
      if (a.on === '1' || a.on === 1) { manual |= (1 << bit); holdUntil[bit] = Date.now() + 800; } else manual &= ~(1 << bit);
      return res(1);
    }
    if (path === '/api/config') {
      const s = +a.slave, b = +a.baud, p = +a.pollMs;
      if (!(s >= 1 && s <= 247 && [9600, 19200, 38400, 57600, 115200].includes(b) && p >= 200 && p <= 5000)) return res(2);
      Object.assign(cfg, { slave: s, baud: b, pollMs: p });
      if (a.newPin && a.newPin.length >= 4 && a.newPin.length <= 8) pin = a.newPin;
      return res(1);
    }
    return res(2);
  }

  function start() { if (!timer) { reset(); timer = setInterval(() => step(0.25), 250); } }
  function stop() { clearInterval(timer); timer = null; }

  return {
    start, stop, get, post, reset,
    get running() { return !!timer; },
    sw: () => sw, data: () => data,
    setSwitch(k, v) { sw[k] = v; },
    setFault(bit, on) { sw.faults = on ? sw.faults | (1 << bit) : sw.faults & ~(1 << bit); },
    setData(k, v) { data[k] = v; },
  };
})();
