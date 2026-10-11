'use strict';
/* ===== Presenze Danza – PWA offline-first ===== */
const KEY = 'presenze-danza-v1';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const DOWORDER = [1, 2, 3, 4, 5, 6, 0];
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const dateOf = s => new Date(s + 'T12:00:00');
const fmtIT = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

/* ---------- dati iniziali (deterministici, così due dispositivi non creano duplicati) ---------- */
const T0 = 1;
function seed() {
  const C = (id, name) => ({ id: 'c-' + id, name, u: T0 });
  const L = (c, dow, start, end) => ({ id: `l-${c}-${dow}-${start.replace(':', '')}`, courseId: 'c-' + c, dow, start, end, u: T0 });
  const courses = [
    C('prop', 'Propedeutica'), C('pre', 'Predanza'), C('prep', 'Preparatorio'),
    C('avv', 'Avviamento'), C('int', 'Intermedio'), C('avz', 'Avanzato (grandi)'), C('mod', 'Moderno')
  ];
  const lessons = [
    L('prop', 1, '17:00', '18:00'), L('prop', 4, '16:45', '17:45'), L('prop', 5, '16:45', '17:45'),
    L('pre', 1, '18:00', '19:00'), L('pre', 2, '17:00', '18:00'), L('pre', 5, '17:45', '18:45'),
    L('prep', 1, '19:00', '20:00'), L('prep', 3, '17:00', '18:00'), L('prep', 4, '17:45', '18:45'),
    L('avv', 2, '18:00', '19:15'), L('avv', 3, '18:00', '19:15'), L('avv', 4, '18:45', '19:45'), L('avv', 5, '18:45', '19:45'),
    L('avz', 1, '20:00', '21:15'), L('avz', 2, '19:15', '20:45'), L('avz', 3, '19:15', '20:45'), L('avz', 4, '19:45', '21:00'), L('avz', 5, '20:00', '21:15')
  ];
  // [cognome, nome, corso, anno corso, retta, note]
  const S = [
    ['Di Caterino', 'Giusy', 'mod', '', 35], ['Di Caterino', 'Lina', 'mod', '', 35],
    ['Froncuolo', 'Teresa', 'mod', '', 35], ['Perrotta', 'Daria', 'mod', '', 50],
    ['Aversano', 'Rita', 'int', 'V°', 45], ['Belardo', 'Ilaria', 'int', 'VI°', ''],
    ['Buonanno', 'Emanuela', 'int', 'VI°', 65], ["Dell'Aversana", 'Silvia', 'int', 'V°', 50],
    ['Di Caterino', 'Ilary', 'int', 'VI°', ''], ['Torcia', 'Gaia', 'int', 'VI°', 65],
    ['Aversano', 'Filomena', 'avz', 'VII°', 45], ['Buonomo', 'Lena', 'avz', 'VIII°', 65, 'D'],
    ['Papa', 'Teresa', 'avz', 'VIII°', 65], ['Perrotta', 'Serena', 'avz', 'VII°', 65],
    ['Salvarezza', 'Angelica', 'avz', 'VIII°', 65, 'D'], ['Setola', 'Carmela', 'avz', 'VII°', 65],
    ['Barone', 'Aurora', 'prep', 'I°', 50], ['Belardo', 'Angela', 'prep', 'I°', 50],
    ["D'Errico", 'Arianna', 'prep', 'I°', 50], ['Esposito', 'Diana', 'prep', 'I°', 45],
    ['Lucariello', 'Nicole', 'prep', 'I°', 45], ['Migliaccio', 'Justine', 'prep', 'I°', 50],
    ['Belardo', 'Chiara', 'avv', 'II°', ''], ['Coppola', 'Francesca', 'avv', 'II°', 60],
    ["D'Ambra", 'Rosa', 'avv', 'II°', 60], ['Diana', 'Sofia', 'avv', 'II°', 60],
    ['Esposito', 'Anna', 'avv', 'II°', 60], ['Flagiello', 'Federica', 'avv', 'II°', 60],
    ['Lucariello', 'Angelica', 'avv', 'II°', 55], ['Owusu', 'M. Assunta', 'avv', 'I°', 60],
    ['Seguino', 'Nicole S.', 'avv', 'I°', 60]
  ];
  const students = S.map((r, i) => ({
    id: 's-' + (i + 1), surname: r[0], name: r[1], courses: ['c-' + r[2]],
    level: r[3], fee: r[4], notes: r[5] || '', active: true, u: T0
  }));
  return { v: 1, courses, lessons, students, att: {}, sess: {} };
}

/* ---------- stato e salvataggio ---------- */
function load() { try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
let db = load() || seed();
['courses', 'lessons', 'students'].forEach(k => db[k] = db[k] || []);
db.att = db.att || {}; db.sess = db.sess || {};

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Impossibile salvare in locale!'); }
  scheduleFileWrite();
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

/* ---------- unione dei dati (usata da import e file condiviso) ---------- */
const mA = (a, b) => { const m = new Map(a.map(x => [x.id, x])); for (const y of b) { const x = m.get(y.id); if (!x || (y.u || 0) > (x.u || 0)) m.set(y.id, y); } return [...m.values()]; };
const mO = (a, b) => { const r = { ...a }; for (const k in b) if (!r[k] || (b[k].u || 0) > (r[k].u || 0)) r[k] = b[k]; return r; };
function merge(a, b) {
  return { v: 1, courses: mA(a.courses, b.courses || []), lessons: mA(a.lessons, b.lessons || []), students: mA(a.students, b.students || []), att: mO(a.att, b.att || {}), sess: mO(a.sess, b.sess || {}) };
}

/* ---------- file condiviso (Chrome/Edge su PC) ---------- */
const hasFS = 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
let fh = null, fileMsg = '', needReconnect = false, wTimer = null;
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('presenze-handle', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function hPut(v) { const d = await idb(); return new Promise(res => { const t = d.transaction('h', 'readwrite'); t.objectStore('h').put(v, 'file'); t.oncomplete = res; t.onerror = res; }); }
async function hGet() { try { const d = await idb(); return await new Promise(res => { const q = d.transaction('h').objectStore('h').get('file'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function hDel() { const d = await idb(); return new Promise(res => { const t = d.transaction('h', 'readwrite'); t.objectStore('h').delete('file'); t.oncomplete = res; }); }

async function readFile() {
  const f = await fh.getFile(); const t = await f.text();
  if (t.trim()) {
    try { db = merge(db, JSON.parse(t)); localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Il file scelto non è valido'); }
  }
}
async function writeFile() {
  if (!fh) return;
  try {
    const w = await fh.createWritable(); await w.write(JSON.stringify(db)); await w.close();
    fileMsg = '☁️ salvato ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { fileMsg = '⚠️ file non scrivibile'; }
  $('#sync').textContent = fileMsg;
}
function scheduleFileWrite() { if (!fh || needReconnect) return; clearTimeout(wTimer); wTimer = setTimeout(writeFile, 700); }
async function attach(h) {
  if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') { toast('Permesso negato'); return; }
  fh = h; needReconnect = false; await hPut(h); await readFile(); await writeFile(); render(); toast('File collegato');
}
async function linkNew() { try { attach(await showSaveFilePicker({ suggestedName: 'presenze-danza.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] })); } catch (e) { } }
async function linkOpen() { try { const [h] = await showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] }); attach(h); } catch (e) { } }
async function unlink() { fh = null; needReconnect = false; await hDel(); fileMsg = ''; $('#sync').textContent = ''; render(); }
async function reconnect() { if (fh) await attach(fh); }
async function initFile() {
  if (!hasFS) return;
  const h = await hGet(); if (!h) return;
  fh = h;
  try {
    const p = await h.queryPermission({ mode: 'readwrite' });
    if (p === 'granted') { await readFile(); render(); fileMsg = '☁️ collegato'; $('#sync').textContent = fileMsg; }
    else { needReconnect = true; $('#sync').textContent = '☁️ da riconnettere'; }
  } catch (e) { needReconnect = true; }
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && fh && !needReconnect) { try { await readFile(); render(); } catch (e) { } }
});

/* ---------- utilità ---------- */
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const courseAlive = id => db.courses.find(c => c.id === id && !c.d);
const cn = id => (db.courses.find(c => c.id === id) || {}).name || '?';
const liveCourses = () => db.courses.filter(c => !c.d);
const liveStudents = () => db.students.filter(s => !s.d);
const bySurname = (a, b) => (a.surname + ' ' + a.name).localeCompare(b.surname + ' ' + b.name, 'it');
const courseOfLid = lid => lid.startsWith('x:') ? lid.slice(2) : (db.lessons.find(l => l.id === lid) || {}).courseId;

const st = {
  tab: 'pres', date: iso(new Date()), lid: null, q: '', fc: '',
  f: { from: (() => { const n = new Date(); const y = n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear() - 1; return y + '-09-01'; })(), to: iso(new Date()), course: '' }
};

/* ---------- sessioni di lezione di un giorno ---------- */
function sessionsFor(d) {
  const dow = dateOf(d).getDay();
  const out = db.lessons.filter(l => !l.d && l.dow === dow && courseAlive(l.courseId)).sort((a, b) => a.start.localeCompare(b.start))
    .map(l => ({ lid: l.id, courseId: l.courseId, start: l.start, end: l.end }));
  for (const k in db.sess) {
    const [dd, lid] = k.split('|');
    if (dd === d && lid.startsWith('x:') && !db.sess[k].rm && courseAlive(lid.slice(2))) out.push({ lid, courseId: lid.slice(2), extra: true });
  }
  return out;
}
const studentsOf = courseId => liveStudents().filter(s => s.active !== false && (s.courses || []).includes(courseId)).sort(bySurname);

/* ---------- viste ---------- */
function viewPres() {
  const d = st.date, ss = sessionsFor(d);
  if (!ss.find(s => s.lid === st.lid)) st.lid = ss[0] ? ss[0].lid : null;
  let h = `<div class="card row noprint"><button data-act="dprev">‹</button><input type="date" value="${d}" data-chg="date" class="grow"><button data-act="dnext">›</button><button data-act="today">Oggi</button></div>`;
  h += `<div class="muted">${DOW[dateOf(d).getDay()]} ${fmtIT(d)}</div>`;
  if (ss.length) h += `<div class="chips">${ss.map(s => `<button class="chip ${s.lid === st.lid ? 'on' : ''}" data-act="sel" data-lid="${esc(s.lid)}">${esc(cn(s.courseId))}<small>${s.extra ? 'extra' : s.start + '–' + s.end}</small></button>`).join('')}</div>`;
  else h += `<div class="card muted">Nessuna lezione prevista in questo giorno.</div>`;
  h += `<div class="card row noprint"><select id="xc" class="grow">${liveCourses().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button data-act="addx">+ Lezione extra / recupero</button></div>`;
  const s = ss.find(x => x.lid === st.lid);
  if (s) {
    const key = d + '|' + s.lid, sess = db.sess[key] || {};
    const list = studentsOf(s.courseId);
    let P = 0, A = 0, G = 0;
    list.forEach(a => { const v = (db.att[key + '|' + a.id] || {}).s; if (v === 'P') P++; else if (v === 'A') A++; else if (v === 'G') G++; });
    h += `<div class="card ${sess.cancelled ? 'cancel' : ''}"><div class="row"><b class="grow">${esc(cn(s.courseId))} ${s.extra ? '(extra)' : s.start + '–' + s.end}</b><span class="muted">✔ ${P} · ✘ ${A} · G ${G} · tot ${list.length}</span></div>`;
    h += `<div class="row noprint" style="margin:8px 0"><button data-act="allp">Tutte presenti</button><button data-act="clr">Azzera</button><button data-act="cancel">${sess.cancelled ? 'Ripristina lezione' : 'Lezione annullata'}</button>${s.extra ? '<button class="dan" data-act="rmx">Rimuovi</button>' : ''}</div>`;
    if (sess.cancelled) h += `<div class="muted">Lezione annullata: non conta nelle statistiche.</div>`;
    else if (!list.length) h += `<div class="muted">Nessuna allieva iscritta a questo corso. Aggiungile dalla scheda "Allieve".</div>`;
    h += list.map(a => {
      const v = (db.att[key + '|' + a.id] || {}).s || '';
      return `<div class="srow"><div class="n">${esc(a.surname)} ${esc(a.name)}</div>${['P', 'A', 'G'].map(x => `<button class="st ${x} ${v === x ? 'on' : ''}" data-act="mark" data-sid="${a.id}" data-s="${x}" title="${{ P: 'Presente', A: 'Assente', G: 'Assenza giustificata' }[x]}">${x}</button>`).join('')}</div>`;
    }).join('');
    h += `<div class="muted" style="margin-top:8px">P = presente · A = assente · G = assenza giustificata (tocca di nuovo per togliere)</div></div>`;
  }
  return h;
}

function computeStats() {
  const { from, to, course } = st.f;
  const per = {}, perC = {};
  for (const k in db.att) {
    const a = db.att[k]; if (!a.s) continue;
    const [d, lid, sid] = k.split('|');
    if (d < from || d > to) continue;
    if ((db.sess[d + '|' + lid] || {}).cancelled) continue;
    const c = courseOfLid(lid); if (!c) continue;
    if (course && c !== course) continue;
    (per[sid] = per[sid] || { P: 0, A: 0, G: 0 })[a.s]++;
    (perC[c] = perC[c] || { P: 0, A: 0, G: 0 })[a.s]++;
  }
  return { per, perC };
}
const pct = r => { const t = r.P + r.A + r.G; return t ? Math.round(r.P * 100 / t) : null; };

function viewStat() {
  const { per, perC } = computeStats();
  const f = st.f;
  let h = `<div class="card noprint"><div class="row"><div class="grow"><label>Corso</label><select data-chg="scourse" style="width:100%"><option value="">Tutti i corsi</option>${liveCourses().map(c => `<option value="${c.id}" ${f.course === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
  <div><label>Dal</label><input type="date" value="${f.from}" data-chg="sfrom"></div><div><label>Al</label><input type="date" value="${f.to}" data-chg="sto"></div></div>
  <div class="row" style="margin-top:10px"><button data-act="csv">⬇ Esporta CSV (Excel)</button><button data-act="print">🖨 Stampa / PDF</button></div></div>`;
  h += `<h2>Statistiche dal ${fmtIT(f.from)} al ${fmtIT(f.to)}${f.course ? ' – ' + esc(cn(f.course)) : ''}</h2>`;
  const cRows = liveCourses().filter(c => perC[c.id]);
  if (!cRows.length) return h + `<div class="card muted">Nessuna presenza registrata nel periodo scelto.</div>`;
  h += `<div class="card"><table><tr><th>Corso</th><th>P</th><th>A</th><th>G</th><th>% pres.</th></tr>${cRows.map(c => { const r = perC[c.id], p = pct(r); return `<tr><td>${esc(c.name)}</td><td>${r.P}</td><td>${r.A}</td><td>${r.G}</td><td class="${p < 75 ? 'low' : ''}">${p}%</td></tr>`; }).join('')}</table></div>`;
  const stu = liveStudents().filter(s => per[s.id]).sort(bySurname);
  h += `<div class="card"><table><tr><th>Allieva</th><th>P</th><th>A</th><th>G</th><th>%</th><th></th></tr>${stu.map(s => { const r = per[s.id], p = pct(r); return `<tr><td>${esc(s.surname)} ${esc(s.name)}</td><td>${r.P}</td><td>${r.A}</td><td>${r.G}</td><td class="${p < 75 ? 'low' : ''}">${p}%</td><td style="width:22%"><div class="bar ${p < 75 ? 'barlow' : ''}"><i style="width:${p}%"></i></div></td></tr>`; }).join('')}</table>
  <div class="muted" style="margin-top:6px">% = presenze ÷ (presenze + assenze + giustificate). In rosso sotto il 75%. Le lezioni annullate non contano.</div></div>`;
  return h;
}

function studList() {
  const q = st.q.trim().toLowerCase();
  const l = liveStudents().filter(s => (!st.fc || (s.courses || []).includes(st.fc)) && (!q || (s.surname + ' ' + s.name).toLowerCase().includes(q))).sort(bySurname);
  if (!l.length) return '<div class="muted">Nessuna allieva trovata.</div>';
  return l.map(s => `<div class="srow"><div class="n"><b>${esc(s.surname)} ${esc(s.name)}</b>${s.active === false ? ' <span class="muted">(non attiva)</span>' : ''}<br>${(s.courses || []).filter(courseAlive).map(c => `<span class="badge">${esc(cn(c))}</span>`).join('')}<span class="muted">${esc(s.level || '')}${s.fee ? ' · € ' + esc(s.fee) : ''}</span></div><button data-act="sedit" data-id="${s.id}">Modifica</button></div>`).join('');
}
function viewStud() {
  return `<div class="card noprint"><div class="row"><input type="text" placeholder="Cerca allieva…" value="${esc(st.q)}" data-inp="q" class="grow"><select data-chg="fc"><option value="">Tutti i corsi</option>${liveCourses().map(c => `<option value="${c.id}" ${st.fc === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button class="pri" data-act="sadd">+ Nuova</button></div></div><div class="card" id="slist">${studList()}</div><div class="muted">${liveStudents().length} allieve in elenco</div>`;
}

function viewCorsi() {
  let h = `<div class="row"><h2 class="grow">Corsi e orari settimanali</h2><button class="pri" data-act="cadd">+ Corso</button></div><div class="muted">Le modifiche valgono per le lezioni future; lo storico delle presenze resta intatto.</div>`;
  h += liveCourses().map(c => {
    const ls = db.lessons.filter(l => l.courseId === c.id && !l.d).sort((a, b) => DOWORDER.indexOf(a.dow) - DOWORDER.indexOf(b.dow) || a.start.localeCompare(b.start));
    return `<div class="card"><div class="row"><input type="text" value="${esc(c.name)}" data-chg="cname" data-id="${c.id}" class="grow"><button class="dan" data-act="cdel" data-id="${c.id}">Elimina</button></div>
    <div class="muted" style="margin-top:4px">${studentsOf(c.id).length} allieve</div>
    ${ls.map(l => `<div class="lrow"><select data-chg="ldow" data-id="${l.id}">${DOWORDER.map(d => `<option value="${d}" ${l.dow === d ? 'selected' : ''}>${DOW[d]}</option>`).join('')}</select><input type="time" value="${l.start}" data-chg="lstart" data-id="${l.id}"> – <input type="time" value="${l.end}" data-chg="lend" data-id="${l.id}"><button class="dan" data-act="ldel" data-id="${l.id}">✕</button></div>`).join('') || '<div class="muted">Nessuna lezione impostata</div>'}
    <button data-act="ladd" data-id="${c.id}" style="margin-top:6px">+ Aggiungi lezione</button></div>`;
  }).join('');
  return h;
}

function viewDati() {
  const nAtt = Object.values(db.att).filter(a => a.s).length;
  let h = `<div class="card"><b>Riepilogo</b><div class="muted">${liveStudents().length} allieve · ${liveCourses().length} corsi · ${nAtt} presenze/assenze registrate</div></div>`;
  h += `<div class="card"><b>Backup e passaggio dati</b><div class="muted">Salva un file e mettilo su Google Drive / OneDrive. Con "Importa" i dati vengono uniti a quelli presenti (vince la modifica più recente).</div><div class="row" style="margin-top:8px"><button data-act="export">⬇ Esporta backup</button><button data-act="import">⬆ Importa file</button><input type="file" id="imp" accept=".json,application/json" hidden></div></div>`;
  h += `<div class="card"><b>File condiviso su Drive (solo PC con Chrome / Edge)</b>`;
  if (hasFS) {
    h += `<div class="muted">Scegli un file .json dentro la cartella sincronizzata di Google Drive / OneDrive: l'app lo aggiorna da sola a ogni modifica e lo rilegge quando la riapri.</div>`;
    h += `<div class="row" style="margin-top:8px">`;
    if (fh) h += `<span class="muted grow">${needReconnect ? '⚠️ File collegato: serve riconnettere' : '✅ File collegato'} ${esc(fh.name || '')} ${esc(fileMsg)}</span>${needReconnect ? '<button class="pri" data-act="reconn">Riconnetti</button>' : ''}<button data-act="unlink">Scollega</button>`;
    else h += `<button data-act="linknew">Crea nuovo file…</button><button data-act="linkopen">Apri file esistente…</button>`;
    h += `</div>`;
  } else h += `<div class="muted">Questo browser non permette il collegamento diretto a un file (succede su telefono). Usa Esporta/Importa, oppure condividi il backup con "Condividi" dal telefono.</div>`;
  h += `</div>`;
  if (deferredInstall) h += `<div class="card"><b>Installa l'app</b><div class="row" style="margin-top:8px"><button class="pri" data-act="install">📲 Installa su questo dispositivo</button></div></div>`;
  else h += `<div class="card"><b>Installa l'app</b><div class="muted">PC (Chrome/Edge): icona di installazione nella barra degli indirizzi. Android (Chrome): menu ⋮ → "Installa app". iPhone (Safari): Condividi → "Aggiungi a Home".</div></div>`;
  h += `<div class="card"><b>Zona pericolosa</b><div class="row" style="margin-top:8px"><button class="dan" data-act="reset">Cancella tutti i dati di questo dispositivo</button></div></div>`;
  return h;
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (st.tab === 'dati') render(); });

function render() {
  const v = { pres: viewPres, stat: viewStat, stud: viewStud, corsi: viewCorsi, dati: viewDati }[st.tab];
  $('#main').innerHTML = v();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === st.tab));
}

/* ---------- scheda allieva ---------- */
function openStud(id) {
  const s = id ? db.students.find(x => x.id === id) : { courses: st.fc ? [st.fc] : [], active: true };
  const dlg = $('#dlg');
  dlg.innerHTML = `<form id="sf" onsubmit="return false"><h2 style="margin-top:0">${id ? 'Modifica allieva' : 'Nuova allieva'}</h2>
  <label>Cognome</label><input type="text" name="surname" value="${esc(s.surname)}">
  <label>Nome</label><input type="text" name="name" value="${esc(s.name)}">
  <label>Corsi frequentati</label>${liveCourses().map(c => `<label style="color:inherit;display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="c" value="${c.id}" ${(s.courses || []).includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}
  <div class="row"><div class="grow"><label>Anno di corso</label><input type="text" name="level" value="${esc(s.level)}"></div><div class="grow"><label>Retta mensile (€)</label><input type="text" name="fee" value="${esc(s.fee)}"></div></div>
  <label>Note</label><textarea name="notes" rows="2">${esc(s.notes)}</textarea>
  <label style="color:inherit;display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${s.active !== false ? 'checked' : ''}> Allieva attiva (compare negli appelli)</label>
  <menu>${id ? `<button class="dan" data-act="sdel" data-id="${id}">Elimina</button>` : ''}<button data-act="dclose">Annulla</button><button class="pri" data-act="ssave" data-id="${id || ''}">Salva</button></menu></form>`;
  dlg.showModal();
}
function saveStud(id) {
  const f = $('#sf');
  const surname = f.surname.value.trim(), name = f.name.value.trim();
  if (!surname) { toast('Inserisci il cognome'); return; }
  const data = {
    surname, name, level: f.level.value.trim(), fee: f.fee.value.trim(), notes: f.notes.value.trim(),
    courses: [...f.querySelectorAll('input[name=c]:checked')].map(x => x.value), active: f.active.checked, u: now()
  };
  if (id) Object.assign(db.students.find(x => x.id === id), data);
  else db.students.push({ id: uid(), ...data });
  save(); $('#dlg').close(); render(); toast('Salvato');
}

/* ---------- eventi ---------- */
const shiftDay = n => { const d = dateOf(st.date); d.setDate(d.getDate() + n); st.date = iso(d); render(); };
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
  if (t.dataset.tab) { st.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.act, id = t.dataset.id;
  const d = st.date, s = sessionsFor(d).find(x => x.lid === st.lid), key = s ? d + '|' + s.lid : '';
  switch (a) {
    case 'dprev': shiftDay(-1); break;
    case 'dnext': shiftDay(1); break;
    case 'today': st.date = iso(new Date()); render(); break;
    case 'sel': st.lid = t.dataset.lid; render(); break;
    case 'addx': { const c = $('#xc').value; if (!c) return; const lid = 'x:' + c; db.sess[d + '|' + lid] = { u: now() }; st.lid = lid; save(); render(); break; }
    case 'rmx': if (confirm('Rimuovere questa lezione extra?')) { db.sess[key] = { u: now(), rm: true }; save(); render(); } break;
    case 'cancel': { const o = db.sess[key] || {}; db.sess[key] = { ...o, cancelled: !o.cancelled, u: now() }; save(); render(); break; }
    case 'allp': studentsOf(s.courseId).forEach(x => { const k = key + '|' + x.id; if (!(db.att[k] || {}).s) db.att[k] = { s: 'P', u: now() }; }); save(); render(); break;
    case 'clr': if (confirm('Azzerare tutte le presenze di questa lezione?')) { studentsOf(s.courseId).forEach(x => { const k = key + '|' + x.id; if ((db.att[k] || {}).s) db.att[k] = { s: '', u: now() }; }); save(); render(); } break;
    case 'mark': { const k = key + '|' + t.dataset.sid; const cur = (db.att[k] || {}).s; db.att[k] = { s: cur === t.dataset.s ? '' : t.dataset.s, u: now() }; save(); render(); break; }
    case 'sadd': openStud(null); break;
    case 'sedit': openStud(id); break;
    case 'ssave': saveStud(id); break;
    case 'sdel': if (confirm('Eliminare questa allieva? (lo storico resta nei dati ma non sarà più visibile)')) { const x = db.students.find(z => z.id === id); x.d = true; x.u = now(); save(); $('#dlg').close(); render(); } break;
    case 'dclose': $('#dlg').close(); break;
    case 'cadd': { const n = prompt('Nome del nuovo corso:'); if (n && n.trim()) { db.courses.push({ id: 'c-' + uid(), name: n.trim(), u: now() }); save(); render(); } break; }
    case 'cdel': if (confirm('Eliminare il corso? Le sue lezioni non verranno più mostrate (lo storico resta).')) { const c = db.courses.find(z => z.id === id); c.d = true; c.u = now(); save(); render(); } break;
    case 'ladd': db.lessons.push({ id: 'l-' + uid(), courseId: id, dow: 1, start: '17:00', end: '18:00', u: now() }); save(); render(); break;
    case 'ldel': { const l = db.lessons.find(z => z.id === id); l.d = true; l.u = now(); save(); render(); break; }
    case 'csv': exportCSV(); break;
    case 'print': window.print(); break;
    case 'export': exportJSON(); break;
    case 'import': $('#imp').click(); break;
    case 'linknew': linkNew(); break;
    case 'linkopen': linkOpen(); break;
    case 'unlink': unlink(); break;
    case 'reconn': reconnect(); break;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; render(); } break;
    case 'reset': if (confirm('Cancellare TUTTI i dati di questo dispositivo?') && confirm('Sei sicura? L\'operazione non si può annullare (se hai un backup potrai reimportarlo).')) { localStorage.removeItem(KEY); db = seed(); db.v = 1; save(); render(); toast('Dati reimpostati'); } break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'imp') { importFile(t.files[0]); t.value = ''; return; }
  const c = t.dataset.chg; if (!c) return;
  const touch = (arr, id, fn) => { const o = arr.find(x => x.id === id); if (o) { fn(o); o.u = now(); save(); } };
  switch (c) {
    case 'date': if (t.value) { st.date = t.value; render(); } break;
    case 'scourse': st.f.course = t.value; render(); break;
    case 'sfrom': st.f.from = t.value; render(); break;
    case 'sto': st.f.to = t.value; render(); break;
    case 'fc': st.fc = t.value; render(); break;
    case 'cname': if (t.value.trim()) touch(db.courses, t.dataset.id, o => o.name = t.value.trim()); break;
    case 'ldow': touch(db.lessons, t.dataset.id, o => o.dow = +t.value); break;
    case 'lstart': touch(db.lessons, t.dataset.id, o => o.start = t.value); break;
    case 'lend': touch(db.lessons, t.dataset.id, o => o.end = t.value); break;
  }
});
document.addEventListener('input', e => {
  if (e.target.dataset.inp === 'q') { st.q = e.target.value; $('#slist').innerHTML = studList(); }
});

/* ---------- export / import ---------- */
async function exportJSON() {
  const name = 'presenze-danza-' + iso(new Date()) + '.json';
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (/Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup presenze' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, name);
}
async function importFile(f) {
  if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (!Array.isArray(o.students) || !Array.isArray(o.courses)) throw 0;
    db = merge(db, o); save(); render(); toast('Dati importati e uniti');
  } catch (e) { toast('File non valido'); }
}
function exportCSV() {
  const { per } = computeStats();
  const rows = [['Cognome', 'Nome', 'Corsi', 'Presenze', 'Assenze', 'Giustificate', '% presenza']];
  liveStudents().filter(s => per[s.id]).sort(bySurname).forEach(s => {
    const r = per[s.id], p = pct(r);
    rows.push([s.surname, s.name, (s.courses || []).filter(courseAlive).map(cn).join(' / '), r.P, r.A, r.G, p + '%']);
  });
  const csv = '﻿' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `statistiche-presenze-${st.f.from}_${st.f.to}.csv`);
}

/* ---------- avvio ---------- */
save();
render();
initFile();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
