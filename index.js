// ✦ Мозг — код-мозг персонажей для SillyTavern. Отдельное расширение рядом с Life (подключается через его мост).
// Нейронка читает и пишет, код помнит и считает: Летописец Life после поста называет, ЧТО случилось с каждым
// («удар по самооценке 2», «угроза 3», «сдержался 1»), а психику считает ядро (core/psyche.js) — четыре оси
// в три слоя, воля, напряжение, несказанное, срыв. Тело и нервы берутся у трекеров Life (раны, недосып, голод,
// Камни, терпение, триггеры, тайны, эффекты). Модель получает не цифры, а кассету: как ИМЕННО ЭТОТ человек
// ведёт себя на этой ступени чувства. Ядро не знает ни про Таверну, ни про Life — переедет под свою модель как есть.

import * as P from './core/psyche.js';
import { EMO_NAME, EMO_TITLE, EMO_ICON, WILL_TEXT, WILL_NAME, SINGLES, SINGLE_TITLE, BELIEF_NAME, cassOf, cassText, cassLines, cleanCass, beliefText } from './core/cassettes.js';

const VERSION = '0.3.0';
const ID = 'brain';
const TITLE = '🧠 Мозг';
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const NEG = ['fear', 'anger', 'shame', 'low'];
const SEV = ['', 'лёгкая', 'средняя', 'тяжёлая', 'критическая'];
const KIND_NAME = { warm: 'тепло', fun: 'веселье', win: 'победа', calm: 'покой', threat: 'угроза', blow: 'удар по самооценке', bound: 'потеря контроля', wrong: 'несправедливость', loss: 'утрата', held: 'сдержался', open: 'открылся' };
const AX_NAME = { val: ['мрак', 'тепло'], aro: ['пусто', 'заряд'], ctl: ['бессилие', 'контроль'], wor: ['стыд', 'самоценность'] };
const D_NAME = { val: 'тепло', aro: 'заряд', ctl: 'контроль', wor: 'самоценность', will: 'воля', strain: 'напряжение', mask: 'несказанное' };
// какое состояние из «Внутри» Life соответствует ведущей эмоции
const INNER = { fear: 'restless', anger: 'irritated', shame: 'thoughtful', low: 'sad', tender: 'good', playful: 'playful' };
// по какой оси видно, вспышка это или уже настроение
const MAIN_AX = { fear: 'ctl', anger: 'val', shame: 'wor', low: 'val' };
const NUDGE = [['warm', 'обогреть'], ['fun', 'рассмешить'], ['calm', 'успокоить'], ['win', 'дать победить'], ['open', 'дать выговориться'], ['threat', 'напугать'], ['blow', 'задеть'], ['bound', 'прижать'], ['wrong', 'разозлить'], ['loss', 'оставить в одиночестве']];
const LEAK_NAME = ['держит при себе', 'проступает', 'почти не держит'];
const INIT_NAME = { care: 'забота', court: 'ухаживание', flirt: 'флирт', touch: 'касание', spicy: 'откровенность', gift: 'подарок', own: 'своё дело', talk: 'разговор', plot: 'затея' };
// какое лицо из набора Life соответствует ведущей эмоции
const FACE = { fear: 'tense', anger: 'angry', shame: 'sad', low: 'sad', tender: 'tender', playful: 'laugh' };
// чем подменяет шаг, на который не хватило
const SAFE = { court: 'заботой по мелочи, взглядом, шуткой', flirt: 'заботой по мелочи, взглядом, шуткой', spicy: 'намёком или шуткой', touch: 'жестом рядом, не касаясь', gift: 'оставит молча, без слов', talk: 'начнёт издалека или отложит' };
// что сейчас действует на человека (текст из «Способностей» Life)
const FX = [
    ['alcohol', /алкогол|выпи[лв]|пьян|вино|виски|водк|бурбон|шампанск|пиво|коньяк|хмел/i],
    ['sedative', /седатив|успокоит|транквил|снотворн|усыпл/i],
    ['painkiller', /обезбол|морфин|анальг|анестет/i],
    ['stim', /стимул|адреналин|кофеин|амфетам|энергетик/i],
];

let A = null;     // LifeBridge.api
let sel = '';     // чья карточка открыта
const openSet = new Set();   // какие «подробнее» раскрыты — чтобы перерисовка их не захлопывала
const det = (k) => `data-bd="${k}"${openSet.has(k) ? ' open' : ''}`;
const spends = [];           // шаги по своей инициативе, сделанные в посте: Life сообщает, мозг списывает волю

const ctx = () => (A ? A.ctx() : globalThis.SillyTavern.getContext());
const esc = (v) => (A ? A.esc(v) : String(v ?? ''));
const str = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const arr = (v) => (Array.isArray(v) ? v : []);
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
const safe = (f, d) => { try { return f(); } catch (e) { console.warn('[Мозг]', e); return d; } };
const short = (n) => A.shortName(A.canonName(n));
const cap = (t) => { t = String(t || ''); return t ? t[0].toUpperCase() + t.slice(1) : t; };
const user = () => A.canonName(ctx().name1) || ctx().name1 || '';

// ───────────── настройки и состояние ─────────────

function cfg() {
    const ext = ctx().extensionSettings;
    if (!ext[ID] || typeof ext[ID] !== 'object') ext[ID] = {};
    const c = ext[ID];
    if (c.on === undefined) c.on = true;
    if (c.drive === undefined) c.drive = true;     // вести состояние «Внутри» Life
    if (c.brk === undefined) c.brk = true;         // срывы
    if (c.aura === undefined) c.aura = true;       // ауры в Сцене
    if (c.auto === undefined) c.auto = true;       // сам собирает темперамент из карточки и лорбука
    if (!c.prof || typeof c.prof !== 'object') c.prof = {};       // ключ персонажа → темперамент
    if (!c.tried || typeof c.tried !== 'object') c.tried = {};
    return c;
}
const saveCfg = () => { try { ctx().saveSettingsDebounced?.(); } catch { /* */ } };

/** Состояние мозга в этом чате: { who: { имя: состояние }, snap, ops } */
function M() {
    const md = ctx().chatMetadata;
    if (!md) return { who: {} };
    if (!md[ID] || typeof md[ID] !== 'object') md[ID] = {};
    const m = md[ID];
    if (!m.who || typeof m.who !== 'object') m.who = {};
    return m;
}
const saveM = () => { try { ctx().saveMetadataDebounced?.(); } catch { /* */ } };

const lifeOn = () => { try { return A.settings().enabled !== false; } catch { return true; } };
const on = () => !!A && !!A.hasChat?.() && lifeOn() && cfg().on !== false;

/** Ключ темперамента: в другой эпохе («Священный таймлайн») у того же человека — свой. */
const keyOf = (who) => { try { return A.lore?.key?.(who) || A.canonName(who) || who; } catch { return A.canonName(who) || who; } };
const temperOf = (who) => P.normTemper(cfg().prof[keyOf(who)]);
function editTemper(who, fn) {
    const k = keyOf(who);
    const t = P.normTemper(cfg().prof[k]);
    fn(t);
    cfg().prof[k] = t;
    saveCfg();
    return t;
}
function stateOf(who) {
    const m = M();
    const k = A.canonName(who);
    m.who[k] = P.heal(m.who[k], temperOf(who));
    return m.who[k];
}

/** Главные этого чата без твоей персоны и без рассказчика. */
function mains() {
    const U = user();
    const out = [];
    for (const n of A.groupMembers().map(A.canonName)) {
        if (!n || A.sameName(n, U) || NARR.test(n) || out.some(x => A.sameName(x, n))) continue;
        out.push(n);
    }
    return out;
}
/** У кого мозг включён. */
const list = () => mains().filter(n => temperOf(n).on !== false);
const mine = (who) => list().some(n => A.sameName(n, who));
const present = () => (A.worldState()?.scene?.characters_present || []).map(A.canonName).filter(Boolean);
const inScene = (who, here = present()) => !here.length || here.some(h => A.sameName(h, who));

// ───────────── время истории ─────────────

function parseStamp(ts) {
    const d = A.parseDate(ts?.story_date);
    if (!d || isNaN(d)) return null;
    const tm = String(ts.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
    d.setHours(tm ? +tm[1] : 12, tm ? +tm[2] : 0, 0, 0);
    return d.getTime();
}
/** Момент истории на посте i: по отметке Horae на нём или раньше. */
function stampAt(i) {
    const chat = A.chatArr();
    for (let j = Math.min(i, chat.length - 1); j >= 0; j--) {
        const ts = chat[j]?.horae_meta?.timestamp;
        if (!ts?.story_date) continue;
        const t = parseStamp(ts);
        if (t != null) return { ts: t, mes: i, day: String(ts.story_date).trim() };
    }
    return { ts: null, mes: i, day: '' };
}
/** Сейчас: как видит Life (после перемотки — уже новое время). */
function nowStamp() {
    const ts = A.worldState()?.timestamp || {};
    return { ts: parseStamp(ts), mes: A.chatArr().length - 1, day: String(ts.story_date || '').trim() };
}
/** «ММ-ДД» дня истории (или ''). */
function mdOf(day) {
    const d = day ? A.parseDate(day) : null;
    return d && !isNaN(d) ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
}
function lastAi() {
    const chat = A.chatArr();
    for (let k = chat.length - 1; k >= 0; k--) if (chat[k] && !chat[k].is_user && !chat[k].is_system) return k;
    return -1;
}
const aiSince = (from, to) => { const chat = A.chatArr(); let n = 0; for (let k = from + 1; k <= to && k < chat.length; k++) if (chat[k] && !chat[k].is_user && !chat[k].is_system) n++; return n; };
/** Часов истории между моментами; без дат — по ответам (~15 минут на ответ). Не больше двух недель за раз. */
function hoursBetween(a, b) {
    if (!a) return 0;
    const h = a.ts != null && b.ts != null ? (b.ts - a.ts) / 3.6e6 : aiSince(a.mes ?? b.mes, b.mes) * 0.25;
    return Math.max(0, Math.min(336, h));
}

// ───────────── органы чувств: что Life знает о теле и нервах ─────────────

function close(who, to) {
    try { const r = A.relOf(who, to); return !!r && num(r.closeness) >= 60; } catch { return false; }
}

/**
 * Что давит на него прямо сейчас помимо событий: сдвиги осей, приток напряжения и несказанного, потолок и скорость воли.
 * s — состояние (для плохой ночи), t — темперамент (для дат).
 */
function signals(who, t = temperOf(who), s = stateOf(who)) {
    const S = A.senses || {};
    const off = { val: 0, aro: 0, ctl: 0, wor: 0 };
    const out = { off, strainIn: 0, maskIn: 0, willMul: 1, willCap: 100, raw: 1, sleepQ: 1, loose: false, worry: false, night: false, date: null, list: [] };
    const add = (id, text, o = {}) => { for (const a of P.AXES) off[a] += o[a] || 0; out.list.push({ id, text }); };
    const today = nowStamp().day;
    // химия: что сейчас действует
    const fx = new Set();
    for (const x of safe(() => S.fx?.(who) || [], [])) for (const [k, re] of FX) if (re.test(String(x?.what || ''))) fx.add(k);
    const dull = fx.has('painkiller') ? 0.5 : 1;
    const pain = P.clamp(safe(() => S.hurt?.(who)?.lvl, 0), 0, 4);
    if (pain > 0) {
        add('pain', `рана (${SEV[pain]})${dull < 1 ? ' — под обезболивающим' : ''}`, { val: -5 * pain * dull, ctl: -3 * pain * dull, aro: 2 * pain * dull });
        out.strainIn += 0.67 * pain * dull;
        out.willCap = Math.min(out.willCap, 100 - 10 * pain * dull);
    }
    const debt = P.clamp(safe(() => S.sleep?.(who)?.debt, 0), 0, 30);
    if (debt >= 4) {
        add('sleep', `недосып: ${debt} ч за неделю`, { aro: -Math.min(14, debt), val: -Math.min(8, debt / 2) });
        out.strainIn += 0.12 * Math.min(debt, 12);
        out.willMul *= Math.max(0.35, 1 - debt / 20);
        out.raw *= 1 + Math.min(debt, 16) / 40;
        out.sleepQ = Math.max(0.2, 1 - debt / 12);
    }
    const nd = safe(() => S.needs?.(who), null);
    if (nd) {
        if (num(nd.energy, 80) < 30) {
            const flat = nd.energy < 15;
            add('tired', flat ? 'валится с ног' : 'усталость', { aro: flat ? -18 : -10, val: -4 });
            out.strainIn += 0.4;
            out.willCap = Math.min(out.willCap, flat ? 55 : 75);
        }
        if (num(nd.food, 80) < 25) { add('hungry', 'голод', { val: -6 }); out.raw *= 1.15; }
    }
    // тревога за близкого человека игрока: её Камни и её раны
    const U = user();
    if (U && close(who, U)) {
        const st = safe(() => S.stones?.(), null);
        if (st && A.sameName(st.who, U) && st.mode && st.mode !== 'calm') {
            const att = st.mode === 'attack';
            add('worry', `тревога (${short(U)}): ${att ? 'приступ Камней' : 'Камни гудят'}`, { aro: att ? 16 : 8, ctl: att ? -12 : -6, val: att ? -8 : -4 });
            out.strainIn += att ? 1.2 : 0.5;
            if (att) out.worry = true;      // опекой выходит сильная тревога; «гудят» — только фон
        }
        const up = P.clamp(safe(() => S.hurt?.(U)?.lvl, 0), 0, 4);
        if (up >= 2) { add('worry2', `тревога (${short(U)}): рана`, { aro: 4 * up, ctl: -3 * up, val: -2 * up }); out.strainIn += 0.3 * up; out.worry = true; }
    }
    const pt = safe(() => S.patience?.(), null);
    if (pt && A.sameName(pt.who, who) && num(pt.pat, 100) < 40) {
        const low = pt.pat < 20;
        add('pat', `терпение на исходе (${Math.round(pt.pat)})`, { val: low ? -10 : -6, aro: 4 });
        out.strainIn += low ? 0.5 : 0.25;
    }
    // несказанное: тайны, которые держит от неё, и свои желания, о которых давно молчит
    const kept = U ? safe(() => S.kept?.(who, U), null) : null;
    if (kept?.n) { out.maskIn += Math.min(1.5, 0.25 * kept.n); out.list.push({ id: 'kept', text: `тайны, которых не знает ${short(U)}: ${kept.n}` }); }
    const lastI = A.chatArr().length - 1;
    const unsaid = safe(() => S.wants?.(who) || [], []).filter(w => w.voiced == null && lastI - num(w.mes) >= 30).length;
    if (unsaid) { out.maskIn += Math.min(0.6, 0.15 * unsaid); out.list.push({ id: 'unsaid', text: `молчит о своих желаниях: ${unsaid}` }); }
    // действующие вещества
    if (fx.has('alcohol')) { add('fx-alc', 'алкоголь: тормоза слабее', { ctl: -6, aro: 4 }); out.loose = true; }
    if (fx.has('sedative')) { add('fx-sed', 'седативное', { aro: -15 }); out.strainIn -= 0.3; }
    if (fx.has('stim')) { add('fx-stim', 'стимулятор', { aro: 12 }); out.raw *= 1.1; }
    // день, который он помнит телом
    const md = mdOf(today);
    const dt = md ? t.dates.find(d => d.md === md) : null;
    if (dt) {
        add('date', `сегодня: ${dt.t}`, dt.kind === 'blow' ? { wor: -10, val: -6 } : { val: -10, aro: -6 });
        out.strainIn += 0.4;
        out.date = dt;
    }
    // утро после плохой ночи
    if (s?.night?.bad && s.night.day === today) {
        add('night', 'плохая ночь', { aro: -8, val: -6 });
        out.willCap = Math.min(out.willCap, 80);
        out.night = true;
    }
    out.strainIn = Math.max(0, out.strainIn);
    return out;
}
const loadOf = (sig) => ({ strainIn: sig.strainIn, maskIn: sig.maskIn, willMul: sig.willMul, willCap: sig.willCap });

/** Каким он будет прямо сейчас: состояние, доведённое до текущего момента истории (само состояние не трогает). */
function view(who) {
    const t = temperOf(who);
    const live = stateOf(who);
    const sig = signals(who, t, live);
    const s = clone(live);
    if (s.at) P.decay(s, hoursBetween(s.at, nowStamp()), t, loadOf(sig));
    else s.will = Math.min(s.will, sig.willCap);
    const E = P.eff(s, sig.off);
    return { who, t, s, sig, E, dom: P.dominant(E, s.base) };
}

const domLabel = (dom) => (dom?.id ? EMO_NAME[dom.id][dom.step - 1] : 'ровно');
/** Сколько прожито вдвоём с героиней игрока и сняты ли тормоза — для цены шага. */
const initCtx = (who, v) => ({ steps: num(safe(() => A.senses?.steps?.(who, user())?.n, 0)), loose: !!v.sig.loose });

// ───────────── Летописец ─────────────

const RULE = `
psy — что этот пост (и пост игрока перед ним) сделал с ВНУТРЕННИМ состоянием персонажей из строки «Психика»: [{"who":"имя","blow":2,"held":1,"why":"из-за чего, 3–10 слов"}]. Только те, с кем что-то случилось; ни с кем — []. В строке — только ненулевые шкалы, каждая от 1 до 3 (1 — слегка, 2 — заметно, 3 — по-настоящему сильно; 3 ставь редко): warm — ему дали тепло, поддержку, нежность, признание; fun — смех, игра, флирт, азарт; win — справился, защитил, его послушали, получилось; calm — отдых, покой, безопасность, отпустило; threat — угроза ему или тем, кто ему дорог, опасность; blow — удар по самооценке: унизили, обесценили, пристыдили, напомнили о худшем в нём, сам себя винит; bound — потерял контроль: решили за него, скован, беспомощен, лишён выбора; wrong — с ним обошлись несправедливо, соврали, перешли границу, задели близкого; loss — утрата, разлука, отвергли, одиночество; held — сдержался: проглотил, промолчал, удержал лицо, хотя внутри кипело; open — открылся: сказал вслух то, что носил в себе, показал настоящее, выплакался, признался. Оценивай то, что случилось С НИМ, а не то, как он это показал: спокойное лицо после оскорбления — это blow и held. Обычный разговор без такого — не пиши ничего.
Если в «Психике» у человека есть «возвращает» и в посте это с ним произошло и помогло — добавь в его строку "fix":[номера]. Если есть «убеждения» и поступок или слова в посте ПО-НАСТОЯЩЕМУ поколебали одно из них (−1 слегка, −2 сильно: ему на деле показали, что это не так, и он хоть на шаг это принял) или подтвердили (1, 2) — добавь "bel":[{"id":"b…","d":-1}]; дежурный комплимент убеждение не колеблет.`;

function chron() {
    if (!on()) return null;
    const who = list();
    if (!who.length) return null;
    let extra = 0;
    const cur = who.map(n => {
        const v = view(n);
        const bits = [`${n} — ${v.dom.id ? `${domLabel(v.dom)} (${v.dom.step} из ${P.EMO_STEPS[v.dom.id]})` : 'ровно'}`];
        if (v.t.fix.length) { bits.push(`возвращает: ${v.t.fix.map((f, k) => `[${k + 1}] ${f}`).join(', ')}`); extra += 25; }
        const bel = v.t.beliefs.filter(b => P.beliefHp(v.s, b.id) > 0);
        if (bel.length) { bits.push(`убеждения: ${bel.map(b => `[${b.id}] «${b.t}»`).join(', ')}`); extra += 25; }
        return bits.join('; ');
    });
    return { key: '"psy": []', rule: RULE, tokens: 50 + who.length * 45 + extra, input: `Психика (оцени, что с ними случилось в этих постах): ${cur.join(' | ')}` };
}

function log(s, e) {
    s.log.push(e);
    if (s.log.length > 24) s.log.splice(0, s.log.length - 24);
}

/** Ведущая эмоция → состояние во «Внутри» Life (его лица, чипы и соседние модули видят то же, что считает мозг). */
function drive(who, dom, s, why, i) {
    const S = A.senses;
    if (!S?.setState || cfg().drive === false) return;
    const cur = safe(() => S.state?.(who), null);
    if (cur?.manual) return;
    const id = s.hang && !dom.id ? 'sad' : INNER[dom.id] || '';
    if (!id) { if (cur?.src === ID) S.setState(who, '', '', i, ID); return; }
    // хорошее не перебивает то, что поставил Летописец («заведён», «дуется»); плохое — перебивает
    if (!NEG.includes(dom.id) && !s.hang && cur && cur.src !== ID) return;
    S.setState(who, id, why || '', i, ID);
}

/** Убеждение сломалось: сказать ей и предложить дописать новую правду в ядро характера. */
function beliefBroke(who, bel) {
    const name = A.canonName(who);
    const line = bel.truth || `больше не считает, что «${bel.t}»`;
    const can = !!A.lore?.coreAdd;
    A.toast('success', `${esc(short(who))}: убеждение «${esc(bel.t)}» больше не держится.${bel.truth ? ` Теперь: ${esc(bel.truth)}.` : ''}${can ? '<br><small>тапни — дописать это в ядро характера</small>' : ''}`, TITLE, {
        timeOut: 15000, escapeHtml: false,
        onclick: () => { if (can && safe(() => A.lore.coreAdd(name, line), false)) A.toast('success', 'Дописано в ядро характера.', TITLE, { timeOut: 2500 }); },
    });
}

function afterPost(i, j, msg) {
    if (!on()) return;
    // Летописца попросили перечитать СТАРЫЙ пост — его события уже посчитаны, второй раз не считаем
    if (i < lastAi()) return;
    const m = M();
    // свайп того же поста — с того же места
    // (ручные правки после этого поста лежат в m.ops и накладываются заново; новый пост — они уже в снимке)
    if (m.snap && m.snap.i === i) { try { m.who = JSON.parse(m.snap.data); } catch { /* */ } }
    else { m.snap = { i, data: JSON.stringify(m.who) }; m.ops = []; }
    const ops = Array.isArray(m.ops) ? m.ops.filter(o => o.i === i) : [];
    const n = stampAt(i);
    const here = present();
    const rows = Array.isArray(j?.psy) ? j.psy : [];
    const trig = safe(() => A.senses?.trigAt?.(i) || [], []);
    for (const who of list()) {
        const t = temperOf(who);
        const s = stateOf(who);
        const there = inScene(who, here);
        // новая ночь: на нервах — плохая (свайп даёт ту же)
        const nights = s.at?.day && n.day && s.at.day !== n.day ? 1 : 0;
        if (nights) {
            const bad = P.nightRoll(s, `${A.canonName(who)}:${n.day}`, { trig: s.lastTrig != null && i - s.lastTrig <= 40 });
            s.night = { day: n.day, bad, n: 0 };
            if (bad) log(s, { mes: i, src: 'night', why: 'плохая ночь: сна почти не было' });
        } else if (s.night?.bad && there) s.night.n = num(s.night.n) + 1;
        const sig = signals(who, t, s);
        // время: вспышки гаснут, настроение оседает, воля возвращается, напряжение и несказанное идут к равновесию
        P.decay(s, s.at ? hoursBetween(s.at, n) : 0, t, { ...loadOf(sig), nights, sleepQ: sig.sleepQ * (nights && s.night?.bad ? 0.3 : 1) });
        s.at = { ts: n.ts, mes: i, day: n.day };
        if (s.hang && P.hangOver(s, n)) s.hang = null;
        // срыв был сигналом на этот ответ: он его сыграл (или прошло два ответа) — дальше похмелье
        if (s.brk && i > s.brk.mes && (!msg || A.sameName(msg.name, who) || aiSince(s.brk.mes, i) >= 2)) {
            P.resolveBreak(s, n);
            log(s, { mes: i, src: 'brk', why: 'срыв прожит — пусто и тяжело' });
        }
        // события этого поста
        const row = rows.find(r => r && typeof r === 'object' && A.sameName(String(r.who || ''), who));
        const said = P.cleanHits(row);      // что назвал Летописец
        let hits = said;
        let why = str(row?.why, 90);
        for (const e of trig) {
            if (!A.sameName(e.who, who)) continue;
            const lv = Math.round(P.clamp(e.lvl, 1, 3));
            hits = P.mergeHits(hits, e.coped ? { threat: Math.max(1, lv - 1) } : { threat: lv, bound: Math.max(1, lv - 1) });
            why = why || `триггер: ${str(e.t, 60)}`;
            s.lastTrig = i;
        }
        if (Object.keys(hits).length) {
            const d = P.hit(s, hits, t, { raw: sig.raw });
            const neg = Object.keys(hits).some(k => P.NEGATIVE.includes(k));
            log(s, { mes: i, src: 'post', why, hits, d });
            if (why) s.why = { t: why, mes: i, neg };
            if ((hits.warm || 0) >= 2) s.warmAt = i;
        }
        // сработало то, что его возвращает
        const fixed = [...new Set(arr(row?.fix).map(Number).filter(k => Number.isInteger(k) && k >= 1 && k <= t.fix.length))].slice(0, 2);
        for (const k of fixed) log(s, { mes: i, src: 'fix', why: `сработало: ${t.fix[k - 1]}`, d: P.soothe(s) });
        // убеждения: поколебали или подтвердили
        for (const b of arr(row?.bel).slice(0, 2)) {
            const bel = t.beliefs.find(x => x.id === String(b?.id || ''));
            const d = Math.round(P.clamp(b?.d, -2, 2));
            if (!bel || !d || P.beliefHp(s, bel.id) <= 0) continue;
            const res = P.beliefHit(s, bel.id, d);
            s.belAt = i;
            log(s, { mes: i, src: 'bel', why: `убеждение «${bel.t}» ${d < 0 ? 'поколеблено' : 'подтверждено'} — прочность ${Math.round(P.beliefHp(s, bel.id))}` });
            if (res === 'broken') {
                s.belBroke = { id: bel.id, mes: i };
                s.base.wor = P.clamp(s.base.wor + 8, t.base.wor - P.BASE_SPAN, t.base.wor + P.BASE_SPAN);
                log(s, { mes: i, src: 'bel', why: `убеждение «${bel.t}» сломалось` });
                beliefBroke(who, bel);
            }
        }
        const E = P.eff(s, sig.off);
        const dom = P.dominant(E, s.base);
        // шаги по своей инициативе, сделанные в этом посте, стоят воли
        for (const sp of spends.filter(x => x.i === i && A.sameName(x.who, who))) {
            const g = P.afford(s, dom, sp.kind, initCtx(who, { sig }));
            P.spend(s, g.cost);
            log(s, { mes: i, src: 'init', why: `сам сделал шаг (${INIT_NAME[sp.kind] || 'инициатива'}): воля −${g.cost}` });
        }
        if (there) P.holdCost(s, dom);
        if (cfg().brk !== false && there) {
            // сработавший триггер сам по себе не «острый» срыв: его эпизод играет модуль триггеров
            const kind = P.breakCheck(s, E, said);
            if (kind) {
                s.brk = { mes: i, ts: n.ts, kind, why: why || s.why?.t || '' };
                log(s, { mes: i, src: 'brk', why: kind === 'acute' ? 'срыв: удар в больное' : 'срыв: накопилось, держать нечем' });
                const name = A.canonName(who);
                A.toast('warning', `${esc(short(who))}: срыв — ${kind === 'acute' ? 'удар пришёлся в больное' : 'накопилось, держать больше нечем'}. В следующем ответе это прорвётся.<br><small>тапни — отменить</small>`, TITLE, {
                    timeOut: 12000, escapeHtml: false,
                    onclick: () => { cancelBreak(name); },
                });
            }
        }
        let last = dom;
        const mineOps = ops.filter(o => A.sameName(o.who, who));
        if (mineOps.length) { for (const op of mineOps) applyOp(s, t, op); last = P.dominant(P.eff(s, sig.off), s.base); }
        P.sample(s, P.eff(s, sig.off), n.day);
        // когда они последний раз были в одной сцене с героиней игрока (для «стука от тоски»)
        if (there && here.length && inScene(user(), here)) s.seen = { ts: n.ts, mes: i };
        drive(who, last, s, s.why && i - s.why.mes <= 6 ? s.why.t : '', i);
        // лицо на аватарке: мозг подсказывает, только если Летописец лица не увидел и человек не держал маску
        if (A.senses?.face && !said.held) {
            const face = s.hang && !last.id ? 'sad' : last.step >= 2 ? FACE[last.id] : '';
            if (face) safe(() => A.senses.face(i, who, face));
        }
    }
    for (let k = spends.length - 1; k >= 0; k--) if (spends[k].i <= i) spends.splice(k, 1);
    saveM();
    safe(() => A.saveMeta?.());
}

function cancelBreak(who) {
    if (!stateOf(who).brk) return;
    manual(who, { act: 'unbrk' });
    refresh();
}

// ───────────── заметка модели ─────────────

/** Какое убеждение сейчас к месту: только что задели, идёт стыд или ему только что сказали тёплое. */
function beliefBit(v) {
    const { s, t, dom } = v;
    if (!t.beliefs.length) return '';
    const lastI = A.chatArr().length - 1;
    if (s.belBroke && lastI - s.belBroke.mes <= 40) {
        const b = t.beliefs.find(x => x.id === s.belBroke.id);
        if (b) return beliefText(b, 0);
    }
    const live = t.beliefs.filter(b => P.beliefHp(s, b.id) > 0);
    if (!live.length) return '';
    const near = (at) => at != null && lastI - at <= 3;
    if (!(dom.id === 'shame' || near(s.belAt) || near(s.warmAt))) return '';
    const b = live.slice().sort((x, y) => P.beliefHp(s, x.id) - P.beliefHp(s, y.id))[0];
    return beliefText(b, P.beliefBand(P.beliefHp(s, b.id)));
}

function note(who) {
    const v = view(who);
    const { s, t, dom, sig } = v;
    const W = short(who), U = short(user());
    if (s.brk) {
        return `[${W} — срыв в этом ответе: ${cassText(t, 'brk')}.${s.brk.why ? ` Последняя капля: ${s.brk.why}.` : ''} Сыграй по-настоящему и в характере персонажа; примирения и «всё хорошо» в этом же ответе не будет. За персонажа игрока (${U}) не решай и не говори.]`;
    }
    const bits = [];
    if (s.hang) bits.push(`после срыва — ${cassText(t, 'hang')}`);
    if (dom.id) {
        bits.push(`${domLabel(dom)} — ${cassOf(t, dom.id, dom.step)}`);
        if (dom.second) bits.push(`примесью — ${EMO_NAME[dom.second][Math.max(1, P.stepOf(dom.second, dom.all[dom.second])) - 1]}`);
    }
    // то, что накладывается сверху: не больше трёх, по важности
    const extra = [];
    const leak = P.leakOf(s, sig.loose);
    if (leak) extra.push(`${leak === 2 ? 'то, что прячет, уже почти не держится и может сорваться с языка' : 'то, что прячет, проступает сильнее обычного'}: ${cassText(t, 'leak')}`);
    if (sig.worry && inScene(user())) extra.push(`тревога за близкого (${U}) выходит опекой: ${cassText(t, 'care')}`);
    if (sig.night && num(s.night?.n) < 6) extra.push(`ночь была плохой — ${cassText(t, 'night')}`);
    if (sig.date) extra.push(`сегодня ${sig.date.t} — помнит этот день телом, вслух может и не сказать`);
    const bel = beliefBit(v);
    if (bel) extra.push(bel);
    if (sig.loose) extra.push('под алкоголем: тормоза слабее, скрываемое ближе к поверхности');
    bits.push(...extra.slice(0, 3));
    const neg = NEG.includes(dom.id);
    if (neg && dom.step >= 2 && t.fix.length) bits.push(`что возвращает в себя (сам к этому тянется): ${t.fix.slice(0, 4).join(', ')}`);
    const band = P.willBand(s.will);
    const will = WILL_TEXT[band];
    if (!bits.length && !will) return '';
    const fresh = s.why && A.chatArr().length - 1 - s.why.mes <= 6 && (!dom.id || s.why.neg === neg) ? s.why.t : '';
    let tail = '';
    const deep = neg ? s.mood[MAIN_AX[dom.id]] : 0;
    if (neg && deep <= -16) tail = ' Это уже не вспышка, а настроение: от одной хорошей фразы не отпустит — теплеет постепенно, за несколько шагов.';
    else if (neg && deep > -6) tail = ' Это вспышка: если не подливать, скоро отпустит.';
    return `[${W} — что внутри сейчас (считает Life по событиям истории; играй в поведении и теле, не называя и без цифр): ${bits.join('; ') || 'ровно'}.${fresh ? ` Из-за чего: ${fresh}.` : ''}${tail}${will ? ` Запас сил: ${will}.` : ''}]`;
}

function prompt(type) {
    if (!on() || type === 'quiet' || type === 'impersonate') return '';
    const here = present();
    return list().filter(n => inScene(n, here)).map(n => safe(() => note(n), '')).filter(Boolean).join('\n');
}

// ───────────── что мозг отдаёт соседям Life ─────────────

/** Дошло ли до той ступени, где он срывается на свой язык: слово для «Языков» или ''. */
function tongueOf(who) {
    const v = view(who);
    if (v.s.brk) return 'срыв';
    if (v.s.lastTrig != null && A.chatArr().length - 1 - v.s.lastTrig <= 2) return 'триггер';
    const d = v.dom;
    if (d.id === 'anger' && d.step >= 2) return 'злость';
    if (d.id === 'fear' && d.step >= 3) return 'страх';
    if (d.id === 'tender' && d.step >= 2) return 'нежность';
    if (d.id === 'low' && d.step >= 2) return 'тоска, наедине с собой';
    return '';
}

/** Что на самом деле назрело у тех, кто в сцене, — одной строкой для твиста вслепую и искры драмы ('' — ничего). */
function ripeOf() {
    const here = present();
    const found = [];
    for (const who of list().filter(n => inScene(n, here))) {
        const v = view(who);
        const { s, t, sig } = v;
        const W = short(who);
        if (s.brk) found.push([9, `${W} на грани срыва`]);
        if (P.leakOf(s, sig.loose)) found.push([8, `${W} носит в себе несказанное, и оно просится наружу`]);
        if (sig.date) found.push([7, `сегодня ${sig.date.t} — ${W} помнит этот день`]);
        const weak = t.beliefs.map(b => [b, P.beliefHp(s, b.id)]).filter(([, hp]) => hp > 0 && hp <= 40).sort((a, b) => a[1] - b[1])[0];
        if (weak) found.push([6, `убеждение «${weak[0].t}», с которым живёт ${W}, вот-вот рухнет`]);
        if (s.strain >= 60) found.push([5, `${W}: нервы на пределе${sig.list.length ? ` (${sig.list.slice(0, 2).map(x => x.text).join(', ')})` : ''}`]);
        if (sig.worry) found.push([4, `${W} изводится тревогой за близкого`]);
        if (sig.list.some(x => x.id === 'unsaid')) found.push([3, `${W} давно молчит о собственном желании`]);
        if (sig.night) found.push([2, `у ${W} была плохая ночь`]);
    }
    found.sort((a, b) => b[0] - a[0]);
    return found[0]?.[1] || '';
}

/** Кто соскучился: близкий, которого давно не было в одной сцене с героиней игрока. Не больше одного. */
function missOf() {
    const here = present();
    const U = user();
    const now = nowStamp();
    const out = [];
    for (const who of list()) {
        if (inScene(who, here) && here.length) continue;
        const s = stateOf(who);
        if (!s.seen || s.brk || s.will < 20 || !close(who, U)) continue;
        const h = hoursBetween(s.seen, now);
        const far = s.seen.ts != null && now.ts != null ? h >= 30 : aiSince(s.seen.mes, now.mes) >= 80;
        if (!far) continue;
        out.push({ h, id: `brn:${A.canonName(who)}:${now.day || Math.floor(now.mes / 80)}`, who: A.canonName(who), how: h >= 72 ? 'call' : 'text', why: 'давно не виделись: скучает и хочет знать, как дела' });
    }
    return out.sort((a, b) => b.h - a.h).slice(0, 1).map(({ h, ...x }) => x);
}

// ───────────── темперамент из карточки и лорбука ─────────────

const COLLECT_SYS = `Ты настраиваешь «код-мозг» персонажа ролевой истории: его психику дальше считает программа, а не модель. По карточке, ядру характера и записям лорбука выпиши ТЕМПЕРАМЕНТ и КАССЕТЫ ПОВЕДЕНИЯ. Ответь только одним JSON по-русски:
{"note":"1–2 предложения: что у него за психика, главное","base":{"val":0,"aro":0,"ctl":0,"wor":0},"react":1,"recover":1,"grit":1,"sens":{"warm":1,"threat":1,"blow":1,"bound":1,"wrong":1,"loss":1},"cass":{"fear":["","","",""],"anger":["","","",""],"shame":["","","",""],"low":["","",""],"tender":["","",""],"playful":["",""],"brk":"","hang":"","care":"","night":"","leak":""},"fix":[""],"beliefs":[{"t":"","truth":""}],"dates":[{"md":"ММ-ДД","t":"","kind":"loss"}]}
base — его обычное состояние в спокойный день, каждая ось от −30 до 30 (0 — обычный человек): val — мрачность (минус) или тепло (плюс); aro — вялость (минус) или взведённость (плюс); ctl — чувство беспомощности (минус) или контроля над собой и ситуацией (плюс; у обученных бойцов и лидеров 20–30); wor — стыд и вина за себя (минус) или самоуважение (плюс).
react — как сильно его задевают события: 0.7 толстокожий, 1 обычный, 1.4 оголённый нерв. recover — как быстро отходит: 0.6 долго носит в себе, 1 обычно, 1.6 отходчивый. grit — запас воли держать лицо и делать трудное: 0.7 мало, 1 обычно, 1.6 железная выдержка.
sens — больные места, множитель от 0.6 до 1.5 (1 — как у всех; 1.5 — редкость, только для главной раны): warm — насколько на него действует тепло и похвала (ниже 1, если не верит хорошему о себе); threat — угроза и опасность; blow — удары по самооценке, стыд, напоминание о худшем в нём; bound — потеря контроля: решают за него, фиксируют, лишают выбора; wrong — несправедливость, ложь, задели близкого; loss — утрата, разлука, отвержение.
Не преувеличивай: тяжёлое прошлое не значит, что он всё время на грани. Взрослый человек, который живёт с этим годами, в обычный день держится ровно.
cass — кассеты: КАК ИМЕННО ОН ведёт себя на каждой ступени чувства, от слабой к сильной (fear — страх, anger — злость, shame — стыд и вина: по 4 ступени; low — тоска, tender — нежность: по 3; playful — кураж: 2). Каждая строка 10–28 слов: конкретные жесты, речь, привычки, что делает руками и голосом, куда уходит — ЕГО, из карточки и лорбука, а не «человек вообще». Не начинай строку с названия чувства. Ступени различаются и нарастают; сильная ступень — не истерика, если он не такой. Одной строкой: brk — как выглядит ЕГО срыв, когда запас кончился; hang — каким он бывает после срыва; care — как у него выглядит тревога за близкого (опека, контроль, проверки); night — каким он бывает утром после плохой ночи или кошмара; leak — как у него проступает то, что он прячет. Настоящее время, без имени в начале, без слова «ступень» и без цифр.
fix — 3–6 вещей, которые возвращают его в себя, когда плохо (по 1–4 слова, из лорбука: голос близкого, счёт вслух, дело для рук, холодная вода…). beliefs — 1–3 глубинных убеждения о себе, с которыми он живёт и которые мешают принимать хорошее: t — его словами, 2–6 слов («я испорченный»); truth — что станет его правдой, если убеждение сломается, 3–10 слов. dates — дни в году, которые он помнит телом (годовщина гибели, день, когда всё сломалось): md — месяц и день «ММ-ДД», t — что это за день, 2–6 слов, kind — loss (утрата) или blow (вина, стыд). Только если в записях есть точные день и месяц; не выдумывай — иначе [].`;

async function collect(who) {
    const name = A.canonName(who);
    const L = A.lore || {};
    let card = safe(() => L.card?.(name, 5000) || '', '');
    if (!card) { const ch = safe(() => A.cardOf?.(name), null); card = [ch?.description, ch?.personality, ch?.data?.description].filter(Boolean).join('\n').slice(0, 5000); }
    const core = safe(() => L.core?.(name) || '', '');
    let lore = '';
    try { lore = (await L.about?.(name, { max: 12000 })) || ''; } catch { /* */ }
    if (!card && !lore && !core) throw new Error('ни карточки, ни лорбука о нём не нашлось');
    const usr = [`Персонаж: ${name}`, core ? `Ядро характера:\n${core}` : '', card ? `Карточка:\n${card}` : '', lore ? `Лорбук:\n${lore}` : ''].filter(Boolean).join('\n\n');
    const j = await A.askJson([{ role: 'system', content: COLLECT_SYS }, { role: 'user', content: usr }], 3400, { check: (x) => !!x && typeof x === 'object' && (!!x.cass || !!x.base), what: 'Темперамент' });
    const old = temperOf(name);
    const t = editTemper(name, (x) => {
        for (const a of P.AXES) x.base[a] = Math.round(P.clamp(j.base?.[a] ?? x.base[a], -30, 30));
        x.react = P.clamp(j.react ?? 1, 0.7, 1.4);
        x.recover = P.clamp(j.recover ?? 1, 0.6, 1.6);
        x.grit = P.clamp(j.grit ?? 1, 0.7, 1.6);
        for (const k of Object.keys(x.sens)) x.sens[k] = P.clamp(j.sens?.[k] ?? 1, 0.6, 1.5);
        const cass = cleanCass(j.cass);
        if (Object.keys(cass).length) x.cass = { ...x.cass, ...cass };
        // что возвращает, убеждения и даты: собранное не затирает то, что уже есть (ты могла править руками)
        if (!x.fix.length) x.fix = arr(j.fix);
        if (!x.beliefs.length) x.beliefs = arr(j.beliefs).map(b => ({ t: str(b?.t, 90), truth: str(b?.truth, 140) })).filter(b => b.t);
        if (!x.dates.length) x.dates = arr(j.dates);
        x.note = str(j.note, 400);
        x.src = 'lore';
    });
    cfg().prof[keyOf(name)] = P.normTemper(t);
    saveCfg();
    // характер в этом чате сдвигается вместе с темпераментом (накопленный дрейф остаётся)
    const s = stateOf(name);
    for (const a of P.AXES) s.base[a] = P.clamp(s.base[a] + (t.base[a] - old.base[a]), -100, 100);
    saveM();
    return temperOf(name);
}

let ensuring = false;
/** Фоном, когда открыт чат: у главных без темперамента — собрать по одному (раз в шесть часов на попытку). */
async function ensure() {
    if (ensuring || !on() || cfg().auto === false || !A.askJson) return;
    ensuring = true;
    try {
        for (const who of list()) {
            const k = keyOf(who);
            const c = cfg();
            if (c.prof[k]?.src && c.prof[k].src !== 'auto') continue;
            if (Date.now() - num(c.tried[k]) < 6 * 36e5) continue;
            c.tried[k] = Date.now();
            saveCfg();
            try {
                await collect(who);
                A.toast('success', `${esc(short(who))}: темперамент и кассеты собраны по карточке и лорбуку. Посмотреть и поправить — Сцена → ${TITLE}.`, TITLE, { timeOut: 6000, escapeHtml: false });
                safe(() => A.updatePrompt());
                refresh();
            } catch (e) { console.warn(`[Мозг] темперамент ${who}`, e); }
        }
    } finally { ensuring = false; }
}

// ───────────── вид ─────────────

function auraStyle(v) {
    const a = P.auraOf(v.E, v.s);
    return { cls: a.crack ? ' crack' : '', css: `--h:${a.hue};--s:${a.sat}%;--l:${a.lum}%;--d:${a.dur}s;--b:${a.blur}px;--z:${(a.size / 100).toFixed(2)}` };
}
function auraHtml(who, size = 'md', v = view(who)) {
    const a = auraStyle(v);
    return `<span class="brn-aura ${size}${a.cls}" style="${a.css}">${A.ava(who, size)}</span>`;
}

function sceneHtml() {
    if (!on() || cfg().aura === false) return '';
    const here = present();
    const who = list().filter(n => inScene(n, here));
    if (!who.length) return '';
    return `<div class="brn-scene">${who.map(n => {
        const v = view(n);
        const mark = v.s.brk ? 'срыв' : v.s.hang && !v.dom.id ? 'после срыва' : domLabel(v.dom);
        return `<button class="brn-sc${v.s.brk ? ' brk' : ''}" data-bact="open" data-who="${esc(n)}">${auraHtml(n, 'sm', v)}<span><b>${esc(short(n))}</b><small>${esc(mark)}</small></span></button>`;
    }).join('')}</div>`;
}

const pct = (x) => Math.round((P.clamp(x, -100, 100) + 100) / 2);
function axisRow(a, v) {
    const e = v.E[a], b = P.clamp(v.s.base[a], -100, 100);
    const from = Math.min(50, pct(e)), w = Math.abs(pct(e) - 50);
    return `<div class="brn-ax"><small>${AX_NAME[a][0]}</small><i class="${e < 0 ? 'neg' : 'pos'}"><u style="left:${from}%;width:${w}%"></u><em style="left:${pct(b)}%" title="характер"></em><s style="left:${pct(e)}%"></s></i><small>${AX_NAME[a][1]}</small></div>`;
}
const bar = (label, val, cls, hint) => `<div class="brn-res ${cls}"><div><b>${label}</b><span>${Math.round(val)}</span></div><i><u style="width:${Math.round(P.clamp(val, 0, 100))}%"></u></i>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;

function deltaText(d) {
    if (!d) return '';
    return Object.entries(d).filter(([k, x]) => D_NAME[k] && Math.abs(x) >= 2).map(([k, x]) => `${D_NAME[k]} ${x > 0 ? '+' : '−'}${Math.abs(x)}`).join(', ');
}
const LOG_ICON = { brk: '⚡', hand: '✋', fix: '🫶', night: '🌙', init: '👣', bel: '🧱' };
function logRow(e) {
    const kinds = e.hits ? Object.entries(e.hits).map(([k, n]) => `${KIND_NAME[k]} ${n}`).join(', ') : '';
    const head = LOG_ICON[e.src] || `#${e.mes}`;
    return `<div class="brn-log"><span>${head}</span><div><b>${esc(kinds || e.why || '')}</b>${kinds && e.why ? `<small>${esc(e.why)}</small>` : ''}${e.d ? `<small class="d">${esc(deltaText(e.d))}</small>` : ''}</div></div>`;
}

/** Что будет, если ничего не менять. */
function foreHtml(v) {
    if (v.s.brk) return '';
    const f = P.forecast(v.s, v.t, loadOf(v.sig), v.sig.off);
    const hrs = (h) => (h >= 48 ? `~${Math.round(h / 24)} дн.` : `~${h} ч`);
    if (f.breakIn != null) return `<div class="brn-fore hot">⏳ Если ничего не изменится — срыв через ${hrs(f.breakIn)} истории: нагрузка копится быстрее, чем уходит.</div>`;
    if (f.rawIn != null) return `<div class="brn-fore hot">⏳ Если ничего не изменится — через ${hrs(f.rawIn)} истории нервы станут сырыми: дальше любой сильный удар может сорвать.</div>`;
    if (f.calmIn != null) return `<div class="brn-fore">⏳ Если не подливать — отпустит через ${hrs(f.calmIn)} истории.</div>`;
    if (NEG.includes(v.dom.id)) return '<div class="brn-fore">⏳ Само не отпустит: держится на том, что давит сейчас.</div>';
    return '';
}

/** Кардиограмма: тепло, самоценность и напряжение по дням истории. */
function chartHtml(s) {
    const h = arr(s.hist).slice(-30);
    if (h.length < 2) return '';
    const W = 300, H = 72, x = (k) => (k / (h.length - 1)) * W;
    const line = (f) => h.map((r, k) => `${x(k).toFixed(1)},${f(r).toFixed(1)}`).join(' ');
    const mid = (v) => H / 2 - (P.clamp(v, -100, 100) / 100) * (H / 2 - 4);
    const up = (v) => H - 4 - (P.clamp(v, 0, 100) / 100) * (H - 8);
    return `${A.sec('Кардиограмма', `${h.length} дн. истории`)}
        <div class="brn-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Тепло, самоценность и напряжение по дням истории">
            <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" class="mid"/>
            <polyline class="strain" points="${line(r => up(r.strain))}"/>
            <polyline class="wor" points="${line(r => mid(r.wor))}"/>
            <polyline class="val" points="${line(r => mid(r.val))}"/>
        </svg><div class="brn-legend"><span class="val">тепло</span><span class="wor">самоценность</span><span class="strain">напряжение</span><i>${esc(h[0].d)} — ${esc(h[h.length - 1].d)}</i></div></div>`;
}

function beliefsHtml(v) {
    const { s, t } = v;
    if (!t.beliefs.length) return '';
    return `${A.sec('Убеждения', 'точатся поступками')}
        <div class="brn-bels">${t.beliefs.map(b => {
            const hp = P.beliefHp(s, b.id), band = P.beliefBand(hp);
            return `<div class="brn-bel b${band}"><div><b>«${esc(b.t)}»</b><span>${Math.round(hp)}</span></div><i><u style="width:${Math.round(hp)}%"></u></i><small>${BELIEF_NAME[band]}${band === 0 && b.truth ? ` → ${esc(b.truth)}` : ''}</small></div>`;
        }).join('')}</div>`;
}

const range = (who, k, val, min, max, step, label, hint = '') => `<div class="brn-rng"><label>${label}<b data-out>${val}</b></label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-bin="t" data-k="${k}" data-who="${esc(who)}">${hint ? `<small>${hint}</small>` : ''}</div>`;
const dm = (md) => { const [m, d] = String(md).split('-'); return `${d}.${m}`; };

function temperHtml(who, t) {
    const srcName = { auto: 'обычный человек — ещё не собран', lore: 'собран по карточке и лорбуку', hand: 'поправлен руками' }[t.src];
    const area = (bin, k, rows, val, ph = '') => `<textarea rows="${rows}" data-bin="${bin}" data-k="${k}" data-who="${esc(who)}" placeholder="${esc(ph)}">${esc(val)}</textarea>`;
    return `<details class="lf-more brn-more" ${det('t')}><summary>Темперамент и кассеты — ${srcName}</summary>
        ${t.note ? `<div class="lf-hint">${esc(t.note)}</div>` : ''}
        <button class="lf-btn full" data-bact="collect" data-who="${esc(who)}">${A.icon ? A.icon('refresh') : ''} Собрать из карточки и лорбука</button>
        ${A.sec('В спокойный день')}
        ${P.AXES.map(a => range(who, `base.${a}`, t.base[a], -45, 45, 1, `${AX_NAME[a][0]} ↔ ${AX_NAME[a][1]}`)).join('')}
        ${A.sec('Как устроен')}
        ${range(who, 'react', t.react, 0.4, 2, 0.1, 'Насколько задевает', 'ниже — толстокожий, выше — оголённый нерв')}
        ${range(who, 'recover', t.recover, 0.4, 2.5, 0.1, 'Как быстро отпускает', 'ниже — долго носит в себе')}
        ${range(who, 'grit', t.grit, 0.4, 2, 0.1, 'Запас воли', 'сколько может держать лицо и как быстро она возвращается')}
        ${A.sec('Больные места', '1 — как у всех')}
        ${Object.keys(t.sens).map(k => range(who, `sens.${k}`, t.sens[k], 0.3, 2.5, 0.1, KIND_NAME[k])).join('')}
        ${A.sec('Что возвращает', 'по одному на строку')}
        <div class="lf-field">${area('f', 'fix', 4, t.fix.join('\n'), 'её голос\nсчёт вслух\nдело для рук')}</div>
        ${A.sec('Убеждения', 'убеждение => что станет правдой')}
        <div class="lf-field">${area('b', 'beliefs', 4, t.beliefs.map(b => `${b.t}${b.truth ? ` => ${b.truth}` : ''}`).join('\n'), 'я испорченный => я был оружием, а не убийцей')}</div>
        ${A.sec('Дни, которые помнит телом', 'день.месяц — что это')}
        <div class="lf-field">${area('d', 'dates', 3, t.dates.map(d => `${dm(d.md)} — ${d.t}${d.kind === 'blow' ? ' (вина)' : ''}`).join('\n'), '16.12 — что это за день')}</div>
        ${A.sec('Кассеты', 'от слабой ступени к сильной')}
        ${P.EMOS.map(id => `<div class="lf-field brn-cass"><label>${EMO_ICON[id]} ${EMO_TITLE[id]}</label>${cassLines(t, id).map((line, n) => `<div class="brn-cs"><span>${n + 1}</span><textarea rows="3" data-bin="c" data-k="${id}" data-n="${n}" data-who="${esc(who)}">${esc(line)}</textarea></div>`).join('')}</div>`).join('')}
        ${SINGLES.map(k => `<div class="lf-field"><label>${SINGLE_TITLE[k]}</label>${area('c', k, 3, cassText(t, k))}</div>`).join('')}
        <button class="lf-btn ghost full" data-bact="reset" data-who="${esc(who)}">Сбросить состояние в этом чате</button>
    </details>`;
}

function cardHtml(who) {
    const v = view(who);
    const { s, t, dom, sig } = v;
    const W = esc(short(who));
    if (t.on === false) {
        return `<div class="brn-card"><div class="brn-top">${A.ava(who, 'md')}<div><b>${W}</b><small>мозг выключен — состояние ведёт Летописец, как раньше</small></div></div>
            <label class="lf-switch"><input type="checkbox" data-bin="on" data-who="${esc(who)}"><span></span>${W}: включить код-мозг</label></div>`;
    }
    const title = s.brk ? 'срыв' : dom.id ? domLabel(dom) : s.hang ? 'после срыва' : 'ровно';
    const sub = s.brk ? cassText(t, 'brk') : dom.id ? cassOf(t, dom.id, dom.step) : s.hang ? cassText(t, 'hang') : 'ничего не давит — модели про состояние ничего не уходит';
    const steps = dom.id && !s.brk ? `<span class="brn-steps">${Array.from({ length: P.EMO_STEPS[dom.id] }, (_, k) => `<i class="${k < dom.step ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const band = P.willBand(s.will);
    const leak = P.leakOf(s, sig.loose);
    const logs = s.log.slice(-7).reverse();
    return `<div class="brn-card${s.brk ? ' brk' : ''}">
        <div class="brn-top">${auraHtml(who, 'md', v)}<div><b>${s.brk ? '⚡' : EMO_ICON[dom.id] || ''} ${esc(cap(title))}</b>${steps}<small>${esc(sub)}</small></div></div>
        ${s.brk ? `<div class="brn-warn">В следующем ответе это прорвётся.${s.brk.why ? ` Последняя капля: ${esc(s.brk.why)}.` : ''}<button class="lf-btn small" data-bact="unbrk" data-who="${esc(who)}">отменить срыв</button></div>` : ''}
        ${s.hang && !s.brk ? '<div class="brn-warn soft">После срыва: сил на маску нет, плохое бьёт больнее обычного.</div>' : ''}
        <div class="brn-axes">${P.AXES.map(a => axisRow(a, v)).join('')}</div>
        <div class="brn-two">${bar('Воля', s.will, `will b${band}`, WILL_NAME[band])}${bar('Напряжение', s.strain, `strain${s.strain >= 75 ? ' hot' : ''}`, s.strain >= 75 ? 'сырые нервы' : s.strain >= 50 ? 'копится' : '')}</div>
        ${bar('Несказанное', s.mask, `mask l${leak}`, LEAK_NAME[leak])}
        ${foreHtml(v)}
        ${A.sec('Почему так')}
        ${sig.list.length ? `<div class="lf-chips wrap brn-sig">${sig.list.map(x => `<span class="lf-chip">${esc(x.text)}</span>`).join('')}</div>` : ''}
        ${logs.length ? `<div class="brn-logs">${logs.map(logRow).join('')}</div>` : `<div class="lf-hint">${sig.list.length ? '' : 'Пока ничего не случилось. '}События появятся после ответа: Летописец назовёт, что с ним произошло, а посчитает код.</div>`}
        ${beliefsHtml(v)}
        ${t.fix.length ? `${A.sec('Что возвращает')}<div class="lf-chips wrap brn-sig">${t.fix.map(f => `<span class="lf-chip">${esc(f)}</span>`).join('')}</div>` : ''}
        ${chartHtml(s)}
        ${A.sec('Руками', 'сдвинуть сейчас')}
        <div class="lf-chips wrap">${NUDGE.map(([k, l]) => `<button class="lf-chip" data-bact="nudge" data-k="${k}" data-who="${esc(who)}">${l}</button>`).join('')}<button class="lf-chip" data-bact="rest" data-who="${esc(who)}">дать выспаться</button></div>
        ${temperHtml(who, t)}
        <label class="lf-switch"><input type="checkbox" data-bin="on" data-who="${esc(who)}" checked><span></span>${W}: код-мозг включён</label>
    </div>`;
}

function pickDefault(all) {
    const here = present();
    return all.find(n => mine(n) && inScene(n, here) && here.length) || all.find(mine) || all[0];
}

function bodyHtml() {
    if (!A?.hasChat?.()) return '';
    const all = mains();
    if (!all.length) return '<div class="lf-empty small">В этом чате нет персонажей, кроме твоей героини.</div>';
    if (!sel || !all.some(n => A.sameName(n, sel))) sel = pickDefault(all);
    const c = cfg();
    const sw = (k, text) => `<label class="lf-switch"><input type="checkbox" data-bin="g" data-k="${k}" ${c[k] !== false ? 'checked' : ''}><span></span>${text}</label>`;
    return `${all.length > 1 ? `<div class="brn-tabs">${all.map(n => `<button class="brn-tab${A.sameName(n, sel) ? ' on' : ''}" data-bact="sel" data-who="${esc(n)}">${mine(n) ? auraHtml(n, 'sm') : A.ava(n, 'sm')}<small>${esc(short(n))}</small></button>`).join('')}</div>` : ''}
        ${cardHtml(sel)}
        <details class="lf-more brn-more" ${det('g')}><summary>Настройки мозга</summary>
            ${sw('on', 'Мозг включён')}
            ${sw('drive', 'Вести состояние персонажа во «Внутри» Life (лица, чипы, соседние трекеры видят то же)')}
            ${sw('brk', 'Срывы: когда накопилось и держать нечем')}
            ${sw('aura', 'Ауры в Сцене')}
            ${sw('auto', 'Сам собирать темперамент по карточке и лорбуку')}
            <div class="lf-hint">Мозг ${VERSION}. Летописец после каждого ответа называет, что случилось с человеком; оси, волю, напряжение и несказанное считает код, время — по Horae. Модель получает кассету — без цифр.${A.senses ? '' : ' Life старой версии: раны, недосып и Камни мозг пока не видит — обнови Life.'}</div>
        </details>`;
}

/** Блок на странице персонажа (Жизнь → Психика). */
function mindHtml(who) {
    if (!on() || !mains().some(n => A.sameName(n, who))) return '';
    if (!mine(who)) return '';
    const v = view(who);
    return `${A.sec('Код-мозг', domLabel(v.dom))}
        <button class="brn-mind" data-bact="open" data-who="${esc(A.canonName(who))}">${auraHtml(who, 'sm', v)}<span><b>${esc(v.s.brk ? 'срыв' : domLabel(v.dom))}</b><small>воля ${Math.round(v.s.will)} · напряжение ${Math.round(v.s.strain)} — открыть</small></span></button>`;
}

function trackerState() {
    if (!on()) return '';
    const vs = list().map(view);
    if (vs.some(v => v.s.brk)) return 'срыв';
    const hot = vs.filter(v => NEG.includes(v.dom.id)).sort((a, b) => b.dom.lvl - a.dom.lvl)[0];
    return hot ? domLabel(hot.dom) : '';
}

function refresh() {
    for (const el of document.querySelectorAll('.brn-body')) {
        if (el.contains(document.activeElement) && /TEXTAREA/.test(document.activeElement?.tagName || '')) continue;
        el.innerHTML = bodyHtml();
    }
    safe(() => A.render?.());
}

function openBrain(who) {
    if (who) sel = A.canonName(who);
    if (A.shelf?.open) { A.shelf.open(ID); return; }
    A.openSheet(TITLE, `<div class="brn-body">${bodyHtml()}</div>`);
}

// ───────────── ручные правки ─────────────

/** Одна ручная правка поверх состояния. */
function applyOp(s, t, op) {
    const mes = A.chatArr().length - 1;
    if (!s.at) s.at = nowStamp();
    if (op.act === 'nudge' && KIND_NAME[op.k]) {
        const d = P.hit(s, { [op.k]: 2 }, t);
        log(s, { mes, src: 'hand', why: 'руками', hits: { [op.k]: 2 }, d });
        s.why = { t: '', mes, neg: P.NEGATIVE.includes(op.k) };
    }
    if (op.act === 'rest') {
        s.will = P.clamp(s.will + 40, 0, 100);
        s.strain = P.clamp(s.strain - 30, 0, 100);
        if (s.night) s.night.bad = false;
        log(s, { mes, src: 'hand', why: 'отдых: воля +40, напряжение −30' });
    }
    if (op.act === 'reset') Object.assign(s, P.fresh(t), { at: nowStamp(), night: null, why: null, belBroke: null });
    if (op.act === 'unbrk' && s.brk) {
        s.brk = null;
        s.strain = Math.min(s.strain, 70);
        s.will = Math.max(s.will, 30);
        log(s, { mes, src: 'hand', why: 'срыв отменён руками' });
    }
}

/** Правка руками. Запоминается до следующего поста: свайп последнего ответа пересчитает его и наложит её заново. */
function manual(who, op) {
    const name = A.canonName(who);
    const m = M();
    applyOp(stateOf(name), temperOf(name), op);
    if (!Array.isArray(m.ops)) m.ops = [];
    m.ops.push({ i: A.chatArr().length - 1, who: name, ...op });
    if (m.ops.length > 40) m.ops.splice(0, m.ops.length - 40);
    const v = view(name);
    drive(name, v.dom, v.s, '', A.chatArr().length - 1);
    saveM();
    safe(() => A.updatePrompt());
}

async function onClick(ev) {
    const el = ev.target?.closest?.('[data-bact]');
    if (!el || !A) return;
    ev.preventDefault();
    ev.stopPropagation();
    const act = el.dataset.bact;
    const who = el.dataset.who || sel;
    try {
        if (act === 'open') { openBrain(who); return; }
        if (act === 'sel') sel = A.canonName(who);
        if (act === 'nudge' && KIND_NAME[el.dataset.k]) manual(who, { act: 'nudge', k: el.dataset.k });
        if (act === 'rest') manual(who, { act: 'rest' });
        if (act === 'reset') manual(who, { act: 'reset' });
        if (act === 'unbrk') { cancelBreak(who); return; }
        if (act === 'collect') {
            const run = async () => { await collect(who); };
            if (A.withBusy) await A.withBusy(el, run, 'Читаю…'); else await run();
            A.toast('success', `${esc(short(who))}: темперамент и кассеты собраны.`, TITLE, { timeOut: 2500 });
            safe(() => A.updatePrompt());
        }
    } catch (e) {
        console.warn('[Мозг]', e);
        A.toast('warning', esc(String(e?.message || e)), TITLE);
    }
    refresh();
}

function onToggle(ev) {
    const k = ev.target?.dataset?.bd;
    if (!k) return;
    if (ev.target.open) openSet.add(k); else openSet.delete(k);
}

function onInput(ev) {
    const el = ev.target;
    if (el?.dataset?.bin !== 't') return;
    const out = el.closest('.brn-rng')?.querySelector('[data-out]');
    if (out) out.textContent = el.value;
}

const linesOf = (v) => String(v || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
/** «16.12 — что это (вина)» → { md: '12-16', t, kind } */
function parseDateLine(line) {
    const m = String(line).match(/^(\d{1,2})[.\/-](\d{1,2})\s*[—–:-]?\s*(.+)$/);
    if (!m) return null;
    const blow = /\((вина|стыд)\)|вин[аы]|стыд|убил|убий|предал/i.test(m[3]);
    return { md: `${m[2]}-${m[1]}`, t: m[3].replace(/\s*\((вина|стыд|утрата)\)\s*$/i, '').trim(), kind: blow ? 'blow' : 'loss' };
}

function onChange(ev) {
    const el = ev.target;
    const kind = el?.dataset?.bin;
    if (!kind || !A) return;
    ev.stopPropagation();
    const who = el.dataset.who || sel;
    const k = el.dataset.k || '';
    try {
        if (kind === 'g') { cfg()[k] = !!el.checked; saveCfg(); }
        if (kind === 'on') editTemper(who, (t) => { t.on = !!el.checked; });
        if (kind === 't') {
            const [a, b] = k.split('.');
            const val = Number(el.value);
            const old = temperOf(who);
            const t = editTemper(who, (x) => { if (b) x[a][b] = val; else x[a] = val; x.src = 'hand'; });
            if (a === 'base') { const s = stateOf(who); s.base[b] = P.clamp(s.base[b] + (t.base[b] - old.base[b]), -100, 100); saveM(); }
        }
        if (kind === 'c') {
            editTemper(who, (t) => {
                if (SINGLES.includes(k)) t.cass[k] = str(String(el.value || '').replace(/\s+/g, ' '), 320);
                else if (P.EMO_STEPS[k]) {
                    // правится одна ступень; пустая — вернётся запасная кассета
                    const rows = Array.from({ length: P.EMO_STEPS[k] }, (_, n) => (Array.isArray(t.cass[k]) ? String(t.cass[k][n] || '') : ''));
                    const n = Math.round(P.clamp(el.dataset.n, 0, P.EMO_STEPS[k] - 1));
                    rows[n] = str(String(el.value || '').replace(/\s+/g, ' '), 260);
                    t.cass[k] = rows;
                }
                t.src = 'hand';
            });
        }
        if (kind === 'f') editTemper(who, (t) => { t.fix = linesOf(el.value); t.src = 'hand'; });
        if (kind === 'b') {
            editTemper(who, (t) => {
                t.beliefs = linesOf(el.value).map(line => { const [a, b] = line.split(/\s*(?:=>|→|->)\s*/); return { t: str(a, 90), truth: str(b || '', 140) }; }).filter(x => x.t);
                t.src = 'hand';
            });
            cfg().prof[keyOf(who)] = P.normTemper(cfg().prof[keyOf(who)]);   // ключи убеждений — по тексту
            saveCfg();
        }
        if (kind === 'd') editTemper(who, (t) => { t.dates = linesOf(el.value).map(parseDateLine).filter(Boolean); t.src = 'hand'; });
    } catch (e) { console.warn('[Мозг] поле', e); }
    safe(() => A.updatePrompt());
    if (el.tagName !== 'TEXTAREA') refresh();
}

// ───────────── что записал пост ─────────────

function recs(i) {
    if (!A || !on()) return [];
    const m = M();
    const out = [];
    for (const [name, s] of Object.entries(m.who)) {
        for (const e of (s?.log || []).filter(x => x.mes === i && x.src !== 'hand')) {
            const kinds = e.hits ? Object.entries(e.hits).map(([k, n]) => `${KIND_NAME[k]} ${n}`).join(', ') : '';
            out.push({
                id: `brn-${name}-${e.src}`, g: 'Психика', icon: 'activity', t: `${short(name)}: ${[kinds, e.why].filter(Boolean).join(' — ')}`,
                del: m.snap?.i === i ? () => { try { m.who = JSON.parse(m.snap.data); } catch { /* */ } m.snap = null; saveM(); safe(() => A.updatePrompt()); } : null,
            });
        }
    }
    return out;
}

// ───────────── старт ─────────────

function boot(tries = 0) {
    const B = globalThis.LifeBridge;
    if (!B?.register) {
        if (tries < 240) setTimeout(() => boot(tries + 1), 500);
        else console.warn('[Мозг] Life не найден — мозгу не к чему подключиться');
        return;
    }
    const ok = B.register({
        id: ID,
        init: (api) => { A = api; },
        prompt: (type) => safe(() => prompt(type), ''),
        chron: () => safe(() => chron(), null),
        afterPost: (i, j, msg) => { try { afterPost(i, j, msg); } catch (e) { console.warn('[Мозг] после поста', e); } },
        sceneHtml: () => safe(() => sceneHtml(), ''),
    });
    if (!ok || !A) { console.warn('[Мозг] мост Life не принял модуль'); return; }
    safe(() => A.shelf?.tracker?.({
        id: ID, ico: '🧠', name: 'Мозг', on: () => cfg().on !== false,
        hint: 'Психику персонажей считает код: Летописец называет, что случилось, а оси, воля, напряжение и несказанное — математика. Модель получает кассету — как именно он ведёт себя сейчас.',
        state: () => safe(() => trackerState(), ''), html: () => `<div class="brn-body">${safe(() => bodyHtml(), '')}</div>`,
    }));
    safe(() => A.shelf?.mind?.((who) => safe(() => mindHtml(who), '')));
    safe(() => A.shelf?.recs?.((i) => safe(() => recs(i), [])));
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('toggle', onToggle, true);
    try {
        const { eventSource, eventTypes: E } = ctx();
        eventSource.on(E.CHAT_CHANGED, () => { sel = ''; spends.length = 0; setTimeout(() => ensure().catch(() => {}), 9000); });
    } catch (e) { console.warn('[Мозг] события таверны', e); }
    setTimeout(() => ensure().catch(() => {}), 12000);
    console.info(`[Мозг] ${VERSION} — подключён к Life ${B.version || ''}${A.senses ? '' : ' (без органов чувств: Life старой версии)'}`);
}

// Соседям и самому Life: что сейчас с человеком. Life спрашивает мозг в нескольких местах; нет мозга — всё как раньше.
globalThis.LifeBrain = {
    version: VERSION,
    /** Состояние во «Внутри» ведёт мозг — Life не шлёт вторую заметку о нём. */
    owns: (who) => safe(() => on() && cfg().drive !== false && mine(who), false),
    list: () => safe(() => (on() ? list() : []), []),
    /** { E: оси, emo: { id, step, lvl, name }, will, strain, mask, leak, brk, hang } или null */
    view: (who) => safe(() => {
        if (!on() || !mine(who)) return null;
        const v = view(who);
        return { E: v.E, emo: { id: v.dom.id, step: v.dom.step, lvl: v.dom.lvl, name: domLabel(v.dom) }, will: Math.round(v.s.will), strain: Math.round(v.s.strain), mask: Math.round(v.s.mask), leak: P.leakOf(v.s, v.sig.loose), brk: !!v.s.brk, hang: !!v.s.hang };
    }, null),
    /** Нервы сырые — сработавший триггер бьёт на ступень сильнее (triggers.js). */
    raw: (who) => safe(() => on() && mine(who) && P.rawNerves(view(who).s), false),
    /** Множитель того, как быстро тает терпение (bicker.js); 0 — мозг молчит. */
    edge: (who) => safe(() => { if (!on() || !mine(who)) return 0; const v = view(who); return P.edgeOf(v.s, v.dom); }, 0),
    /** Хватит ли его на шаг по своей инициативе (sim.js): { ok, cost, why, safe, bold } или null. */
    afford: (who, kind) => safe(() => {
        if (!on() || !mine(who)) return null;
        const v = view(who);
        return { ...P.afford(v.s, v.dom, kind, initCtx(who, v)), safe: SAFE[kind] || '' };
    }, null),
    /** Шаг сделан в посте i — воля спишется, когда мозг дочитает этот пост. */
    spend: (who, kind, i) => { safe(() => { if (on() && mine(who)) spends.push({ who: A.canonName(who), kind: String(kind || ''), i: Number(i) }); }); },
    /** «Языки»: дошло ли до ступени, где срывается на свой язык, — слово или ''. */
    tongue: (who) => safe(() => (on() && mine(who) ? tongueOf(who) : ''), ''),
    /** Твисты и драма: что на самом деле назрело в сцене — строка или ''. */
    ripe: () => safe(() => (on() ? ripeOf() : ''), ''),
    /** «Стук в сцену»: кто соскучился — [{ id, who, how, why }]. */
    miss: () => safe(() => (on() ? missOf() : []), []),
    /** Была ли у него сегодня плохая ночь. */
    night: (who) => safe(() => { if (!on() || !mine(who)) return false; const s = stateOf(who); return !!s.night?.bad && s.night.day === nowStamp().day; }, false),
    open: (who) => safe(() => openBrain(who)),
};

if (typeof jQuery === 'function') jQuery(() => boot()); else boot();
