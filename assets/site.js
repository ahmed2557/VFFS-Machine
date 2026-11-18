/* Shared code for every page: menu, back/next, picture dictionary data, tables, enlarging pictures. */
(function () {
  const PAGES = [
    ['index.html', 'Home', 'Start here'],
    ['parts.html', 'Meet the parts', 'Picture dictionary'],
    ['how.html', 'How it works', 'Top to bottom'],
    ['electrical.html', 'Electrical', 'Power, PLC, safety'],
    ['pneumatic.html', 'Pneumatic', 'Air and cylinders'],
    ['control.html', 'Control & software', 'States, camera, apps'],
    ['watch.html', 'Watch', 'Film, 3D, videos'],
    ['results.html', 'Results & cost', 'Numbers and objectives'],
  ];

  /* ---------- picture dictionary (used by parts.html and the word chips) ---------- */
  // g: m = machine part, e = electrical, s = signal word, p = pneumatic
  const G = [
    // machine parts, top to bottom
    ['hopper', 'm', 'Hopper', 'parts/hopper.jpg', 'A big open box that stores the candy.', 'Holds 140 L (about 84 kg). Candy flows out of the bottom by gravity. It lifts off for cleaning.'],
    ['splitter', 'm', 'Splitter', 'parts/splitter.jpg', 'A box under the hopper with three outlets.', 'Splits the candy flow into three paths, one for each lane. It also carries the diverter.'],
    ['diverter', 'm', 'Diverter', 'parts/diverter.jpg', 'A small sliding chute that points the candy flow.', 'Moved by two air cylinders. It sends candy to lane 1, 2 or 3, always to the lightest bucket.'],
    ['lanes', 'm', 'Lanes', 'parts/lanes.jpg', 'Three sloped channels with walls.', 'Candy slides down them at 20° by gravity, from the splitter to the brush gates.'],
    ['gates', 'm', 'Brush gates', 'parts/gates.jpg', 'Soft brush strips that open and close the end of each lane.', 'Let candy into the bucket, then close at the right weight. The soft bristles do not crush the candy.'],
    ['buckets', 'm', 'Weigh buckets', 'parts/buckets.jpg', 'Three small stainless buckets.', 'Each one holds one dose (30 g) while it is weighed.'],
    ['loadcells', 'm', 'Load cells', 'parts/loadcells.jpg', 'A metal bar that bends a tiny amount under weight and turns it into an electric signal.', 'One under each bucket (3 kg size). Tells the PLC the weight in 0.11 g steps.'],
    ['doors', 'm', 'Bucket doors', 'parts/doors.jpg', 'A flap at the bottom of each bucket.', 'Opens to drop the dose into the funnel. A cylinder pushes its lever through a roller.'],
    ['gassprings', 'm', 'Gas springs', 'parts/gassprings.jpg', 'A sealed tube with gas inside that acts like a strong spring.', 'Pulls each bucket door closed again when the cylinder goes back.'],
    ['funnel', 'm', 'Collection funnel', 'parts/funnel.jpg', 'A wide funnel under the three buckets.', 'Joins the doses into one stream that falls down the forming tube.'],
    ['roll', 'm', 'Film roll and unwind', 'parts/roll.jpg', 'The shaft that holds the roll of plastic film, with a small motor.', 'The roll is 200 mm wide and makes about 24,000 bags. The unwind motor turns it so the film is not pulled hard.'],
    ['dancer', 'm', 'Dancer arm', 'parts/dancer.jpg', 'A swinging arm with rollers that the film passes over.', 'Keeps the film tension steady. Its position tells the PLC when to run the unwind motor.'],
    ['photocell', 'm', 'Eye-mark photocell', 'parts/photocell.jpg', 'A light sensor that sees a small printed mark on the film.', 'Makes sure every bag is cut in the right place, so the print is always in the middle.'],
    ['collar', 'm', 'Forming collar', 'parts/collar.jpg', 'A curved metal shoulder.', 'Folds the flat film into a round tube. Its size sets the bag width (94 mm).'],
    ['tube', 'm', 'Forming tube', 'parts/tube.jpg', 'A 60 mm pipe under the collar.', 'The film wraps around it, and the candy falls through it into the bag.'],
    ['pullbelts', 'm', 'Pull belts', 'parts/pullbelts.jpg', 'Two rubber belts on both sides of the tube, driven by stepper motors.', 'Grip the film and pull it down at a steady speed.'],
    ['sealband', 'm', 'Heated seal band', 'img/sealband.jpg', 'A thin non-stick band that runs on two pulleys, pressed by a heated shoe.', 'Seals the long back seam of the bag while the film keeps moving.'],
    ['jaws', 'm', 'Flying jaws', 'parts/jaws.jpg', 'Two heated bars on a carriage that close on the film.', 'Make the top seal of one bag and the bottom seal of the next. They move down with the film while sealing (120 °C).'],
    ['jawlift', 'm', 'Jaw lift', 'parts/jawlift.jpg', 'Guide rods and a stepper motor that move the jaw carriage.', 'Moves the jaws down with the film (28 mm) and back up.'],
    ['knife', 'm', 'Knife', 'parts/knife.jpg', 'A thin blade inside the front jaw.', 'Cuts in the middle of the cross seal, so one cut separates two bags.'],
    ['conveyor', 'm', 'Conveyor', 'parts/conveyor.jpg', 'A moving belt under the machine.', 'Carries finished bags past the camera to the crate.'],
    ['camera', 'm', 'Camera station', 'parts/camera.jpg', 'A Raspberry Pi camera with a ring light on a small mast.', 'Takes a picture of every bag and decides good or bad.'],
    ['reject', 'm', 'Reject pusher', 'parts/reject.jpg', 'An air cylinder with a flat paddle next to the belt.', 'Pushes a bad bag off the belt into the reject tray.'],
    ['cabinet', 'm', 'Control cabinet', 'parts/cabinet.jpg', 'A closed metal box with all the electrical parts.', 'Holds the PLC, power supplies, drivers and safety parts. The touch screen is on its door.'],
    ['valvepanel', 'm', 'Valve panel', 'parts/airsupply.jpg', 'A plate with the 12 air valves and the air pipes.', 'Each valve sends air to one cylinder when the PLC tells it to.'],
    ['frame', 'm', 'Frame', 'parts/frame.jpg', 'Welded 40 × 40 mm steel tubes.', 'Holds every unit. It splits into an upper and lower part for transport.'],

    // electrical
    ['mains', 'e', '230 V mains', 'icons/mains.svg', 'Normal power from the wall socket: 230 V AC.', 'The only power that comes into the machine. It stays inside the cabinet.'],
    ['mainswitch', 'e', 'Main switch', 'icons/mainswitch.svg', 'A big rotary switch that turns all power on or off.', 'Q0, 16 A. It can be locked off during repairs.'],
    ['rcbo', 'e', 'RCBO', 'icons/rcbo.svg', 'A breaker that also trips if a little current leaks to earth (through a person).', 'F0, 30 mA. Protects people from electric shock.'],
    ['breaker', 'e', 'Circuit breaker', 'icons/breaker.svg', 'An automatic switch that turns off if too much current flows.', 'F1 to F6. One for each branch, so a fault in one part does not stop everything.'],
    ['psu', 'e', 'Power supply', 'icons/psu.svg', 'A box that changes 230 V AC into a low, safe DC voltage.', 'Four of them: G1 24 V (PLC, valves), G2 36 V (stepper motors), G3 5 V (Raspberry Pi, ESP32), G4 24 V (the two gear motors).'],
    ['plc', 'e', 'PLC', 'icons/plc.svg', 'Programmable Logic Controller: a tough industrial computer.', 'Siemens S7-1200. The brain of the machine: reads every sensor and switches every motor, heater and valve.'],
    ['modules', 'e', 'I/O modules', 'icons/plc.svg', 'Extra blocks that clip onto the PLC to add more inputs and outputs.', 'SM 1223 (on/off signals), SM 1231 AI (load cells), SM 1231 TC (temperatures).'],
    ['hmi', 'e', 'HMI (touch screen)', 'icons/hmi.svg', 'Human-Machine Interface: the screen the operator uses.', 'Weintek 7-inch screen on the cabinet door. Start, stop, settings and alarms.'],
    ['esp32', 'e', 'ESP32', 'icons/esp32.svg', 'A small, cheap board with Wi-Fi.', 'Reads data from the touch screen and sends it to the website and the phone app.'],
    ['pi', 'e', 'Raspberry Pi + camera', 'icons/pi.svg', 'A small computer with a high-quality camera.', 'Checks each bag with a small neural network and tells the PLC good or bad.'],
    ['relay', 'e', 'Relay', 'icons/relay.svg', 'A switch moved by a small electromagnet (coil).', 'A small 24 V signal from the PLC switches a bigger load: K1 unwind motor, K2 conveyor.'],
    ['contactor', 'e', 'Contactor', 'icons/contactor.svg', 'A big, strong relay for power circuits.', 'KM1 cuts the 36 V motor power and the heaters at an emergency stop.'],
    ['ssr', 'e', 'SSR', 'icons/ssr.svg', 'Solid-State Relay: an electronic switch with no moving parts.', 'Switches the heaters on and off many times a minute without wearing out.'],
    ['safetyrelay', 'e', 'Safety relay', 'icons/safetyrelay.svg', 'A special relay that watches the emergency stop and the guard door.', 'K0. If anything is wrong it drops out and the machine can only restart after Reset.'],
    ['estop', 'e', 'Emergency stop', 'icons/estop.svg', 'A big red mushroom button.', 'Anyone can press it to stop the machine at once.'],
    ['buttons', 'e', 'Push buttons', 'icons/buttons.svg', 'Start, Stop and Reset buttons and an Auto/Manual selector.', 'On the cabinet door, for the operator.'],
    ['stepper', 'e', 'Stepper motor', 'icons/stepper.svg', 'A motor that turns in small, exact steps, one step per pulse.', 'Four of them: two pull the film, one lifts the jaws, one moves the seal band.'],
    ['driver', 'e', 'Stepper driver', 'icons/driver.svg', 'A box between the PLC and a stepper motor.', 'Turns small PLC pulses into strong motor current from the 36 V supply.'],
    ['gearmotor', 'e', 'Gear motor', 'icons/gearmotor.svg', 'An ordinary motor with a gearbox to make it slower and stronger.', 'Two of them, 24 V DC: film unwind and conveyor. Fed by their own 24 V supply G4 and switched on and off by relays K1 and K2.'],
    ['encoder', 'e', 'Encoder', 'icons/encoder.svg', 'A sensor that gives pulses as a wheel turns.', '2,500 pulses per turn on a 40 mm roller: measures the film every 0.05 mm.'],
    ['sensor', 'e', 'Optical sensor', 'icons/photo.svg', 'A sensor that uses a light beam to see an object.', 'Bag sensor before the camera, and the eye-mark photocell on the film.'],
    ['inductive', 'e', 'Inductive sensor', 'icons/inductive.svg', 'A sensor that detects metal close to its tip without touching.', 'Two of them on the dancer arm: film store low and film store full.'],
    ['transmitter', 'e', '4–20 mA transmitter', 'icons/transmitter.svg', 'A small box that makes the tiny load-cell signal strong and clean.', 'Sends 4 mA at no weight up to 20 mA at full weight to the PLC.'],
    ['thermo', 'e', 'Thermocouple', 'icons/thermo.svg', 'A temperature sensor made of two different metal wires.', 'Type K. One in the jaws and one in the seal band shoe.'],
    ['heater', 'e', 'Cartridge heater', 'icons/heater.svg', 'A metal rod that gets hot when power flows through it.', 'Three of 150 W: two in the jaws, one in the seal band shoe.'],
    ['opto', 'e', 'Opto-isolator', 'icons/opto.svg', 'A tiny part that passes a signal by light, with no wire connection.', 'PC817. Protects the Raspberry Pi (3.3 V) from the PLC (24 V).'],
    // signal words
    ['di', 's', 'Digital input', null, 'An on/off signal going INTO the PLC: 24 V = on, 0 V = off.', 'Buttons, sensors, the camera answer. The machine has 17 (plus 2 encoder tracks).'],
    ['do', 's', 'Digital output', null, 'An on/off signal coming OUT of the PLC.', 'Switches valves, relays, the SSRs and the camera trigger. The machine has 19.'],
    ['pulse', 's', 'Pulse output', null, 'A fast stream of on/off pulses. Each pulse = one motor step.', 'Four pulse outputs drive the stepper motors. More pulses per second = faster.'],
    ['analog', 's', 'Analog signal', null, 'A signal that can take any value, not just on/off.', 'The load cells send 4–20 mA: the more weight, the more current.'],
    ['pid', 's', 'PID control', null, 'A way for the PLC to hold a value steady by measuring it and correcting again and again.', 'Holds the sealing temperature at 120 °C ± 2 °C.'],

    // pneumatic
    ['compressor', 'p', 'Compressor', 'icons/compressor.svg', 'A machine that pumps air into a tank under pressure.', 'Oil-free, with a 24 L tank (6 to 8 bar) and an air dryer. Intake about 130 L/min or more; the machine needs about 23 L/min.'],
    ['shutoff', 'p', 'Shut-off valve', 'icons/shutoff.svg', 'A hand valve that closes the air line.', '0V1, a manual 3/2 valve. It closes the air, lets the trapped air out, and can be locked during repairs.'],
    ['frl', 'p', 'Filter-regulator', 'icons/frl.svg', 'Cleans water and dirt out of the air and sets the pressure.', '0Z1. Sets 5 bar for all cylinders. A second unit (0Z2) gives 3 bar to the seal band press.'],
    ['pswitch', 'p', 'Pressure switch', 'icons/pswitch.svg', 'A switch that turns on when the air pressure is high enough.', 'B5. Tells the PLC the air is OK. Low air = the machine stops.'],
    ['valve', 'p', '3/2 and 5/2 valves', 'icons/valve.svg', 'A 3/2 valve (3 ports, 2 positions) fills or empties a single-acting cylinder. A 5/2 valve (5 ports) sends air to one side of a double-acting cylinder or the other.', 'Twelve in all: nine 3/2 valves and three 5/2 valves (the two diverters and the pusher).'],
    ['solenoid', 'p', 'Solenoid', 'icons/solenoid.svg', 'An electric coil that pushes the valve when it gets 24 V.', 'The PLC switches each solenoid (Y1 to Y12) through a digital output.'],
    ['spring', 'p', 'Spring return', 'icons/valve.svg', 'A spring inside the valve that pushes it back when the solenoid has no power.', 'If power is lost, every valve springs back. Nine cylinders also have a spring inside, so every cylinder goes to a safe rest position.'],
    ['cylinder', 'p', 'Air cylinder', 'icons/cylinder.svg', 'A tube with a piston and rod. In a single-acting cylinder air pushes the rod out and a spring brings it back; in a double-acting one air does both.', 'Twelve: nine single-acting (gates, doors, seal band, jaws, knife) and three double-acting (two diverters, pusher).'],
    ['flowctrl', 'p', 'Flow control', 'icons/flowctrl.svg', 'A small screw valve with a check valve that limits how fast air flows one way.', 'One on each single-acting cylinder, two on each double-acting one. Sets how fast each rod moves, so nothing slams.'],
    ['tubing', 'p', 'Air tubes and manifold', 'icons/tubing.svg', 'Plastic tubes carry the air; the manifold is a block that feeds all valves.', 'Connect the air supply to the valves and the valves to the cylinders.'],
  ];
  const SYM = {
    cylsa: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="2" y="7" width="40" height="16" fill="#fff" stroke="#1c2633" stroke-width="2"/><rect x="8" y="7" width="3" height="16" fill="#1c2633"/><path d="M11 15h50" stroke="#1c2633" stroke-width="2.4"/><path d="M12 15l3-6 3 12 3-12 3 12 3-12 3 12 3-12 3 12 3-6" fill="none" stroke="#1c2633" stroke-width="1.3"/></svg>',
    valve32: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="8" y="5" width="22" height="20" fill="#fff" stroke="#1c2633" stroke-width="2"/><rect x="30" y="5" width="22" height="20" fill="#fff" stroke="#1c2633" stroke-width="2"/><path d="M14 23V8M12 11l2-3 2 3M24 23v-5M21 18h6M35 8l10 14M36 23v-5M33 18h6" stroke="#1c2633" stroke-width="1.6" fill="none"/><path d="M52 15h3l1.5-4 3 8 1.5-4" fill="none" stroke="#1c2633" stroke-width="1.4"/><rect x="1" y="9" width="7" height="12" fill="#fff" stroke="#1c2633" stroke-width="1.4"/></svg>',
    cylinder: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="2" y="7" width="40" height="16" fill="#fff" stroke="#1c2633" stroke-width="2"/><rect x="10" y="7" width="3" height="16" fill="#1c2633"/><path d="M13 15h48" stroke="#1c2633" stroke-width="2.4"/></svg>',
    valve: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="4" y="5" width="26" height="20" fill="#fff" stroke="#1c2633" stroke-width="2"/><rect x="30" y="5" width="26" height="20" fill="#fff" stroke="#1c2633" stroke-width="2"/><path d="M10 21l6-12M22 21V9M36 9l6 12M48 9v12" stroke="#1c2633" stroke-width="1.6"/></svg>',
    spring: '<svg width="64" height="30" viewBox="0 0 64 30"><path d="M4 15h8l3-8 6 16 6-16 6 16 6-16 3 8h18" fill="none" stroke="#1c2633" stroke-width="2"/></svg>',
    solenoid: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="20" y="6" width="14" height="18" fill="#fff" stroke="#1c2633" stroke-width="2"/><path d="M34 6l-14 18" stroke="#1c2633" stroke-width="1.6"/><path d="M34 15h26" stroke="#1c2633" stroke-width="2"/></svg>',
    flowctrl: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="16" y="4" width="32" height="22" fill="#fff" stroke="#1c2633" stroke-width="2"/><path d="M22 10l10 10M32 10L22 20" stroke="#1c2633" stroke-width="1.6"/><circle cx="40" cy="15" r="3.5" fill="none" stroke="#1c2633" stroke-width="1.6"/></svg>',
    frl: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="6" y="5" width="52" height="20" fill="none" stroke="#1c2633" stroke-width="1.6" stroke-dasharray="4 3"/><path d="M20 7l7 8-7 8-7-8z" fill="#fff" stroke="#1c2633" stroke-width="1.6"/><rect x="34" y="9" width="12" height="12" fill="#fff" stroke="#1c2633" stroke-width="1.6"/><circle cx="50" cy="10" r="3" fill="#fff" stroke="#1c2633"/></svg>',
    shutoff: '<svg width="64" height="30" viewBox="0 0 64 30"><path d="M4 15h18M42 15h18" stroke="#1c2633" stroke-width="2"/><rect x="22" y="7" width="20" height="16" fill="#fff" stroke="#1c2633" stroke-width="2"/></svg>',
    pswitch: '<svg width="64" height="30" viewBox="0 0 64 30"><rect x="22" y="4" width="20" height="16" fill="#fff" stroke="#1c2633" stroke-width="2"/><path d="M32 20v8" stroke="#1c2633" stroke-width="2"/><path d="M26 8l12 8" stroke="#1c2633" stroke-width="1.6"/></svg>',
    compressor: '<svg width="64" height="30" viewBox="0 0 64 30"><path d="M10 6l14 9-14 9z" fill="#1c2633"/><path d="M24 15h36" stroke="#1c2633" stroke-width="2"/></svg>',
  };
  const SIG = {
    di: '<svg viewBox="0 0 120 90"><path d="M10 64h25v-34h30v34h45" fill="none" stroke="#1f4e8c" stroke-width="4"/><text x="50" y="22" font-size="11" text-anchor="middle" font-family="Arial">24 V</text><text x="18" y="80" font-size="11" font-family="Arial">0 V</text></svg>',
    do: '<svg viewBox="0 0 120 90"><path d="M10 64h18v-34h46v34h36" fill="none" stroke="#0f8a7e" stroke-width="4"/><text x="51" y="22" font-size="11" text-anchor="middle" font-family="Arial">ON</text><text x="88" y="80" font-size="11" font-family="Arial">OFF</text></svg>',
    pulse: '<svg viewBox="0 0 120 90"><path d="M6 62h8v-30h8v30h8v-30h8v30h8v-30h8v30h8v-30h8v30h8v-30h8v30h8v-30h8v30h8" fill="none" stroke="#6b4fa8" stroke-width="3.5"/><text x="60" y="82" font-size="11" text-anchor="middle" font-family="Arial">1 pulse = 1 step</text></svg>',
    analog: '<svg viewBox="0 0 120 90"><path d="M8 66C30 66 34 30 56 34S84 60 112 22" fill="none" stroke="#b5730c" stroke-width="4"/><text x="12" y="82" font-size="11" font-family="Arial">4 mA</text><text x="88" y="18" font-size="11" font-family="Arial">20 mA</text></svg>',
    pid: '<svg viewBox="0 0 120 90"><path d="M8 34h104" stroke="#c0392b" stroke-width="2" stroke-dasharray="5 4"/><path d="M8 76C30 76 34 20 52 26S70 40 80 36 100 33 112 34" fill="none" stroke="#1f4e8c" stroke-width="4"/><text x="90" y="26" font-size="11" font-family="Arial" fill="#c0392b">120 °C</text></svg>',
  };
  const GL = {}; G.forEach(r => GL[r[0]] = r);
  window.VFFS = { PAGES, G, GL, SYM, SIG };

  /* ---------- menu ---------- */
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const idx = Math.max(0, PAGES.findIndex(p => p[0] === here));
  const top = document.createElement('header'); top.id = 'top';
  top.innerHTML = '<div class="wrap"><a class="brand" href="index.html"><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="M5 3h14l-4 7v4l-3 2-3-2v-4z"/><path d="M8 18h8v3H8z"/></svg></i>Smart VFFS Machine</a>' +
    '<button id="menuBtn" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>Menu</button>' +
    '<nav class="links">' + PAGES.map((p, i) => '<a href="' + p[0] + '"' + (i === idx ? ' class="on"' : '') + '>' + p[1] + '</a>').join('') + '</nav></div>';
  document.body.prepend(top);
  const mb = top.querySelector('#menuBtn');
  mb.onclick = () => { const o = top.classList.toggle('open'); mb.setAttribute('aria-expanded', o); };
  top.querySelectorAll('.links a').forEach(a => a.addEventListener('click', () => top.classList.remove('open')));

  /* ---------- back / next ---------- */
  const end = document.getElementById('pn');
  if (end) {
    const pv = PAGES[idx - 1], nx = PAGES[idx + 1];
    end.className = 'wrap pn';
    end.innerHTML = (pv ? '<a href="' + pv[0] + '"><small>← Back</small><b>' + pv[1] + '</b></a>' : '') +
      (nx ? '<a class="nx" href="' + nx[0] + '"><small>Next →</small><b>' + nx[1] + '</b></a>' : '');
    const f = document.createElement('footer');
    f.innerHTML = '<div class="wrap">Smart VFFS Packing Machine with AI-Based Vision Inspection · Graduation Project II · MSA University · 2026</div>';
    end.after(f);
  }

  /* ---------- word chips: <div class="words" data-words="plc,hmi"> ---------- */
  document.querySelectorAll('[data-words]').forEach(el => {
    const lbl = el.dataset.label || 'Words on this page:';
    el.innerHTML = '<span class="lbl">' + lbl + '</span>' + el.dataset.words.split(',').map(k => {
      const r = GL[k.trim()]; if (!r) return '';
      const img = r[3] ? '<img src="' + r[3] + '" alt="">' : '';
      return '<a class="w" href="parts.html#' + r[0] + '">' + img + r[2] + '</a>';
    }).join('');
  });
  // inline word links: <a data-w="plc">PLC</a>
  document.querySelectorAll('a[data-w]').forEach(a => { a.href = 'parts.html#' + a.dataset.w; a.classList.add('wi'); const r = GL[a.dataset.w]; if (r) a.title = r[4]; });

  /* ---------- tables ---------- */
  window.T = function (id, head, rows) {
    const t = document.getElementById(id); if (!t) return;
    let h = '<thead><tr>' + head.map(c => '<th>' + c[0] + '</th>').join('') + '</tr></thead><tbody>';
    for (const r of rows) h += '<tr>' + r.map((v, i) => '<td data-l="' + head[i][0] + '"' + (head[i][1] ? ' class="' + head[i][1] + '"' : '') + '>' + v + '</td>').join('') + '</tr>';
    t.innerHTML = h + '</tbody>';
  };

  /* ---------- enlarge pictures and open viewers ---------- */
  const lb = document.createElement('div'); lb.className = 'ov'; lb.id = 'lb'; lb.innerHTML = '<img alt=""><div class="cap"></div>';
  const md = document.createElement('div'); md.className = 'ov'; md.id = 'md';
  md.innerHTML = '<div class="frame"><div class="ovbar"><a id="mdOpen" href="#" target="_blank" rel="noopener">Full page</a><button id="mdClose">Close ✕</button></div><iframe id="mdFrame" title="Viewer" allow="autoplay; fullscreen" allowfullscreen></iframe></div>';
  document.body.append(lb, md);
  const lbImg = lb.querySelector('img'), lbCap = lb.querySelector('.cap'), fr = md.querySelector('iframe');
  document.addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]');
    if (z) { lbImg.src = z.dataset.zoom; lbCap.textContent = z.dataset.cap || ''; lb.classList.add('show'); document.body.style.overflow = 'hidden'; return; }
    const o = e.target.closest('[data-open]');
    if (o) { document.querySelectorAll('video').forEach(v => v.pause()); md.classList.toggle('tall', !!o.dataset.tall); fr.src = o.dataset.open; md.querySelector('#mdOpen').href = o.dataset.open; md.classList.add('show'); document.body.style.overflow = 'hidden'; }
  });
  lb.onclick = () => { lb.classList.remove('show'); lbImg.removeAttribute('src'); document.body.style.overflow = ''; };
  const closeMd = () => { md.classList.remove('show'); fr.src = 'about:blank'; document.body.style.overflow = ''; };
  md.querySelector('#mdClose').onclick = closeMd;
  md.addEventListener('click', e => { if (e.target === md) closeMd(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (md.classList.contains('show')) closeMd(); if (lb.classList.contains('show')) lb.click(); } });
  document.querySelectorAll('video').forEach(v => v.addEventListener('play', () => document.querySelectorAll('video').forEach(o => { if (o !== v) o.pause(); })));
})();

/* ================= motion layer (v5e) ================= */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = document.getElementById('top');
  const bar = document.createElement('div'); bar.id = 'progress'; document.body.appendChild(bar);
  const onScroll = () => {
    const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'; if (top) top.classList.toggle('scrolled', h.scrollTop > 8);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // smooth page change for links to other pages of this site
  document.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a || reduce) return;
    const href = a.getAttribute('href') || '';
    if (a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || !/^[\w-]+\.html(#.*)?$/.test(href)) return;
    e.preventDefault(); document.body.classList.add('leaving'); setTimeout(() => { location.href = href; }, 230);
  });
  addEventListener('pageshow', () => document.body.classList.remove('leaving'));
  if (reduce || !('IntersectionObserver' in window)) return;
  // reveal on scroll, with a small stagger inside each group
  const SEL = 'section h2, section .sub, .card, .pcard, .mcard, .vcard, .explain, .volt .v, .bigpic .col, .nums > div, figure, .fig, table, details, .steps > *, .grid2 > *, .grid3 > img, .fcwrap';
  const els = [...document.querySelectorAll(SEL)].filter(el => !el.closest('svg') && !el.closest('#top') && !el.closest('.ov') && !el.closest('details > :not(summary)') && !el.parentElement.closest('.rv'));
  const groups = new Map();
  els.forEach(el => {
    el.classList.add('rv'); if (el.matches('figure, .fig, .fcwrap, table')) el.classList.add('zoom');
    const g = el.parentElement; const n = groups.get(g) || 0; groups.set(g, n + 1);
    el.style.setProperty('--d', Math.min(n, 6) * 0.07 + 's');
  });
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return; en.target.classList.add('in'); io.unobserve(en.target);
    en.target.querySelectorAll('.nums b, :scope > b').forEach(countUp);
    if (en.target.matches('.nums > div')) en.target.querySelectorAll('b').forEach(countUp);
  }), { threshold: 0.01, rootMargin: '0px 0px 0px 0px' });
  // near the end of the page, show everything left so the page height never changes there
  addEventListener('scroll', () => { const h = document.documentElement; if (h.scrollTop + h.clientHeight > h.scrollHeight - 300) document.querySelectorAll('.rv:not(.in)').forEach(e => { e.classList.add('in'); io.unobserve(e); }); }, { passive: true });
  els.forEach(el => io.observe(el));
  // count-up for numbers that start a stat, e.g. "40", "0.47 L", "1,270 mm"
  function countUp(b) {
    if (b.dataset.cu) return; b.dataset.cu = 1;
    const m = b.textContent.match(/^([^\d]*)([\d][\d,]*(?:\.\d+)?)(.*)$/s); if (!m) return;
    const raw = m[2], end = parseFloat(raw.replace(/,/g, '')), dec = (raw.split('.')[1] || '').length, comma = raw.includes(',');
    if (!isFinite(end) || end === 0) return;
    const fmt = v => { let s = v.toFixed(dec); if (comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return m[1] + s + m[3]; };
    const t0 = performance.now(), dur = 1100;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = fmt(end * e); if (k < 1) requestAnimationFrame(step); else b.textContent = fmt(end); };
    requestAnimationFrame(step);
  }
})();
