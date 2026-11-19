// ✦ Мозг — код-мозг персонажей для SillyTavern. Отдельное расширение рядом с Life (подключается через его мост).
// Нейронка читает и пишет, код помнит и считает: Летописец Life после поста называет, ЧТО случилось с каждым
// («удар по самооценке 2», «угроза 3», «сдержался 1»), а психику считает ядро (core/psyche.js) — четыре оси
// в три слоя, воля, напряжение, срыв. Тело берётся у трекеров Life (раны, недосып, голод, Камни, терпение).
// Модель получает не цифры, а кассету: как ИМЕННО ЭТОТ человек ведёт себя на этой ступени чувства.
// Ядро не знает ни про Таверну, ни про Life — оно переедет под свою модель как есть.

import * as P from './core/psyche.js';
import { EMO_NAME, EMO_TITLE, EMO_ICON, WILL_TEXT, WILL_NAME, cassOf, cassText, cassLines, cleanCass } from './core/cassettes.js';

const VERSION = '0.1.0';
const ID = 'brain';
const TITLE = '🧠 Мозг';
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const NEG = ['fear', 'anger', 'shame', 'low'];
const SEV = ['', 'лёгкая', 'средняя', 'тяжёлая', 'критическая'];
const KIND_NAME = { warm: 'тепло', fun: 'веселье', win: 'победа', calm: 'покой', threat: 'угроза', blow: 'удар по самооценке', bound: 'потеря контроля', wrong: 'несправедливость', loss: 'утрата', held: 'сдержался' };
const AX_NAME = { val: ['мрак', 'тепло'], aro: ['пусто', 'заряд'], ctl: ['бессилие', 'контроль'], wor: ['стыд', 'самоценность'] };
const D_NAME = { val: 'тепло', aro: 'заряд', ctl: 'контроль', wor: 'самоценность', will: 'воля', strain: 'напряжение' };
// какое состояние из «Внутри» Life соответствует ведущей эмоции
const INNER = { fear: 'restless', anger: 'irritated', shame: 'thoughtful', low: 'sad', tender: 'good', playful: 'playful' };
// по какой оси видно, вспышка это или уже настроение
const MAIN_AX = { fear: 'ctl', anger: 'val', shame: 'wor', low: 'val' };
const NUDGE = [['warm', 'обогреть'], ['fun', 'рассмешить'], ['calm', 'успокоить'], ['win', 'дать победить'], ['threat', 'напугать'], ['blow', 'задеть'], ['bound', 'прижать'], ['wrong', 'разозлить'], ['loss', 'оставить в одиночестве']];

let A = null;     // LifeBridge.api
let sel = '';     // чья карточка открыта
const openSet = new Set();   // какие «подробнее» раскрыты — чтобы перерисовка их не захлопывала
const det = (k) => `data-bd="${k}"${openSet.has(k) ? ' open' : ''}`;

const ctx = () => (A ? A.ctx() : globalThis.SillyTavern.getContext());
const esc = (v) => (A ? A.esc(v) : String(v ?? ''));
const str = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
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

/** Состояние мозга в этом чате: { who: { имя: состояние }, snap } */
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

/** Что давит на него прямо сейчас помимо событий: сдвиги осей, приток напряжения, потолок и скорость воли. */
function signals(who) {
    const S = A.senses || {};
    const off = { val: 0, aro: 0, ctl: 0, wor: 0 };
    const out = { off, strainIn: 0, willMul: 1, willCap: 100, raw: 1, sleepQ: 1, list: [] };
    const add = (id, text, o = {}) => { for (const a of P.AXES) off[a] += o[a] || 0; out.list.push({ id, text }); };
    const pain = P.clamp(safe(() => S.hurt?.(who)?.lvl, 0), 0, 4);
    if (pain > 0) {
        add('pain', `рана (${SEV[pain]})`, { val: -5 * pain, ctl: -3 * pain, aro: 2 * pain });
        out.strainIn += 0.67 * pain;
        out.willCap = Math.min(out.willCap, 100 - 10 * pain);
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
        }
        const up = P.clamp(safe(() => S.hurt?.(U)?.lvl, 0), 0, 4);
        if (up >= 2) { add('worry2', `тревога (${short(U)}): рана`, { aro: 4 * up, ctl: -3 * up, val: -2 * up }); out.strainIn += 0.3 * up; }
    }
    const pt = safe(() => S.patience?.(), null);
    if (pt && A.sameName(pt.who, who) && num(pt.pat, 100) < 40) {
        const low = pt.pat < 20;
        add('pat', `терпение на исходе (${Math.round(pt.pat)})`, { val: low ? -10 : -6, aro: 4 });
        out.strainIn += low ? 0.5 : 0.25;
    }
    return out;
}

/** Каким он будет прямо сейчас: состояние, доведённое до текущего момента истории (само состояние не трогает). */
function view(who) {
    const t = temperOf(who);
    const sig = signals(who);
    const s = clone(stateOf(who));
    if (s.at) P.decay(s, hoursBetween(s.at, nowStamp()), t, { strainIn: sig.strainIn, willMul: sig.willMul, willCap: sig.willCap });
    else s.will = Math.min(s.will, sig.willCap);
    const E = P.eff(s, sig.off);
    return { who, t, s, sig, E, dom: P.dominant(E, s.base) };
}

const domLabel = (dom) => (dom?.id ? EMO_NAME[dom.id][dom.step - 1] : 'ровно');

// ───────────── Летописец ─────────────

const RULE = `
psy — что этот пост (и пост игрока перед ним) сделал с ВНУТРЕННИМ состоянием персонажей из строки «Психика»: [{"who":"имя","blow":2,"held":1,"why":"из-за чего, 3–10 слов"}]. Только те, с кем что-то случилось; ни с кем — []. В строке — только ненулевые шкалы, каждая от 1 до 3 (1 — слегка, 2 — заметно, 3 — по-настоящему сильно; 3 ставь редко): warm — ему дали тепло, поддержку, нежность, признание; fun — смех, игра, флирт, азарт; win — справился, защитил, его послушали, получилось; calm — отдых, покой, безопасность, отпустило; threat — угроза ему или тем, кто ему дорог, опасность; blow — удар по самооценке: унизили, обесценили, пристыдили, напомнили о худшем в нём, сам себя винит; bound — потерял контроль: решили за него, скован, беспомощен, лишён выбора; wrong — с ним обошлись несправедливо, соврали, перешли границу, задели близкого; loss — утрата, разлука, отвергли, одиночество; held — сдержался: проглотил, промолчал, удержал лицо, хотя внутри кипело. Оценивай то, что случилось С НИМ, а не то, как он это показал: спокойное лицо после оскорбления — это blow и held. Обычный разговор без такого — не пиши ничего.`;

function chron() {
    if (!on()) return null;
    const who = list();
    if (!who.length) return null;
    const cur = who.map(n => { const v = view(n); return `${n} — ${v.dom.id ? `${domLabel(v.dom)} (${v.dom.step} из ${P.EMO_STEPS[v.dom.id]})` : 'ровно'}`; });
    return { key: '"psy": []', rule: RULE, tokens: 50 + who.length * 45, input: `Психика (оцени, что с ними случилось в этих постах): ${cur.join('; ')}` };
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
        const sig = signals(who);
        const there = inScene(who, here);
        // время: вспышки гаснут, настроение оседает, воля возвращается, напряжение идёт к равновесию
        const nights = s.at?.day && n.day && s.at.day !== n.day ? 1 : 0;
        P.decay(s, s.at ? hoursBetween(s.at, n) : 0, t, { strainIn: sig.strainIn, willMul: sig.willMul, willCap: sig.willCap, nights, sleepQ: sig.sleepQ });
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
        }
        if (Object.keys(hits).length) {
            const d = P.hit(s, hits, t, { raw: sig.raw });
            const neg = Object.keys(hits).some(k => P.NEGATIVE.includes(k));
            log(s, { mes: i, src: 'post', why, hits, d });
            if (why) s.why = { t: why, mes: i, neg };
        }
        const E = P.eff(s, sig.off);
        const dom = P.dominant(E, s.base);
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
        drive(who, last, s, s.why && i - s.why.mes <= 6 ? s.why.t : '', i);
    }
    saveM();
    safe(() => A.saveMeta?.());
}

function cancelBreak(who) {
    if (!stateOf(who).brk) return;
    manual(who, { act: 'unbrk' });
    refresh();
}

// ───────────── заметка модели ─────────────

function note(who) {
    const v = view(who);
    const { s, t, dom } = v;
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
    const band = P.willBand(s.will);
    const will = WILL_TEXT[band];
    if (!bits.length && !will) return '';
    const neg = NEG.includes(dom.id);
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

// ───────────── темперамент из карточки и лорбука ─────────────

const COLLECT_SYS = `Ты настраиваешь «код-мозг» персонажа ролевой истории: его психику дальше считает программа, а не модель. По карточке, ядру характера и записям лорбука выпиши ТЕМПЕРАМЕНТ и КАССЕТЫ ПОВЕДЕНИЯ. Ответь только одним JSON по-русски:
{"note":"1–2 предложения: что у него за психика, главное","base":{"val":0,"aro":0,"ctl":0,"wor":0},"react":1,"recover":1,"grit":1,"sens":{"warm":1,"threat":1,"blow":1,"bound":1,"wrong":1,"loss":1},"cass":{"fear":["","","",""],"anger":["","","",""],"shame":["","","",""],"low":["","",""],"tender":["","",""],"playful":["",""],"brk":"","hang":""}}
base — его обычное состояние в спокойный день, каждая ось от −30 до 30 (0 — обычный человек): val — мрачность (минус) или тепло (плюс); aro — вялость (минус) или взведённость (плюс); ctl — чувство беспомощности (минус) или контроля над собой и ситуацией (плюс; у обученных бойцов и лидеров 20–30); wor — стыд и вина за себя (минус) или самоуважение (плюс).
react — как сильно его задевают события: 0.7 толстокожий, 1 обычный, 1.4 оголённый нерв. recover — как быстро отходит: 0.6 долго носит в себе, 1 обычно, 1.6 отходчивый. grit — запас воли держать лицо и делать трудное: 0.7 мало, 1 обычно, 1.6 железная выдержка.
sens — больные места, множитель от 0.6 до 1.5 (1 — как у всех; 1.5 — редкость, только для главной раны): warm — насколько на него действует тепло и похвала (ниже 1, если не верит хорошему о себе); threat — угроза и опасность; blow — удары по самооценке, стыд, напоминание о худшем в нём; bound — потеря контроля: решают за него, фиксируют, лишают выбора; wrong — несправедливость, ложь, задели близкого; loss — утрата, разлука, отвержение.
Не преувеличивай: тяжёлое прошлое не значит, что он всё время на грани. Взрослый человек, который живёт с этим годами, в обычный день держится ровно.
cass — кассеты: КАК ИМЕННО ОН ведёт себя на каждой ступени чувства, от слабой к сильной (fear — страх, anger — злость, shame — стыд и вина: по 4 ступени; low — тоска, tender — нежность: по 3; playful — кураж: 2). Каждая строка 10–28 слов: конкретные жесты, речь, привычки, что делает руками и голосом, куда уходит — ЕГО, из карточки и лорбука, а не «человек вообще». Ступени различаются и нарастают; сильная ступень — не истерика, если он не такой. brk — как выглядит ЕГО срыв, когда запас кончился (1–2 предложения). hang — каким он бывает после срыва. Настоящее время, без имени в начале, без слова «ступень» и без цифр.`;

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
    const j = await A.askJson([{ role: 'system', content: COLLECT_SYS }, { role: 'user', content: usr }], 2800, { check: (x) => !!x && typeof x === 'object' && (!!x.cass || !!x.base), what: 'Темперамент' });
    const old = temperOf(name);
    const t = editTemper(name, (x) => {
        for (const a of P.AXES) x.base[a] = Math.round(P.clamp(j.base?.[a] ?? x.base[a], -30, 30));
        x.react = P.clamp(j.react ?? 1, 0.7, 1.4);
        x.recover = P.clamp(j.recover ?? 1, 0.6, 1.6);
        x.grit = P.clamp(j.grit ?? 1, 0.7, 1.6);
        for (const k of Object.keys(x.sens)) x.sens[k] = P.clamp(j.sens?.[k] ?? 1, 0.6, 1.5);
        const cass = cleanCass(j.cass);
        if (Object.keys(cass).length) x.cass = { ...x.cass, ...cass };
        x.note = str(j.note, 400);
        x.src = 'lore';
    });
    // характер в этом чате сдвигается вместе с темпераментом (накопленный дрейф остаётся)
    const s = stateOf(name);
    for (const a of P.AXES) s.base[a] = P.clamp(s.base[a] + (t.base[a] - old.base[a]), -100, 100);
    saveM();
    return t;
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
    return Object.entries(d).filter(([, x]) => Math.abs(x) >= 2).map(([k, x]) => `${D_NAME[k]} ${x > 0 ? '+' : '−'}${Math.abs(x)}`).join(', ');
}
function logRow(e) {
    const kinds = e.hits ? Object.entries(e.hits).map(([k, n]) => `${KIND_NAME[k]} ${n}`).join(', ') : '';
    const head = e.src === 'brk' ? '⚡' : e.src === 'hand' ? '✋' : `#${e.mes}`;
    return `<div class="brn-log"><span>${head}</span><div><b>${esc(kinds || e.why || '')}</b>${kinds && e.why ? `<small>${esc(e.why)}</small>` : ''}${e.d ? `<small class="d">${esc(deltaText(e.d))}</small>` : ''}</div></div>`;
}

const range = (who, k, val, min, max, step, label, hint = '') => `<div class="brn-rng"><label>${label}<b data-out>${val}</b></label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-bin="t" data-k="${k}" data-who="${esc(who)}">${hint ? `<small>${hint}</small>` : ''}</div>`;

function temperHtml(who, t) {
    const srcName = { auto: 'обычный человек — ещё не собран', lore: 'собран по карточке и лорбуку', hand: 'поправлен руками' }[t.src];
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
        ${A.sec('Кассеты', 'от слабой ступени к сильной')}
        ${P.EMOS.map(id => `<div class="lf-field brn-cass"><label>${EMO_ICON[id]} ${EMO_TITLE[id]}</label>${cassLines(t, id).map((line, n) => `<div class="brn-cs"><span>${n + 1}</span><textarea rows="3" data-bin="c" data-k="${id}" data-n="${n}" data-who="${esc(who)}">${esc(line)}</textarea></div>`).join('')}</div>`).join('')}
        <div class="lf-field"><label>⚡ Срыв</label><textarea rows="3" data-bin="c" data-k="brk" data-who="${esc(who)}">${esc(cassText(t, 'brk'))}</textarea></div>
        <div class="lf-field"><label>🌫 После срыва</label><textarea rows="3" data-bin="c" data-k="hang" data-who="${esc(who)}">${esc(cassText(t, 'hang'))}</textarea></div>
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
    const logs = s.log.slice(-7).reverse();
    return `<div class="brn-card${s.brk ? ' brk' : ''}">
        <div class="brn-top">${auraHtml(who, 'md', v)}<div><b>${s.brk ? '⚡' : EMO_ICON[dom.id] || ''} ${esc(cap(title))}</b>${steps}<small>${esc(sub)}</small></div></div>
        ${s.brk ? `<div class="brn-warn">В следующем ответе это прорвётся.${s.brk.why ? ` Последняя капля: ${esc(s.brk.why)}.` : ''}<button class="lf-btn small" data-bact="unbrk" data-who="${esc(who)}">отменить срыв</button></div>` : ''}
        ${s.hang && !s.brk ? '<div class="brn-warn soft">После срыва: сил на маску нет, плохое бьёт больнее обычного.</div>' : ''}
        <div class="brn-axes">${P.AXES.map(a => axisRow(a, v)).join('')}</div>
        <div class="brn-two">${bar('Воля', s.will, `will b${band}`, WILL_NAME[band])}${bar('Напряжение', s.strain, `strain${s.strain >= 75 ? ' hot' : ''}`, s.strain >= 75 ? 'сырые нервы' : s.strain >= 50 ? 'копится' : '')}</div>
        ${A.sec('Почему так')}
        ${sig.list.length ? `<div class="lf-chips wrap brn-sig">${sig.list.map(x => `<span class="lf-chip">${esc(x.text)}</span>`).join('')}</div>` : ''}
        ${logs.length ? `<div class="brn-logs">${logs.map(logRow).join('')}</div>` : `<div class="lf-hint">${sig.list.length ? '' : 'Пока ничего не случилось. '}События появятся после ответа: Летописец назовёт, что с ним произошло, а посчитает код.</div>`}
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
            <div class="lf-hint">Мозг ${VERSION}. Летописец после каждого ответа называет, что случилось с человеком; оси, волю и напряжение считает код, время — по Horae. Модель получает кассету — без цифр.${A.senses ? '' : ' Life старой версии: раны, недосып и Камни мозг пока не видит — обнови Life.'}</div>
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
        log(s, { mes, src: 'hand', why: 'отдых: воля +40, напряжение −30' });
    }
    if (op.act === 'reset') Object.assign(s, P.fresh(t), { at: nowStamp() });
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
                if (k === 'brk' || k === 'hang') t.cass[k] = str(el.value, 320);
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
        hint: 'Психику персонажей считает код: Летописец называет, что случилось, а оси, воля и напряжение — математика. Модель получает кассету — как именно он ведёт себя сейчас.',
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
        eventSource.on(E.CHAT_CHANGED, () => { sel = ''; setTimeout(() => ensure().catch(() => {}), 9000); });
    } catch (e) { console.warn('[Мозг] события таверны', e); }
    setTimeout(() => ensure().catch(() => {}), 12000);
    console.info(`[Мозг] ${VERSION} — подключён к Life ${B.version || ''}${A.senses ? '' : ' (без органов чувств: Life старой версии)'}`);
}

// Соседям и самому Life: что сейчас с человеком. Life спрашивает owns(), чтобы не слать вторую заметку о состоянии.
globalThis.LifeBrain = {
    version: VERSION,
    owns: (who) => safe(() => on() && cfg().drive !== false && mine(who), false),
    list: () => safe(() => (on() ? list() : []), []),
    /** { E: оси, emo: { id, step, lvl, name }, will, strain, brk, hang } или null */
    view: (who) => safe(() => {
        if (!on() || !mine(who)) return null;
        const v = view(who);
        return { E: v.E, emo: { id: v.dom.id, step: v.dom.step, lvl: v.dom.lvl, name: domLabel(v.dom) }, will: Math.round(v.s.will), strain: Math.round(v.s.strain), brk: !!v.s.brk, hang: !!v.s.hang };
    }, null),
    open: (who) => safe(() => openBrain(who)),
};

if (typeof jQuery === 'function') jQuery(() => boot()); else boot();
