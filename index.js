// ✦ Мозг — код-мозг персонажей для SillyTavern. Отдельное расширение рядом с Life (подключается через его мост).
// Нейронка читает и пишет, код помнит и считает: Летописец Life после поста называет, ЧТО случилось с каждым
// («удар по самооценке 2», «угроза 3», «сдержался 1»), а психику считает ядро (core/psyche.js) — четыре оси
// в три слоя, воля, напряжение, несказанное, срыв. Тело и нервы берутся у трекеров Life (раны, недосып, голод,
// Камни, терпение, триггеры, тайны, эффекты). Модель получает не цифры, а кассету: как ИМЕННО ЭТОТ человек
// ведёт себя на этой ступени чувства. Ядро не знает ни про Таверну, ни про Life — переедет под свою модель как есть.

import * as P from './core/psyche.js';
import { EMO_NAME, EMO_TITLE, EMO_ICON, WILL_TEXT, WILL_NAME, SINGLES, SINGLE_TITLE, BELIEF_NAME, cassOf, cassText, cassLines, cleanCass, beliefText } from './core/cassettes.js';
import { DRIVE_NAME, DRIVE_ICON, BAND_NAME, freshDrives, healDrives, driveHit, driveDecay, driveBand, combos } from './core/drives.js';
import { hints } from './core/hints.js';
import { SOFT, tie, pairStats, lens, haven, afterHurt, stayStyle, grudgeDecay } from './core/bonds.js';
import { STYLES, STYLE_IDS, styleId, styleLine, STYLE_EASE, STYLE_OBJECT, statusHabit, statusFlip, TROPES, TROPE_IDS, ROM_NAME, tropeLine, tropeMul, rejectOf, SPINE_KEYS, SPINE_NAME, hasSpine, spineLine } from './core/attach.js';
import { STAGE_NAME, stageOf, tolOf, drink, sober, boozeNow, DRUNK, HUNG, SEEN, SEEN_HUNG, playerTips } from './core/booze.js';

const VERSION = '0.9.0';
const ID = 'brain';
const TITLE = '🧠 Мозг';
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const NEG = ['fear', 'anger', 'shame', 'low'];
const SEV = ['', 'лёгкая', 'средняя', 'тяжёлая', 'критическая'];
const KIND_NAME = { warm: 'тепло', fun: 'веселье', win: 'победа', calm: 'покой', threat: 'угроза', blow: 'удар по самооценке', bound: 'потеря контроля', wrong: 'несправедливость', loss: 'утрата', rival: 'ревность', held: 'сдержался', open: 'открылся' };
const AX_NAME = { val: ['мрак', 'тепло'], aro: ['пусто', 'заряд'], ctl: ['бессилие', 'контроль'], wor: ['стыд', 'самоценность'] };
const D_NAME = { val: 'тепло', aro: 'заряд', ctl: 'контроль', wor: 'самоценность', will: 'воля', strain: 'напряжение', mask: 'несказанное', bond: 'близость', safe: 'безопасность', free: 'свобода', need: 'нужность', quiet: 'покой', novel: 'новизна' };
// чем было событие для человека, если ведущего чувства после него нет
const KIND_EMO = { threat: 'fear', bound: 'fear', wrong: 'anger', rival: 'anger', blow: 'shame', loss: 'low', warm: 'tender', open: 'tender', fun: 'playful', win: 'playful' };
// какое состояние из «Внутри» Life соответствует ведущей эмоции
const INNER = { fear: 'restless', anger: 'irritated', shame: 'thoughtful', low: 'sad', tender: 'good', playful: 'playful' };
// по какой оси видно, вспышка это или уже настроение
const MAIN_AX = { fear: 'ctl', anger: 'val', shame: 'wor', low: 'val' };
const NUDGE = [['warm', 'обогреть'], ['fun', 'рассмешить'], ['calm', 'успокоить'], ['win', 'дать победить'], ['open', 'дать выговориться'], ['threat', 'напугать'], ['blow', 'задеть'], ['bound', 'прижать'], ['wrong', 'разозлить'], ['loss', 'оставить в одиночестве']];
const LEAK_NAME = ['держит при себе', 'проступает', 'почти не держит'];
// механизмы, которые можно выключить по одному и посмотреть, что изменится
const MECH = [['status', 'Качели статуса', 'когда привычная уверенность слетает или тихий вдруг выпрямляется'], ['style', 'Как привязывается и тропы пар', 'у каждого свой способ привязываться, у пары — свой сценарий'], ['spine', 'Стержень', 'чего добивается по его мнению и что ему нужно на самом деле'], ['booze', 'Алкоголь и похмелье', 'стадии опьянения, близорукость, утро после'], ['lens', 'Линза привязанности', 'любовь размывает мелкое плохое, уход и соперник бьют больнее'], ['dom', 'Доминанта', 'чувство держится и стягивает в себя постороннее'], ['catch', 'Заражение', 'близкие в сцене тянут друг друга'], ['recall', 'Память с чувством', 'прежнее всплывает в тон и возвращает часть себя'], ['home', 'Погода дома', 'свои на нервах — всем тяжелее'], ['wit', 'Юмор', 'каким юмором шутит в этом состоянии'], ['seq', 'Сцена и отклик', 'после сильного события: сначала реакция, потом развилка, потом решение']];
const TAG_NAME = { drunk: 'спьяну — крупнее', trope: 'так у них заведено', blur: 'любовь размыла', glow: 'от своего теплее', deep: 'от своего — глубже и дольше', sour: 'накопилось — читает уколом', surprise: 'не ждал добра', haven: 'рядом свой — легче', pile: 'легло на то же чувство', forgive: 'больно, но ничего не меняет', grudge: 'осталась обида', cold: 'обида ещё держится' };
const WIT_TEXT = { aff: 'если шутит — тепло и на двоих: смешит, чтобы стать ближе', self: 'если шутит — иронией над тем, что плохо: это способ держаться, а не веселье', aggr: 'если шутит — с зубами: сарказм, колкость, смешно и больно сразу', def: 'если шутит — над собой и раньше, чем это сделают другие' };
// после сильного события ответ строится как «отклик» (Дуайт Суэйн: реакция → дилемма → решение), а сама реакция —
// в порядке «чувство и тело → действие → слова». Иначе модель проживает и решает всё в одном посте
const SEQ_TEXT = [
    'только что случилось сильное — веди его реакцию по порядку: сначала тело и чувство, потом жест или движение и только потом слова; решений в этом ответе не принимает',
    'после сильного — развилка: хорошего выхода нет, пусть мечется между двумя плохими и ещё не выбирает',
    'после сильного — решение: сам выбирает, что делать дальше, и делает первый шаг — по этому выбору и видно, кто он',
];
// «свои» по умолчанию: у этих пятерых привязанность космическая (поправляется в листе, хранится в чате)
const SEED_CIRCLE = ['Хеди', 'Баки', 'Наташа', 'Тони', 'Елена'];
// как привязывается каждый из известных (предложение по умолчанию — правится в листе): способ, рана отвержения, как берёт алкоголь
const SEED_TEMPER = { 'Баки': { attach: 'guard', reject: 1.4, booze: 2.5 }, 'Наташа': { attach: 'armor', reject: 1.5 }, 'Тони': { attach: 'fix', reject: 1.2, booze: 1.4 }, 'Елена': { attach: 'test', reject: 1.5, booze: 1.3 }, 'Питер': { attach: 'serve', reject: 1.3, booze: 0.8 } };
// тропы пар по умолчанию: [кто, с кем, троп, романтика]
const SEED_PAIRS = [['Хеди', 'Баки', 'hybrid', 'yes'], ['Хеди', 'Наташа', 'hybrid', 'hint'], ['Хеди', 'Тони', 'kin', 'no'], ['Хеди', 'Елена', 'sisters', 'no'], ['Наташа', 'Елена', 'sisters', 'no'], ['Баки', 'Тони', 'truce', 'no'], ['Баки', 'Наташа', 'comrades', 'no'], ['Тони', 'Наташа', 'comrades', 'no'], ['Хеди', 'Питер', 'sibling', 'no']];
const TEMPER_V = 8;      // с какой версии в темпераменте есть способ привязываться, стержень и алкоголь
const PAIR_STAT = [['blur', 'Прощает'], ['haven', 'Гавань'], ['fuse', 'Ревность наготове'], ['dread', 'Страх потерять']];
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
    if (!c.mech || typeof c.mech !== 'object') c.mech = {};       // выключенные механизмы: { lens: false, … }
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

/**
 * Чат — в прошлом истории: эпоха ядра «Священный таймлайн» закрыта (у неё есть конец). Там отношения ещё только
 * складываются: в одной эпохе едва встретились, в другой один уже любит, а второй только начинает. Ядра нет или
 * чат вне мира — не прошлое. Снимок ядра помним полсекунды: круг спрашивают на каждом шагу.
 */
let eraMemo = { at: 0, past: false };
function pastEra() {
    if (Date.now() - eraMemo.at > 500) eraMemo = { at: Date.now(), past: safe(() => { const e = globalThis.SacredTimeline?.context?.()?.era; return !!(e && e.to); }, false) };
    return eraMemo.past;
}
const sameList = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
const nm = (v) => (A.norm ? A.norm(A.canonName(v)) : String(A.canonName(v) ?? '').toLowerCase().replace(/ё/g, 'е').trim());
const dirKey = (a, b) => `${nm(a)}>${nm(b)}`;   // как у Life (dirKey в index.js)
/** Снять свои замки (любовь и близость по сто), которые syncCircle поставил в этом чате. */
function unpinOwn(m) {
    for (const k of Array.isArray(m.circlePins) ? m.circlePins : []) {
        const [a, b] = String(k).split('>');
        if (!a || !b) continue;
        safe(() => {
            // только то, что всё ещё стоит на ста: замок, который она потом переставила руками, — уже её
            const pins = safe(() => A.chatMeta().relPin, null), p = pins?.[k];
            if (!p) return A.relUnpin ? A.relUnpin(a, b, ['love', 'closeness']) : false;   // замка под этим ключом не видно — пусть Life разберёт сам
            const mine = ['love', 'closeness'].filter(f => p[f] === 100);
            if (!mine.length) return false;
            if (A.relUnpin) return A.relUnpin(a, b, mine);
            for (const f of mine) delete p[f];
            if (!Object.keys(p).length) delete pins[k];
            return true;
        });
    }
    m.circlePins = [];
}

/**
 * Круг «своих» этого чата: между ними привязанность космическая — что бы ни случилось, она не меняется.
 * Первый раз заполняется сам, если в чате есть хотя бы двое из известной пятёрки, — но только в настоящем истории:
 * в чате прошлой эпохи круг сам не заполняется и ничего не запирает (впиши руками, если там уже так; одностороннее
 * «она любит, он только начинает» — замком шкалы на одну сторону в Life). Дальше — как поправишь.
 */
function circle() {
    const m = M();
    if (!Array.isArray(m.circle)) {
        const cast = [user(), ...safe(() => A.groupMembers().map(A.canonName), [])].filter(Boolean);
        const seed = !pastEra() && SEED_CIRCLE.filter(n => cast.some(c => A.sameName(c, n))).length >= 2;
        m.circle = seed ? [...SEED_CIRCLE] : [];
        m.circleAuto = seed;
    }
    // ядро назвало эпоху позже, чем круг заполнился сам (или его заполнила версия 0.7.0, не знавшая про эпохи)
    if (m.circle.length && pastEra() && (m.circleAuto === true || (m.circleAuto === undefined && sameList(m.circle, SEED_CIRCLE)))) {
        const legacy = m.circleAuto === undefined;
        unpinOwn(m);
        m.circle = [];
        m.circleAuto = false;
        // тропы пар сеялись вместе с кругом: нетронутые — убрать (они про настоящее), правленые руками — оставить
        if (Array.isArray(m.pairs) && m.pairs.length === SEED_PAIRS.length && m.pairs.every((x, k) => x && x.a === SEED_PAIRS[k][0] && x.b === SEED_PAIRS[k][1] && x.id === SEED_PAIRS[k][2] && x.rom === SEED_PAIRS[k][3])) m.pairs = [];
        relCache.clear();
        saveM(); safe(() => A.saveMeta?.()); safe(() => A.updatePrompt());
        // старая версия своих замков не помнила: снять их за неё нельзя — можно задеть поставленные руками
        if (legacy) safe(() => A.toast('info', 'Это чат прошлой эпохи: круг «своих» здесь сам не заполняется. Если любовь и близость уже заперты на 100 — сними лишние замки в «Персонаж → Связи».', '✦ Мозг', { timeOut: 9000 }));
    }
    return m.circle;
}
const inCircle = (n) => !!n && circle().some(x => A.sameName(x, n));
/** В Life «свои» получают любовь и близость по сто под замком — в обе стороны (только те, кто есть в этом чате). */
function syncCircle() {
    if (!A.relPin) return 0;
    const m = M();
    const cast = [user(), ...safe(() => A.groupMembers().map(A.canonName), [])].filter(n => n && !NARR.test(n) && inCircle(n));
    let n = 0;
    for (const a of cast) for (const b of cast) {
        if (A.sameName(a, b) || !safe(() => A.relPin(a, b, { love: 100, closeness: 100 }), false)) continue;
        n++;
        const k = dirKey(a, b);
        if (!Array.isArray(m.circlePins)) m.circlePins = [];
        if (!m.circlePins.includes(k)) m.circlePins.push(k);
    }
    if (n) { relCache.clear(); saveM(); safe(() => A.saveMeta?.()); safe(() => A.updatePrompt()); }
    return n;
}

/**
 * Тропы пар этого чата: [{ a, b, id, rom }] — по какому сценарию двое существуют вместе. Сеются вместе с кругом «своих».
 */
function pairs() {
    const m = M();
    // в чате прошлой эпохи тропы сами не сеются: там эти двое могли ещё и не встретиться
    if (!Array.isArray(m.pairs)) m.pairs = circle().length && !pastEra() ? SEED_PAIRS.map(([a, b, id, rom]) => ({ a, b, id, rom })) : [];
    return m.pairs;
}
const pairOf = (a, b) => (a && b ? pairs().find(p => (A.sameName(p.a, a) && A.sameName(p.b, b)) || (A.sameName(p.a, b) && A.sameName(p.b, a))) || null : null);
function setPair(a, b, patch) {
    const list = pairs();
    let p = pairOf(a, b);
    if (!p) { p = { a: A.canonName(a), b: A.canonName(b), id: '', rom: 'no' }; list.push(p); }
    Object.assign(p, patch);
    if (!TROPES[p.id]) list.splice(list.indexOf(p), 1);
    saveM();
}
// ───────────── персонаж игрока: мозг его не ведёт — только считает выпитое ─────────────
const meTol = () => P.clamp(cfg().meBooze ?? 1, 0.4, 6);
function meLive() {
    const m = M();
    if (!m.me || typeof m.me !== 'object') m.me = { bac: 0, bacPeak: 0, hung: null, blank: false, drankAt: null, at: null };
    return m.me;
}
/** Что с персонажем игрока прямо сейчас: { s, stage, hung, blank } или null — ни хмеля, ни похмелья. */
function meNow() {
    if (!on() || !mech('booze') || !M().me) return null;
    const s = clone(M().me);
    if (s.at) sober(s, hoursBetween(s.at, nowStamp()), meTol());
    const stage = stageOf(s.bac);
    const hung = s.hung ? Math.round(P.clamp(s.hung.lvl, 1, 2)) : 0;
    return stage || hung ? { s, stage, hung, blank: !!s.blank } : null;
}
/** Пост прошёл: время трезвит, Летописец называет, сколько выпито. */
function mePost(i, rows, n) {
    if (!mech('booze')) return;
    const U = user();
    const dn = U ? Math.max(0, ...rows.filter(r => r && A.sameName(r.who, U)).map(r => Math.round(P.clamp(r.drink, 0, 3)))) : 0;
    if (!dn && !M().me) return;
    const s = meLive();
    if (s.at) sober(s, hoursBetween(s.at, n), meTol());
    s.at = n;
    if (dn) {
        const again = s.drankAt != null && i - s.drankAt <= 2;
        drink(s, dn, meTol(), again ? [1, 0.4, 0.7, 1][dn] : 1);
        s.drankAt = i;
    }
}
/** Руками: налить или протрезвить. Снимок свайпа обновляем, чтобы правка не откатилась. */
function meHand(act) {
    const s = meLive();
    const n = nowStamp();
    if (s.at) sober(s, hoursBetween(s.at, n), meTol());
    s.at = n;
    if (act === 'drink') drink(s, 2, meTol());
    else Object.assign(s, { bac: 0, bacPeak: 0, hung: null, blank: false, drankAt: null });
    const m = M();
    if (m.snap) m.snap.me = JSON.stringify(m.me ?? null);
    saveM();
    safe(() => A.updatePrompt());
}
/** Строка модели: только то, что видно со стороны. Что персонаж игрока делает и чувствует — решает игрок. */
function meLine(here) {
    const me = meNow();
    const U = short(user());
    if (!me || !U || !inScene(user(), here)) return '';
    const what = me.stage ? `${STAGE_NAME[me.stage]}; со стороны видно: ${SEEN[me.stage]}` : `${me.hung === 2 ? 'тяжёлое похмелье' : 'с похмелья'}; со стороны видно: ${SEEN_HUNG[me.hung]}`;
    return `[${U}, персонаж игрока, — ${what} (считает Life по выпитому в истории). Что ${U} делает, говорит и чувствует — решает игрок, за игрока не пиши; остальные это замечают и откликаются каждый по-своему.]`;
}

/** Известным персонажам — способ привязываться по умолчанию (один раз; дальше — как поправишь). */
function seedTemper(who) {
    const k = keyOf(who);
    const raw = cfg().prof[k];
    if (raw?.seeded) return;
    const hit = Object.entries(SEED_TEMPER).find(([n]) => A.sameName(n, who));
    if (!hit) return;
    editTemper(who, (t) => {
        if (!t.attach) t.attach = hit[1].attach;
        if (t.reject === 1 && hit[1].reject) t.reject = hit[1].reject;
        if (t.booze === 1 && hit[1].booze) t.booze = hit[1].booze;
        t.seeded = TEMPER_V;
    });
}

const lifeOn = () => { try { return A.settings().enabled !== false; } catch { return true; } };
const on = () => !!A && !!A.hasChat?.() && lifeOn() && cfg().on !== false;
const mech = (k) => cfg().mech[k] !== false;

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
    m.who[k] = healDrives(P.heal(m.who[k], temperOf(who)));
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
/** День истории, сдвинутый на n суток, строкой «ГГГГ-ММ-ДД» (или ''). */
function dayShift(day, n) {
    const d = day ? A.parseDate(day) : null;
    if (!d || isNaN(d)) return '';
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function close(who, to, min = 60) {
    const r = relTo(who, to);
    return !!r && num(r.closeness) >= min;
}
/** Чувства who → to из Life (шкалы 0…100, pin — что заперто) или null. */
const relCache = new Map();
let relStamp = 0;
function relTo(who, to) {
    const now = Date.now();
    if (now - relStamp > 1500) { relCache.clear(); relStamp = now; }
    const k = `${A.canonName(who)}>${A.canonName(to)}`;
    if (!relCache.has(k)) relCache.set(k, safe(() => (A.senses?.rel ? A.senses.rel(who, to) : A.relOf(who, to)) || null, null));
    return relCache.get(k);
}
/** Носит ли убеждение, которое мешает верить, что его ценят (0…1): самое крепкое из живых. */
const doubt = (s, t) => Math.max(0, ...t.beliefs.map(b => P.beliefHp(s, b.id) / 100));
/** Связь who → to: { to, t — доли и сила привязанности, st — умные статы пары сейчас }. */
function bondTo(who, to, s, E, t = temperOf(who)) {
    if (!to || A.sameName(who, to)) return null;
    const ti = tie(relTo(who, to), { cosmic: inCircle(who) && inCircle(to) });
    const own = mech('style');
    return ti ? { to: A.canonName(to), t: ti, st: pairStats(ti, { E, dr: s.dr, bel: doubt(s, t), style: own ? styleId(t.attach) : '', reject: own ? rejectOf(t) : 1 }), tr: own ? pairOf(who, to) : null } : null;
}
/** Все его связи с теми, кто в истории главный (и с героиней игрока), от самой сильной. */
function bondsOf(who, s, E, t = temperOf(who)) {
    const U = user();
    const names = [U, ...mains()].filter((n, k, a) => n && !A.sameName(n, who) && a.findIndex(x => A.sameName(x, n)) === k);
    return names.map(n => bondTo(who, n, s, E, t)).filter(Boolean).sort((a, b) => b.t.L - a.t.L);
}
/** Свой человек: тот, к кому привязанность сильнее всего (от половины и выше). */
const dearOf = (who, s, E, t) => { const b = bondsOf(who, s, E, t)[0]; return b && b.t.L >= 0.5 ? b : null; };
/** Имя из строки Летописца → тот, кого знает история (не он сам). */
function whoIs(name, self) {
    const n = str(name, 60);
    if (!n) return '';
    // участники чата — в первую очередь; дальше те, кого в группе нет, но мозг их знает: круг «своих» и пары с тропом
    const known = [user(), ...mains(), ...circle(), ...pairs().flatMap(p => [p.a, p.b])];
    const hit = known.find(x => x && A.sameName(x, n));
    return hit && !A.sameName(hit, self) ? A.canonName(hit) : '';
}

/** Что вокруг него сейчас — для потребностей: рядом ли близкий (героиня игрока) и сколько людей в сцене. */
function around(who, here = present()) {
    const U = user();
    const there = inScene(who, here);
    const dear = !!U && close(who, U);
    // кто в сцене, неизвестно — не гадаем: шкала близости просто держится у нормы
    return { together: dear && here.length ? there && inScene(U, here) : null, crowd: there ? here.length : 0 };
}

/**
 * Что давит на него прямо сейчас помимо событий: сдвиги осей, приток напряжения и несказанного, потолок и скорость воли.
 * s — состояние (для плохой ночи), t — темперамент (для дат).
 */
function signals(who, t = temperOf(who), s = stateOf(who)) {
    const S = A.senses || {};
    const off = { val: 0, aro: 0, ctl: 0, wor: 0 };
    const out = { off, strainIn: 0, maskIn: 0, willMul: 1, willCap: 100, raw: 1, sleepQ: 1, drain: 0.8, giddy: 1, loose: false, worry: false, night: false, date: null, list: [] };
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
        out.drain += Math.min(0.5, debt / 24);
        // недосып раскачивает в обе стороны (Gujar и др., 2011): не только плохое острее, но и веселье с азартом — шире
        out.giddy = 1 + Math.min(debt, 16) / 60;
    }
    const nd = safe(() => S.needs?.(who), null);
    if (nd) {
        if (num(nd.energy, 80) < 30) {
            const flat = nd.energy < 15;
            add('tired', flat ? 'валится с ног' : 'усталость', { aro: flat ? -18 : -10, val: -4 });
            out.drain += flat ? 0.4 : 0.25;
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
    // тайна тяготит не моментом, когда её прячешь, а тем, что к ней возвращаются мысли (Slepian и др., 2017):
    // поэтому груз идёт всё время — и рядом с ней, и без неё, — и давит на фон, а не только копит несказанное
    if (kept?.n) { out.maskIn += Math.min(1.5, 0.25 * kept.n); add('kept', `тайны, которых не знает ${short(U)}: ${kept.n}`, { val: -Math.min(6, 1.5 * kept.n) }); }
    const lastI = A.chatArr().length - 1;
    const unsaid = safe(() => S.wants?.(who) || [], []).filter(w => w.voiced == null && lastI - num(w.mes) >= 30).length;
    if (unsaid) { out.maskIn += Math.min(0.6, 0.15 * unsaid); out.list.push({ id: 'unsaid', text: `молчит о своих желаниях: ${unsaid}` }); }
    // действующие вещества
    if (mech('booze')) {
        // опьянение считает мозг (core/booze.js); если о спиртном знает только Life («Способности») — хотя бы «навеселе»
        const bac = Math.max(num(s?.bac), fx.has('alcohol') ? 20 : 0);
        if (bac > 0 || s?.hung) {
            const heavy = NEG.includes(s?.dom?.id);
            const company = present().length >= 2 && inScene(who);
            const prone = P.clamp(0.3 - num(t.base.wor) / 60 + (rejectOf(t) - 1) * 0.4, 0, 1);
            const bz = boozeNow({ bac, hung: s?.hung }, { company, heavy, prone });
            if (bz.stage || bz.hung) {
                add('booze', bz.list.map(x => x.text).join(' · '), bz.off);
                out.loose = out.loose || bz.loose;
                out.drain += bz.drain;
                out.raw *= bz.raw;
                out.willCap = Math.min(out.willCap, bz.willCap);
                out.strainIn += bz.strainIn;
                out.booze = { ...bz, heavy, blank: !!s?.blank };
            }
        }
    } else if (fx.has('alcohol')) { add('fx-alc', 'алкоголь: тормоза слабее', { ctl: -6, aro: 4 }); out.loose = true; }
    if (fx.has('sedative')) { add('fx-sed', 'седативное', { aro: -15 }); out.strainIn -= 0.3; }
    if (fx.has('stim')) { add('fx-stim', 'стимулятор', { aro: 12 }); out.raw *= 1.1; }
    // день, который он помнит телом
    const md = mdOf(today);
    const dt = md ? t.dates.find(d => d.md === md) : null;
    if (dt) {
        add('date', `сегодня: ${dt.t}`, dt.kind === 'blow' ? { wor: -10, val: -6 } : { val: -10, aro: -6 });
        out.strainIn += 0.4;
        out.date = dt;
    } else {
        // канун: «завтра тот самый день» чувствуется заранее — слабее и без прироста напряжения
        const eve = mdOf(dayShift(today, 1));
        const de = eve ? t.dates.find(d => d.md === eve) : null;
        if (de) { add('eve', `завтра: ${de.t}`, de.kind === 'blow' ? { wor: -4, val: -3 } : { val: -5, aro: -3 }); out.eve = de; }
    }
    // утро после плохой ночи
    if (s?.night?.bad && s.night.day === today) {
        add('night', 'плохая ночь', { aro: -8, val: -6 });
        out.willCap = Math.min(out.willCap, 80);
        out.night = true;
    }
    // потребности: без чувства безопасности нервы тоньше; в толпе, когда людей уже слишком много, — копится
    const dr = s?.dr;
    if (dr) {
        if (dr.safe <= 35) { out.raw *= 1.15; out.list.push({ id: 'unsafe', text: 'не чувствует себя в безопасности' }); }
        if (dr.quiet <= 30 && present().length >= 4 && inScene(who)) { out.strainIn += 0.3; out.list.push({ id: 'crowd', text: 'слишком много людей вокруг' }); }
    }
    if (s) {
        // роль сильного: сколько дней подряд держит лицо
        const rb = P.roleBand(s, t);
        if (rb) {
            out.list.push({ id: 'role', text: `держит лицо ${s.role}-й день подряд${rb === 2 ? ' — трещит' : ''}` });
            if (rb === 2) { out.loose = true; out.strainIn += 0.3; out.willCap = Math.min(out.willCap, 85); }
        }
        out.role = rb;
        // мысли по кругу держат тело в стрессе и после того, как всё кончилось (Brosschot и др., 2006): пока залип — не отпускает
        if (mech('dom') && s.dom?.ts != null && P.stuck(s, P.dominant(P.eff(s, off), s.base, s.dom.id), nowStamp().ts)) {
            out.strainIn += 0.4; out.stuck = true; out.list.push({ id: 'loop', text: 'мысли ходят по кругу — не отпускает' });
        }
        for (const [n, g] of Object.entries(s.grudge || {})) if (g >= 30) out.list.push({ id: 'grudge', text: `обида (${short(n)}): ${Math.round(g)}` });
        if (num(s.jeal) >= 15) out.list.push({ id: 'jeal', text: `ревность${s.jealTo ? ` (${short(s.jealTo)})` : ''}: ${Math.round(s.jeal)}` });
        // свой человек рядом — и между ними не накопилось: отпускает (но не когда сам за него боится)
        if (mech('lens')) {
            const here = present();
            const dear = dearOf(who, s, P.eff(s, off), t);
            if (dear) {
                out.dear = dear;
                const near = here.length && inScene(who, here) && inScene(dear.to, here);
                // ревнует его или только что от него прилетело — рядом с ним сейчас не спокойнее
                const lastI = A.chatArr().length - 1;
                const sore = (num(s.jeal) >= 25 && A.sameName(s.jealTo, dear.to)) || (!!s.hurtBy && A.sameName(s.hurtBy.to, dear.to) && lastI - num(s.hurtBy.mes) <= 8);
                const hv = haven(dear.st, out.worry || sore);
                if (near && hv.on) { out.haven = { ...hv, to: dear.to }; out.list.push({ id: 'haven', text: `рядом ${short(dear.to)} — отпускает` }); }
            }
        }
        // погода дома: свои на нервах — всем тяжелее; у своих тепло — и ему чуть теплее
        if (mech('home')) {
            const kin = mains().filter(n => !A.sameName(n, who) && temperOf(n).on !== false && close(who, n, 60)).map(n => ({ n, st: M().who[A.canonName(n)] })).filter(x => x.st);
            const hot = kin.filter(x => num(x.st.strain) >= 65 || x.st.brk || x.st.hang);
            if (hot.length) { out.strainIn += Math.min(1, 0.6 * hot.length); out.list.push({ id: 'home', text: `дома тяжело: ${hot.map(x => short(x.n)).join(', ')} на нервах` }); }
            else if (kin.length && kin.every(x => num(x.st.mood?.val) >= 12)) add('home', 'дома тепло', { val: 3 });
        }
    }
    out.strainIn = Math.max(0, out.strainIn);
    return out;
}
const loadOf = (sig) => ({ strainIn: sig.strainIn, maskIn: sig.maskIn, willMul: sig.willMul, willCap: sig.willCap });

/** Каким он будет прямо сейчас: состояние, доведённое до текущего момента истории (само состояние не трогает). */
function view(who) {
    const t = temperOf(who);
    const live = stateOf(who);
    const s = clone(live);
    const h = s.at ? hoursBetween(s.at, nowStamp()) : 0;
    if (mech('booze')) sober(s, h, tolOf(t));
    const sig = signals(who, t, s);
    if (s.at) { P.decay(s, h, t, loadOf(sig)); driveDecay(s, h, t, around(who)); }
    else s.will = Math.min(s.will, sig.willCap);
    const E = P.eff(s, sig.off);
    const dom = P.dominant(E, s.base, mech('dom') ? s.dom?.id : '');
    const near = around(who);
    const lastI = A.chatArr().length - 1;
    const hurt = s.hurtBy && lastI - num(s.hurtBy.mes) <= 8 ? s.hurtBy.kind : '';
    const sore = Object.entries(s.grudge || {}).filter(x => x[1] >= 30).sort((a, b) => b[1] - a[1])[0];
    const extra = { jeal: P.jealStyle(s, E, dom), role: sig.role || 0, hurt, stay: hurt === 'stay' ? stayStyle(E, dom) : '', cosmic: !!sig.dear?.t.cosmic, grudge: sore ? short(sore[0]) : '', stuck: mech('dom') && P.stuck(s, dom, nowStamp().ts), style: mech('style') ? styleId(t.attach) : '', dear: !!sig.dear, hung: !!sig.booze?.hung || num(sig.booze?.stage) >= 3 };
    if (mech('style')) {
        // проглотил несогласие со своим человеком — несколько ответов это видно; как именно — по способу привязываться
        if (s.swallow && lastI - num(s.swallow.mes) <= 6) extra.mute = STYLE_OBJECT[extra.style] || 'mute';
        if (s.dare && lastI - num(s.dare.mes) <= 4) extra.dare = true;
    }
    if (mech('status')) extra.status = statusFlip(statusHabit(t, mech('style') ? styleId(t.attach) : ''), dom, !!s.won && lastI - num(s.won) <= 2);
    return { who, t, s, sig, E, dom, wit: mech('wit') ? P.witOf(s, E, dom, t) : '', combo: combos({ s, dom, worry: sig.worry, apart: near.together === false, ...extra }) };
}

const domLabel = (dom) => (dom?.id ? EMO_NAME[dom.id][dom.step - 1] : 'ровно');
/** Сколько прожито вдвоём с героиней игрока и сняты ли тормоза — для цены шага. */
const initCtx = (who, v) => ({ steps: num(safe(() => A.senses?.steps?.(who, user())?.n, 0)), loose: !!v.sig.loose, hungry: num(v.s?.dr?.bond, 60) <= 35 });

// ───────────── Летописец ─────────────

const RULE = `
psy — что этот пост (и пост игрока перед ним) сделал с ВНУТРЕННИМ состоянием персонажей из строки «Психика»: [{"who":"имя","blow":2,"held":1,"why":"из-за чего, 3–10 слов"}]. Только те, с кем что-то случилось; ни с кем — []. В строке — только ненулевые шкалы, каждая от 1 до 3 (1 — слегка, 2 — заметно, 3 — по-настоящему сильно; 3 ставь редко): warm — ему дали тепло, поддержку, нежность, признание; fun — смех, игра, флирт, азарт; win — справился, защитил, его послушали, получилось; calm — отдых, покой, безопасность, отпустило; threat — угроза ему или тем, кто ему дорог, опасность; blow — удар по самооценке: унизили, обесценили, пристыдили, напомнили о худшем в нём, сам себя винит; bound — потерял контроль: решили за него, скован, беспомощен, лишён выбора; wrong — с ним обошлись несправедливо, соврали, перешли границу, задели близкого; loss — утрата, разлука, отвергли, одиночество; rival — ревность: тот, кто ему дорог, отдал тепло или внимание другому, или кто-то претендует на его место рядом; held — сдержался: проглотил, промолчал, удержал лицо, хотя внутри кипело; open — открылся: сказал вслух то, что носил в себе, показал настоящее, выплакался, признался. Оценивай то, что случилось С НИМ, а не то, как он это показал: спокойное лицо после оскорбления — это blow и held. Обычный разговор без такого — не пиши ничего. Если это пришло от конкретного человека (в том числе от персонажа игрока) — добавь "by":"его имя" (у rival в by — тот, кто ему дорог); от двоих разное — две строки на одного who.
Если в «Психике» у человека есть «возвращает» и в посте это с ним произошло и помогло — добавь в его строку "fix":[номера]. Если есть «убеждения» и поступок или слова в посте ПО-НАСТОЯЩЕМУ поколебали одно из них (−1 слегка, −2 сильно: ему на деле показали, что это не так, и он хоть на шаг это принял) или подтвердили (1, 2) — добавь "bel":[{"id":"b…","d":-1}]; дежурный комплимент убеждение не колеблет. Если человек в ЭТОМ посте пил спиртное — добавь в его строку "drink": 1 (глоток, бокал-другой), 2 (заметно: несколько порций) или 3 (много: бутылка, залпом, на спор); строка может состоять из одного "drink". То же — для персонажа игрока (его имя дано в «Психике»): если спиртное пил он, в этом или в предыдущем посте, добавь отдельную строку {"who":"его имя","drink":1}; других полей в ней не ставь.`;

/**
 * Пост игрока целиком — Летописцу. Life показывает ему только начало предыдущего поста, и всё, что игрок написал
 * дальше (выпил, сказал, сделал), терялось. Каждый пост игрока уходит один раз — тому ответу, который идёт следом
 * (в группе двое отвечают подряд — второму его уже не даём, иначе выпитое посчиталось бы дважды); свайп того же
 * ответа получает его снова.
 */
function playerPost(i) {
    const ch = A.chatArr();
    const at = Number.isInteger(i) ? i : ch.length - 1;
    const m = M();
    for (let j = at - 1; j >= 0 && j >= at - 6; j--) {
        const x = ch[j];
        if (!x || x.is_system) continue;
        if (!x.is_user) continue;
        if (m.meSeen && m.meSeen.u === j && m.meSeen.i !== at) return '';
        m.meSeen = { u: j, i: at };
        const text = String(safe(() => (A.plainText ? A.plainText(x.mes) : x.mes), x.mes) || '').replace(/\s+\n/g, '\n').trim();
        const max = Math.round(P.clamp(cfg().postChars ?? 6000, 700, 20000));
        return text.length > 700 ? text.slice(0, max) : '';
    }
    return '';
}

function chron(i) {
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
    const full = safe(() => playerPost(i), '');
    return { key: '"psy": []', rule: RULE, tokens: 85 + who.length * 50 + extra, input: `Психика (оцени, что с ними случилось в этих постах): ${cur.join(' | ')}${mech('booze') && user() ? ` | персонаж игрока: ${short(user())} (только выпитое)` : ''}${full ? `\nПост игрока целиком (выше он обрезан; учитывай его весь — во всех разделах):\n${full}` : ''}` };
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
    relCache.clear();
    // свайп того же поста — с того же места
    // (ручные правки после этого поста лежат в m.ops и накладываются заново; новый пост — они уже в снимке)
    if (m.snap && m.snap.i === i) {
        try {
            m.who = JSON.parse(m.snap.data);
            // выпитое у персонажа игрока — тоже с того же места (в снимках до 0.8.2 его нет)
            if (typeof m.snap.me === 'string') { const me = JSON.parse(m.snap.me); if (me) m.me = me; else delete m.me; }
        } catch { /* */ }
    } else { m.snap = { i, data: JSON.stringify(m.who), me: JSON.stringify(m.me ?? null) }; m.ops = []; }
    const ops = Array.isArray(m.ops) ? m.ops.filter(o => o.i === i) : [];
    const n = stampAt(i);
    const here = present();
    const rows = Array.isArray(j?.psy) ? j.psy : [];
    const trig = safe(() => A.senses?.trigAt?.(i) || [], []);
    const done = [];
    safe(() => mePost(i, rows, n));
    for (const who of list()) {
        const t = temperOf(who);
        const s = stateOf(who);
        const there = inScene(who, here);
        // новая ночь: на нервах — плохая (свайп даёт ту же)
        const nights = s.at?.day && n.day && s.at.day !== n.day ? 1 : 0;
        if (nights) {
            const bad = P.nightRoll(s, `${A.canonName(who)}:${n.day}`, { trig: s.lastTrig != null && i - s.lastTrig <= 40 });
            s.night = { day: n.day, bad, n: 0 };
            P.roleDay(s, s.at.day);
            if (bad) log(s, { mes: i, src: 'night', why: 'плохая ночь: сна почти не было' });
        } else if (s.night?.bad && there) s.night.n = num(s.night.n) + 1;
        const hrs = s.at ? hoursBetween(s.at, n) : 0;
        // алкоголь уходит со временем; ушёл — похмелье
        const tol = tolOf(t);
        if (mech('booze')) {
            const was = s.hung ? num(s.hung.lvl) : 0;
            sober(s, hrs, tol);
            if (s.hung && num(s.hung.lvl) > was) log(s, { mes: i, src: 'drink', why: s.hung.lvl === 2 ? 'тяжёлое похмелье' : 'похмелье' });
        }
        const sig = signals(who, t, s);
        // время: вспышки гаснут, настроение оседает, воля возвращается, напряжение и несказанное идут к равновесию
        P.decay(s, hrs, t, { ...loadOf(sig), nights, sleepQ: sig.sleepQ * (nights && s.night?.bad ? 0.3 : 1) });
        const env = around(who, here);
        driveDecay(s, hrs, t, env);
        if (s.grudge) for (const k of Object.keys(s.grudge)) { s.grudge[k] = grudgeDecay(s.grudge[k], hrs, t.recover); if (s.grudge[k] < 8) delete s.grudge[k]; }
        // отклик на сильное событие: его ответ прошёл — следующая стадия (реакция → развилка → решение)
        if (s.seq && msg && A.sameName(msg.name, who) && i > num(s.seq.mes)) { s.seq.n = num(s.seq.n) + 1; if (s.seq.n > 2) s.seq = null; }
        if (there && env.crowd >= 4) s.dr.quiet = P.clamp(s.dr.quiet - 3 * num(t.want.quiet, 1), 0, 100);   // каждый ответ в толпе
        // гавань: свой человек рядом — напряжение уходит быстрее, безопасности больше
        const hv = sig.haven;
        if (hv) {
            const hh = Math.min(hrs, 12);
            s.strain = P.clamp(s.strain - hv.ease * 0.4 * hh, 0, 100);
            if (s.dr.safe < 85) s.dr.safe = Math.min(85, s.dr.safe + hv.safe * hh + (there ? 1 : 0));
        }
        s.at = { ts: n.ts, mes: i, day: n.day };
        if (s.hang && P.hangOver(s, n)) s.hang = null;
        // срыв был сигналом на этот ответ: он его сыграл (или прошло два ответа) — дальше похмелье
        if (s.brk && i > s.brk.mes && (!msg || A.sameName(msg.name, who) || aiSince(s.brk.mes, i) >= 2)) {
            P.resolveBreak(s, n);
            log(s, { mes: i, src: 'brk', why: 'срыв прожит — пусто и тяжело' });
        }
        // события этого поста: у каждой строки Летописца — свой источник, а значит, и своя линза
        const mineRows = rows.filter(r => r && typeof r === 'object' && A.sameName(String(r.who || ''), who)).slice(0, 3);
        const row = mineRows[0];
        let said = {};                       // что назвал Летописец (все строки вместе)
        let why = '';
        const E0 = P.eff(s, sig.off);
        const lead = mech('dom') ? P.dominant(E0, s.base, s.dom?.id) : null;     // что вело до этого поста
        let neg = false;
        // сработавшие триггеры: их удар считается отдельно и без линзы; то же самое у Летописца второй раз не бьёт
        let trigHits = {};
        let trigWhy = '';
        for (const e of trig) {
            if (!A.sameName(e.who, who)) continue;
            const lv = Math.round(P.clamp(e.lvl, 1, 3));
            trigHits = P.mergeHits(trigHits, e.coped ? { threat: Math.max(1, lv - 1) } : { threat: lv, bound: Math.max(1, lv - 1) });
            trigWhy = trigWhy || `триггер: ${str(e.t, 60)}`;
            s.lastTrig = i;
        }
        // выпил в этом посте — считается сразу, а играть начнёт со следующего ответа
        const dn = mech('booze') ? Math.max(0, ...mineRows.map(r => Math.round(P.clamp(r.drink, 0, 3)))) : 0;
        if (dn) {
            const st0 = stageOf(s.bac);
            // тот же бокал из поста в пост — не новая порция целиком; «много» считается всегда
            const again = s.drankAt != null && i - s.drankAt <= 2;
            drink(s, dn, tol, again ? [1, 0.4, 0.7, 1][dn] : 1);
            s.drankAt = i;
            const st1 = stageOf(s.bac);
            log(s, { mes: i, src: 'drink', why: `спиртное: ${['', 'немного', 'заметно', 'много'][dn]}${st1 !== st0 ? ` — ${STAGE_NAME[st1]}` : st1 === 0 ? ' — почти не берёт' : ''}` });
        }
        const bz = sig.booze;
        for (const r of mineRows) {
            const h0 = P.cleanHits(r);
            if (!Object.keys(h0).length) continue;
            said = P.mergeHits(said, h0);
            const h = Object.fromEntries(Object.entries(h0).filter(([k, v]) => !(trigHits[k] >= v)));
            if (!Object.keys(h).length) { why = why || str(r.why, 90); continue; }
            const by = whoIs(r.by, who);
            const rwhy = str(r.why, 90);
            let L = { kmul: {}, kmood: {}, tags: [] };
            let bond = null;
            if (mech('lens')) {
                bond = by ? bondTo(who, by, s, E0, t) : null;
                if (!bond && h.rival) bond = sig.dear || null;        // ревнуют того, кто дорог
                if (bond) L = lens(h, bond.t, bond.st, { grudge: num(s.grudge?.[bond.to]), reject: mech('style') ? rejectOf(t) : 1 });
                // троп пары: что у этих двоих задевает сильнее, а что — слабее
                const tm = bond?.tr && by && A.sameName(bond.to, by) ? tropeMul(bond.tr.id, h) : {};
                for (const [k, x] of Object.entries(tm)) L.kmul[k] = (L.kmul[k] ?? 1) * x;
                if (Object.keys(tm).length) L.tags.push('trope');
                // рядом свой человек — чужая угроза переносится легче
                if (h.threat && hv && !(by && A.sameName(by, hv.to))) { L.kmul.threat = (L.kmul.threat ?? 1) * hv.threat; L.tags.push('haven'); }
            }
            if ((h.win || 0) >= 2) s.won = i;
            if (sig.giddy > 1) for (const k of ['fun', 'win']) if (h[k]) L.kmul[k] = (L.kmul[k] ?? 1) * sig.giddy;
            // алкогольная близорукость: что на первом плане — разрастается (сильное и так на потолке)
            if (bz?.stage) {
                for (const [k, v] of Object.entries(h)) if (v <= 2 && k !== 'held') L.kmul[k] = (L.kmul[k] ?? 1) * (k === 'threat' ? bz.threat : bz.amp);
                L.tags.push('drunk');
            }
            const d = { ...P.hit(s, h, t, { raw: sig.raw, kmul: L.kmul, kmood: L.kmood, drain: sig.drain }), ...driveHit(s, h, t) };
            const bad = Object.keys(h).some(k => P.NEGATIVE.includes(k));
            if (h.rival) { P.jealUp(s, h.rival, L.kmul.rival ?? 0.5); s.jealTo = bond?.to || by || ''; }
            P.roleHit(s, h, n.day);
            // доминанта стягивает постороннее: пока ведёт тяжёлое чувство, другое плохое частью льётся в него же
            if (bad && lead && lead.step >= 2 && NEG.includes(lead.id)) {
                const top = Object.entries(h).filter(([k]) => P.NEGATIVE.includes(k)).sort((a, b) => b[1] - a[1])[0];
                if (top && KIND_EMO[top[0]] !== lead.id && P.feedDominant(s, lead.id, Math.max(...P.AXES.map(a => Math.abs(d[a] || 0))))) L.tags.push('pile');
            }
            if (by) {
                // кто чем его кормит: какие потребности растут рядом с этим человеком
                const fed = Object.entries(d).filter(([k, x]) => P.DRIVES.includes(k) && x > 0);
                if (fed.length) {
                    s.feed = s.feed && typeof s.feed === 'object' ? s.feed : {};
                    const f = s.feed[by] = s.feed[by] || {};
                    for (const [k, x] of fed) f[k] = Math.round(Math.min(200, num(f[k]) * 0.92 + x));
                }
                // от своего прилетело — тянуться мириться или закрыться; согрел — отпустило
                if (bond && bond.t.L >= 0.5 && Object.keys(h).some(k => SOFT.includes(k) || k === 'loss')) s.hurtBy = { to: bond.to, mes: i, kind: afterHurt(bond.t, bond.st, mech('style') ? styleId(t.attach) : '') };
                else if (s.hurtBy && A.sameName(s.hurtBy.to, by) && ((h.warm || 0) >= 2 || (h.open || 0) >= 2)) s.hurtBy = null;
                // сдержался перед своим человеком — несогласие осталось при нём («преданность мешает возразить»)
                if (bond && bond.t.L >= 0.5 && ((h.held || 0) >= 2 || ((h.held || 0) >= 1 && sig.worry))) s.swallow = { to: bond.to, mes: i };
                else if (s.swallow && A.sameName(s.swallow.to, by) && (h.open || 0) >= 2) s.swallow = null;
                // двое-зеркал: азарт своего человека заражает, а не настораживает
                if (bond?.tr?.id === 'hybrid' && A.sameName(bond.to, by) && ((h.fun || 0) >= 2 || (h.win || 0) >= 2)) s.dare = { to: bond.to, mes: i };
                // предательство того, кто не «свой», оставляет обиду; его же тепло и откровенность её снимают
                if (L.tags.includes('grudge')) { s.grudge = s.grudge && typeof s.grudge === 'object' ? s.grudge : {}; s.grudge[by] = 100; }
                else if (s.grudge?.[by] && ((h.warm || 0) >= 2 || (h.open || 0) >= 2)) { s.grudge[by] -= 45; if (s.grudge[by] < 8) delete s.grudge[by]; }
            }
            // сильное плохое событие открывает «отклик»: три его следующих ответа — реакция, развилка, решение
            if (mech('seq') && Object.entries(h).some(([k, v]) => v >= 3 && P.NEGATIVE.includes(k))) s.seq = { mes: i, ts: n.ts, n: 0, t: rwhy };
            log(s, { mes: i, src: 'post', why: rwhy, hits: h, d, by: by ? short(by) : '', tags: L.tags });
            if (bad) neg = true;
            if (rwhy && (!why || bad)) why = rwhy;
            if ((h.warm || 0) >= 2) s.warmAt = i;
        }
        let hits = said;
        if (Object.keys(trigHits).length) {
            why = why || trigWhy;
            const d = { ...P.hit(s, trigHits, t, { raw: sig.raw }), ...driveHit(s, trigHits, t) };
            log(s, { mes: i, src: 'post', why: trigWhy, hits: trigHits, d });
            hits = P.mergeHits(hits, trigHits);
            neg = true;
        }
        if (Object.keys(hits).length && why) s.why = { t: why, mes: i, neg };
        // тихий пост рядом со своим человеком понемногу отпускает (когда в посте плохого не было — драму гавань не гасит)
        if (hv && there && !neg) s.strain = P.clamp(s.strain - hv.ease * 0.3, 0, 100);
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
        const dom = P.dominant(E, s.base, mech('dom') ? s.dom?.id : '');
        // память с чувством: сильное запоминается вместе с тем, чем оно для него было…
        const top = Object.entries(hits).filter(([k]) => KIND_EMO[k]).sort((a, b) => b[1] - a[1])[0];
        if (why && top && top[1] >= 3) P.mark(s, { mes: i, day: n.day, t: why, emo: dom.id || KIND_EMO[top[0]], w: top[1] });
        // …и всплывает потом в тон тому, что он чувствует
        const rc = mech('recall') ? P.pickRecall(s, dom, i) : null;
        // …и возвращает часть того, чем было (вспышкой)
        if (rc) { rc.r = i; s.recall = { id: rc.id, at: i, t: rc.t, day: rc.day }; P.echo(s, rc.emo, rc.w); }
        // шаги по своей инициативе, сделанные в этом посте, стоят воли
        for (const sp of spends.filter(x => x.i === i && A.sameName(x.who, who))) {
            const g = P.afford(s, dom, sp.kind, initCtx(who, { sig, s }));
            P.spend(s, g.cost);
            log(s, { mes: i, src: 'init', why: `сам сделал шаг (${INIT_NAME[sp.kind] || 'инициатива'}): воля −${g.cost}` });
        }
        if (there) P.holdCost(s, dom, sig.drain);
        if (cfg().brk !== false && there) {
            // сработавший триггер сам по себе не «острый» срыв: его эпизод играет модуль триггеров
            const kind = P.breakCheck(s, E, said);
            if (kind) {
                s.brk = { mes: i, ts: n.ts, kind, why: why || s.why?.t || '', emo: dom.id || '' };
                if (s.brk.why) P.mark(s, { mes: i, day: n.day, t: `сорвался: ${s.brk.why}`, emo: NEG.includes(dom.id) ? dom.id : 'low', w: 3 });
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
        if (mineOps.length) { for (const op of mineOps) applyOp(s, t, op); last = P.dominant(P.eff(s, sig.off), s.base, mech('dom') ? s.dom?.id : ''); }
        P.setDominant(s, last, n);
        P.sample(s, P.eff(s, sig.off), n.day);
        // когда они последний раз были в одной сцене с героиней игрока (для «стука от тоски»)
        if (there && here.length && inScene(user(), here)) s.seen = { ts: n.ts, mes: i };
        drive(who, last, s, s.why && i - s.why.mes <= 6 ? s.why.t : '', i);
        // лицо на аватарке: мозг подсказывает, только если Летописец лица не увидел и человек не держал маску
        if (A.senses?.face && !said.held) {
            const face = s.hang && !last.id ? 'sad' : last.step >= 2 ? FACE[last.id] : '';
            if (face) safe(() => A.senses.face(i, who, face));
        }
        done.push({ who, s, dom: last, there });
    }
    // заражение настроением: близкие люди в одной сцене тянут друг друга (один источник на пост)
    for (const a of done) {
        if (!a.there || !mech('catch')) continue;
        const src = done.find(b => b !== a && b.there && b.dom.id && b.dom.step >= 2 && close(a.who, b.who, 50));
        if (!src) continue;
        if (NEG.includes(src.dom.id)) {
            // сцепка плохого настроения сильнее в парах, где накопилось, и слабее там, где друг другу опора
            // (Saxbe, Repetti, 2010: чем теснее связаны кортизол и дурное настроение супругов, тем ниже довольство браком)
            const b = mech('lens') ? bondTo(a.who, src.who, a.s, P.eff(a.s)) : null;
            // «свои» чувствуют друг друга в полную силу: его страх — её страх (потому вдвоём и опаснее, чем по отдельности)
            const k = b ? (b.t.cosmic ? 1.2 : b.t.sour >= 0.5 ? 1.5 : b.st.haven >= 50 ? 0.5 : 1) : 1;
            a.s.fast.aro = P.clamp(a.s.fast.aro + 6 * k, -150, 150);
            a.s.fast.val = P.clamp(a.s.fast.val - 4 * k, -150, 150);
            a.s.strain = P.clamp(a.s.strain + 2 * k, 0, 100);
        } else a.s.fast.val = P.clamp(a.s.fast.val + 5, -150, 150);
        log(a.s, { mes: i, src: 'near', why: `рядом ${short(src.who)} (${domLabel(src.dom)}) — передаётся` });
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

/** Какой он пьяный на этой стадии: общая картина стадии + его собственная манера, если выписана. */
function drunkText(t, bz) {
    const own = str(t.cass?.drunk, 320);
    return `${DRUNK[bz.stage]}${own ? `; под градусом держится так: ${own}` : ''}${bz.heavy && bz.stage >= 2 ? '; тяжёлое, что на уме, спиртное только раздувает: об этом и говорит, остального не слышит' : ''}`;
}
const hungText = (t, bz) => `${str(t.cass?.hung, 320) ? `${bz.hung === 2 ? 'тяжёлое похмелье' : 'с похмелья'}: ${str(t.cass.hung, 320)}` : HUNG[bz.hung]}${bz.blank ? '; вчерашний вечер помнит кусками — может не помнить, что говорил и делал' : ''}`;
/** С кем из тех, кто в сцене, у него троп: сначала тот, от кого только что прилетело или кого ревнует, потом самый близкий. */
function tropeWith(who, v, here = present()) {
    const { s } = v;
    const all = bondsOf(who, s, v.E, v.t).filter(b => b.tr && inScene(b.to, here));
    if (!all.length) return null;
    const hot = all.find(b => (s.hurtBy && A.sameName(s.hurtBy.to, b.to)) || (num(s.jeal) >= 25 && A.sameName(s.jealTo, b.to)));
    return hot || all[0];
}
/** Час истории (0…23) или -1, если Life его не знает. */
function hourNow() {
    const tm = String(A.worldState()?.timestamp?.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
    return tm ? +tm[1] : -1;
}
/**
 * Какая сейчас минута у человека: 'soft' — тихая (нежность, редкий покой, поздний час, устал, утро после),
 * 'play' — игривая, '' — обычная. Подначки в строке пары — только в игривую; у близких бывает и просто тишина,
 * и это не тревога.
 */
function toneOf(v) {
    const { s, dom, sig } = v;
    if (NEG.includes(dom.id) || s.brk) return '';
    const h = hourNow();
    const late = h >= 23 || (h >= 0 && h < 6);
    if (dom.id === 'tender' || v.combo.some(c => c.id === 'rest') || sig.booze?.hung || s.hang || num(sig.drain) >= 1.2 || late) return 'soft';
    return dom.id === 'playful' ? 'play' : '';
}

/**
 * Глубина персонажа — то, что есть в нём всегда, а не случилось сейчас: как привязывается, по какому сценарию
 * живёт пара, чего добивается. В тихой сцене — по одной строке за ответ, по кругу (чтобы модель не повторяла один
 * жест, и не чаще раза в три ответа каждая); под давлением — троп с его тёмной стороной и стержень целиком.
 */
function depthBits(who, v, press, choosing, hard) {
    const { s, t, sig } = v;
    const here = present();
    const lastI = A.chatArr().length - 1;
    const out = [];
    const style = mech('style') ? styleId(t.attach) : '';
    const pair = mech('style') ? tropeWith(who, v, here) : null;
    const sp = mech('spine') && hasSpine(t.spine) ? t.spine : null;
    // «хочу» растёт из убеждения о себе: шатается — начинает видеть, что ему нужно; сломалось — может выбрать «нужно»
    const seeing = s.belBroke && lastI - s.belBroke.mes <= 40 ? 2 : t.beliefs.some(b => { const hp = P.beliefHp(s, b.id); return hp > 0 && hp <= 40; }) ? 1 : 0;
    const tone = toneOf(v);
    const trope = (dark) => (pair ? tropeLine(pair.tr, short(pair.to), dark, tone) : '');
    if (press) {
        // один блок, не оба: на развилке и когда прижало всерьёз важнее стержень, иначе — троп с его тёмной стороной
        const spine = sp && (choosing || hard) ? spineLine(sp, choosing ? 'choice' : 'press', seeing) : '';
        out.push(spine || trope(true));
        return out.filter(Boolean);
    }
    // тихо: одна строка по кругу — как привязан, троп, чем живёт
    const dear = sig.dear;
    // тихая минута — своя строка (без подначек и дела); если «редкий покой» уже сказан комбинацией — не повторяем
    const calmed = v.combo.some(c => c.id === 'rest');
    const near = style && dear && !calmed && inScene(who, here) && inScene(dear.to, here) ? (tone === 'soft' && styleLine(style, 'quiet')) || styleLine(style, 'near') : '';
    // у каждой строки свой ответ из трёх: нет её — в этот раз ничего (одно и то же каждый пост модель начинает повторять)
    const line = [near, trope(false), sp ? spineLine(sp, 'calm') : ''][lastI % 3];
    if (line) out.push(line);
    return out;
}

function note(who) {
    const v = view(who);
    const { s, t, dom, sig } = v;
    const W = short(who), U = short(user());
    if (s.brk) {
        return `[${W} — срыв в этом ответе: ${cassText(t, 'brk')}.${s.brk.why ? ` Последняя капля: ${s.brk.why}.` : ''} Сыграй по-настоящему и в характере персонажа; примирения и «всё хорошо» в этом же ответе не будет. За персонажа игрока (${U}) не решай и не говори.]`;
    }
    const bits = [];
    const bz = sig.booze;
    if (s.hang) bits.push(`после срыва — ${cassText(t, 'hang')}`);
    if (bz?.hung) bits.push(hungText(t, bz));
    if (dom.id) {
        bits.push(`${domLabel(dom)} — ${cassOf(t, dom.id, dom.step)}`);
        if (dom.second) bits.push(`примесью — ${EMO_NAME[dom.second][Math.max(1, P.stepOf(dom.second, dom.all[dom.second])) - 1]}`);
    }
    // то, что накладывается сверху: не больше трёх, по важности
    const extra = [];
    // отклик держится, пока сцена та же: полдня истории или десяток постов спустя он уже не к месту
    const now = nowStamp();
    const seqLive = s.seq && A.chatArr().length - 1 - num(s.seq.mes) <= 10 && (s.seq.ts == null || now.ts == null || now.ts - s.seq.ts <= 6 * 3.6e6);
    if (mech('seq') && seqLive && SEQ_TEXT[num(s.seq.n)]) extra.push(SEQ_TEXT[num(s.seq.n)]);
    // пьян — это меняет всю манеру, поэтому идёт раньше остального
    if (bz?.stage) extra.push(drunkText(t, bz));
    // персонаж игрока под градусом или с похмелья: близкий присматривает — каждый по-своему
    const me = meNow();
    // не каждый ответ, иначе выйдет «ты как?» через строчку: сразу после выпитого и потом раз в три ответа
    const meTick = A.chatArr().length - 1;
    const meDue = me && (meTick % 3 === 0 || (me.s.drankAt != null && meTick - me.s.drankAt <= 1));
    if (meDue && (me.stage >= 2 || me.hung) && !sig.worry && inScene(user())) {
        const b = bondTo(who, user(), s, v.E, t);
        if (b && b.t.L >= 0.5) extra.push(`${U} ${me.stage ? 'под градусом' : 'с похмелья'} — присматривает по-своему: ${cassText(t, 'care')}`);
    }
    const leak = P.leakOf(s, sig.loose);
    if (leak) extra.push(`${leak === 2 ? 'то, что прячет, уже почти не держится и может сорваться с языка' : 'то, что прячет, проступает сильнее обычного'}: ${cassText(t, 'leak')}`);
    // комбинации потребностей с чувством: самая сильная — сразу, вторая — если останется место
    // качели статуса — не одна из комбинаций на выбор, а то, как сейчас держится тело: идёт всегда, когда поза сломалась
    const flip = (v.combo || []).find(c => c.id === 'drop' || c.id === 'rise');
    if (flip) bits.push(flip.t);
    const cmb = (v.combo || []).filter(c => c !== flip);
    if (cmb[0]) extra.push(cmb[0].t);
    if (sig.worry && inScene(user()) && cmb[0]?.id !== 'control') extra.push(`тревога за близкого (${U}) выходит опекой: ${cassText(t, 'care')}`);
    if (s.recall && A.chatArr().length - 1 - s.recall.at <= 1) extra.push(`всплывает прежнее${s.recall.day ? ` (${s.recall.day})` : ''}: «${s.recall.t}» — не обязательно вслух, но оно здесь`);
    if (sig.night && num(s.night?.n) < 6) extra.push(`ночь была плохой — ${cassText(t, 'night')}`);
    if (sig.date) extra.push(`сегодня ${sig.date.t} — помнит этот день телом, вслух может и не сказать`);
    else if (sig.eve) extra.push(`завтра ${sig.eve.t} — уже чувствует приближение: тише обычного, спать будет плохо; об этом не заговорит`);
    const bel = beliefBit(v);
    if (bel) extra.push(bel);
    if (sig.loose && !bz?.stage && sig.list.some(x => x.id === 'fx-alc')) extra.push('под алкоголем: тормоза слабее, скрываемое ближе к поверхности');
    if (cmb[1]) extra.push(cmb[1].t);
    if (v.wit && (dom.id || s.strain >= 45)) extra.push(WIT_TEXT[v.wit]);
    bits.push(...extra.slice(0, 3));
    const neg = NEG.includes(dom.id);
    // глубина: как привязан, троп пары, стержень
    const lastI = A.chatArr().length - 1;
    const sore = (!!s.hurtBy && lastI - num(s.hurtBy.mes) <= 8) || num(s.jeal) >= 25;
    const press = (neg && dom.step >= 2) || s.strain >= 55 || !!seqLive || sore || !!sig.worry;
    const choosing = !!seqLive && num(s.seq.n) >= 1;
    const deep = depthBits(who, v, press, choosing, neg && dom.step >= 3);
    const plain = !bits.length;      // состояния нет — уходит только то, каков он всегда
    bits.push(...deep);
    if (neg && dom.step >= 2 && t.fix.length) bits.push(`что возвращает в себя (сам к этому тянется): ${t.fix.slice(0, 4).join(', ')}`);
    const band = P.willBand(s.will);
    const will = WILL_TEXT[band];
    if (!bits.length && !will) return '';
    // причину называем, только когда есть само чувство (у комбинации потребностей причина — время, а не событие)
    const fresh = (dom.id || s.hang) && s.why && A.chatArr().length - 1 - s.why.mes <= 6 && (!dom.id || s.why.neg === neg) ? s.why.t : '';
    let tail = '';
    const sunk = neg ? s.mood[MAIN_AX[dom.id]] : 0;
    if (neg && sunk <= -16) tail = ' Это уже не вспышка, а настроение: от одной хорошей фразы не отпустит — теплеет постепенно, за несколько шагов.';
    else if (neg && sunk > -6) tail = ' Это вспышка: если не подливать, скоро отпустит.';
    if (plain && bits.length && !will) return `[${W} — постоянное, не событие (держи в поведении и мелочах, вслух не называя): ${bits.join('; ')}.]`;
    return `[${W} — что внутри сейчас (считает Life по событиям истории; играй в поведении и теле, не называя и без цифр): ${bits.join('; ') || 'ровно'}.${fresh ? ` Из-за чего: ${fresh}.` : ''}${tail}${will ? ` Запас сил: ${will}.` : ''}]`;
}

function prompt(type) {
    if (!on() || type === 'quiet' || type === 'impersonate') return '';
    const here = present();
    return [...list().filter(n => inScene(n, here)).map(n => safe(() => note(n), '')), safe(() => meLine(here), '')].filter(Boolean).join('\n');
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
        if (num(sig.booze?.stage) >= 2) found.push([6, `${W} под градусом: что на уме, то сейчас и на языке`]);
        if (sig.date) found.push([7, `сегодня ${sig.date.t} — ${W} помнит этот день`]);
        const weak = t.beliefs.map(b => [b, P.beliefHp(s, b.id)]).filter(([, hp]) => hp > 0 && hp <= 40).sort((a, b) => a[1] - b[1])[0];
        if (weak) found.push([6, `убеждение «${weak[0].t}», с которым живёт ${W}, вот-вот рухнет`]);
        if (s.strain >= 60) found.push([5, `${W}: нервы на пределе${sig.list.length ? ` (${sig.list.slice(0, 2).map(x => x.text).join(', ')})` : ''}`]);
        if (sig.worry) found.push([4, `${W} изводится тревогой за близкого`]);
        if (sig.list.some(x => x.id === 'unsaid')) found.push([3, `${W} давно молчит о собственном желании`]);
        if (sig.night) found.push([2, `у ${W} была плохая ночь`]);
        if (s.dr.bond <= 25) found.push([4, `${W}: голод по близости, давно никто не был рядом по-настоящему`]);
        if (s.dr.novel <= 15) found.push([1, `${W}: рутина душит, тянет на авантюру`]);
        if (s.dr.free <= 25) found.push([3, `${W}: тесно, слишком долго решали за него`]);
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
        const hungry = num(s.dr?.bond, 60) <= 35;
        const far = s.seen.ts != null && now.ts != null ? h >= (hungry ? 18 : 30) : aiSince(s.seen.mes, now.mes) >= (hungry ? 50 : 80);
        if (!far) continue;
        out.push({ h, id: `brn:${A.canonName(who)}:${now.day || Math.floor(now.mes / 80)}`, who: A.canonName(who), how: h >= 72 ? 'call' : 'text', why: 'давно не виделись: скучает и хочет знать, как дела' });
    }
    return out.sort((a, b) => b.h - a.h).slice(0, 1).map(({ h, ...x }) => x);
}

// ───────────── темперамент из карточки и лорбука ─────────────

const COLLECT_SYS = `Ты настраиваешь «код-мозг» персонажа ролевой истории: его психику дальше считает программа, а не модель. По карточке, ядру характера и записям лорбука выпиши ТЕМПЕРАМЕНТ и КАССЕТЫ ПОВЕДЕНИЯ. Ответь только одним JSON по-русски:
{"note":"1–2 предложения: что у него за психика, главное","base":{"val":0,"aro":0,"ctl":0,"wor":0},"react":1,"recover":1,"grit":1,"wit":1,"sens":{"warm":1,"threat":1,"blow":1,"bound":1,"wrong":1,"loss":1},"cass":{"fear":["","","",""],"anger":["","","",""],"shame":["","","",""],"low":["","",""],"tender":["","",""],"playful":["",""],"brk":"","hang":"","care":"","night":"","leak":""},"fix":[""],"beliefs":[{"t":"","truth":""}],"dates":[{"md":"ММ-ДД","t":"","kind":"loss"}],"want":{"bond":1,"safe":1,"free":1,"need":1,"quiet":1,"novel":1},"attach":"guard","reject":1,"booze":1,"spine":{"goal":"","need":"","view":"","fear":"","face":""},"drunk":"","hung":""}
base — его обычное состояние в спокойный день, каждая ось от −30 до 30 (0 — обычный человек): val — мрачность (минус) или тепло (плюс); aro — вялость (минус) или взведённость (плюс); ctl — чувство беспомощности (минус) или контроля над собой и ситуацией (плюс; у обученных бойцов и лидеров 20–30); wor — стыд и вина за себя (минус) или самоуважение (плюс).
react — как сильно его задевают события: 0.7 толстокожий, 1 обычный, 1.4 оголённый нерв. recover — как быстро отходит: 0.6 долго носит в себе, 1 обычно, 1.6 отходчивый. grit — запас воли держать лицо и делать трудное: 0.7 мало, 1 обычно, 1.6 железная выдержка. wit — насколько он вообще шутит: 0 — никогда, 1 — как все, 1.8 — шутит всегда, в том числе когда плохо.
sens — больные места, множитель от 0.6 до 1.5 (1 — как у всех; 1.5 — редкость, только для главной раны): warm — насколько на него действует тепло и похвала (ниже 1, если не верит хорошему о себе); threat — угроза и опасность; blow — удары по самооценке, стыд, напоминание о худшем в нём; bound — потеря контроля: решают за него, фиксируют, лишают выбора; wrong — несправедливость, ложь, задели близкого; loss — утрата, разлука, отвержение.
Не преувеличивай: тяжёлое прошлое не значит, что он всё время на грани. Взрослый человек, который живёт с этим годами, в обычный день держится ровно.
cass — кассеты: КАК ИМЕННО ОН ведёт себя на каждой ступени чувства, от слабой к сильной (fear — страх, anger — злость, shame — стыд и вина: по 4 ступени; low — тоска, tender — нежность: по 3; playful — кураж: 2). Каждая строка 10–28 слов: конкретные жесты, речь, привычки, что делает руками и голосом, куда уходит — ЕГО, из карточки и лорбука, а не «человек вообще». Не начинай строку с названия чувства. Ступени различаются и нарастают; сильная ступень — не истерика, если он не такой. Одной строкой: brk — как выглядит ЕГО срыв, когда запас кончился; hang — каким он бывает после срыва; care — как у него выглядит тревога за близкого (опека, контроль, проверки); night — каким он бывает утром после плохой ночи или кошмара; leak — как у него проступает то, что он прячет. Настоящее время, без имени в начале, без слова «ступень» и без цифр.
fix — 3–6 вещей, которые возвращают его в себя, когда плохо (по 1–4 слова, из лорбука: голос близкого, счёт вслух, дело для рук, холодная вода…). beliefs — 1–3 глубинных убеждения о себе, с которыми он живёт и которые мешают принимать хорошее: t — его словами, 2–6 слов («я испорченный»); truth — что станет его правдой, если убеждение сломается, 3–10 слов. dates — дни в году, которые он помнит телом (годовщина гибели, день, когда всё сломалось): md — месяц и день «ММ-ДД», t — что это за день, 2–6 слов, kind — loss (утрата) или blow (вина, стыд). Только если в записях есть точные день и месяц; не выдумывай — иначе [].
want — насколько ему нужна каждая потребность, от 0.6 до 1.5 (1 — как всем): bond — близость и прикосновения; safe — безопасность и контроль над обстановкой; free — свобода решать самому; need — быть нужным и полезным; quiet — тишина и покой от людей (выше у замкнутых); novel — новизна и движение (выше у тех, кому скучно в покое).`;

const DEPTH_RULE = `
attach — КАК он привязывается к своим людям (одно слово из списка): fuse — намертво: залипает целиком, свой человек становится центром, без него не живёт, а пережидает; guard — сторож: любит охраной и делом, о чувствах молчит, считает, что такого не заслуживает; armor — в броне: держит на длину руки шуткой и делом, но замечает всё и приходит первым; fix — чинит: любит через решения, подарки и контроль обстановки, двигатель — вина; test — проверяет: колет и дразнит, проверяя, останутся ли, страх выдаёт за злость; serve — жертвует собой: ставит себя между своим и бедой, свои нужды не считает; secure — спокойно и ровно, без надрыва (редкость у травмированных). reject — рана отвержения: насколько он заранее ждёт, что его бросят или предадут, от 0.6 до 1.8 (1 — как все; 1.4 и выше — у брошенных, преданных, выращенных как оружие). booze — как его берёт алкоголь: 0.6 — пьянеет с бокала, 1 — как всех, 1.5 — привычный, 3–5 — сверхчеловеческий обмен (суперсолдат): почти не берёт.
spine — стержень, каждое поле его голосом и из его истории, а не общими словами: goal — чего он добивается всей своей жизнью ПО ЕГО МНЕНИЮ (4–12 слов); need — что ему нужно НА САМОМ ДЕЛЕ и чего он сам не видит (4–12 слов; с goal не совпадает и часто ему противоречит: goal обычно растёт из его убеждения о себе — он думает, что это его вылечит, — а need — правда, которая это убеждение отменяет); view — как, по его мнению, устроены мир и люди (одна фраза); fear — чего он боится больше всего (3–8 слов); face — каким хочет выглядеть в чужих глазах (3–8 слов).
drunk — какой он пьяный, 10–28 слов: что делает, как говорит, куда его несёт (если его почти не берёт — так и напиши); hung — какой он с похмелья, 8–20 слов.`;

const DEPTH_SYS = `Ты дополняешь «код-мозг» персонажа ролевой истории. По карточке, ядру характера, лорбуку (и своду всей истории, если он дан) выпиши то, чего в его настройках ещё нет. Ответь только одним JSON по-русски:
{"attach":"guard","reject":1,"booze":1,"spine":{"goal":"","need":"","view":"","fear":"","face":""},"drunk":"","hung":""}` + DEPTH_RULE;

const STORY_RULE = `
Тебе дан «Свод всей истории» — что с ним было и как он себя вёл на самом деле. Он важнее общих слов карточки: кассеты пиши с его настоящих жестов и фраз из истории; fix — то, что его на деле успокаивало; beliefs — то, что он о себе говорил и чем жил; sens и base — по тому, что его по-настоящему ранило и каким он был в спокойные дни, а не в последней сцене; dates — и дни из самой истории, которые он будет помнить телом (утрата, день, когда чуть не потерял близкого). Разовое состояние последних дней за характер не принимай.`;

/** Всё, что известно о человеке вне чата: ядро характера, карточка, лорбук — одним текстом для сбора. */
async function sourcesOf(name) {
    const L = A.lore || {};
    let card = safe(() => L.card?.(name, 5000) || '', '');
    if (!card) { const ch = safe(() => A.cardOf?.(name), null); card = [ch?.description, ch?.personality, ch?.data?.description].filter(Boolean).join('\n').slice(0, 5000); }
    const core = safe(() => L.core?.(name) || '', '');
    let lore = '';
    try { lore = (await L.about?.(name, { max: 12000 })) || ''; } catch { /* */ }
    if (!card && !lore && !core) throw new Error('ни карточки, ни лорбука о нём не нашлось');
    return [`Персонаж: ${name}`, core ? `Ядро характера:\n${core}` : '', card ? `Карточка:\n${card}` : '', lore ? `Лорбук:\n${lore}` : ''].filter(Boolean).join('\n\n');
}
/** Способ привязываться, рана отвержения, алкоголь, стержень — из ответа модели в темперамент. Заданное раньше не затирается. */
function applyDepth(x, j) {
    const id = styleId(j?.attach);
    if (!x.attach && id) x.attach = id;
    if (!x.seeded && num(x.v) < TEMPER_V) {
        if (Number.isFinite(+j?.reject)) x.reject = P.clamp(j.reject, 0.6, 1.8);
        if (Number.isFinite(+j?.booze)) x.booze = P.clamp(j.booze, 0.5, 5);
    }
    x.spine = x.spine && typeof x.spine === 'object' ? x.spine : {};
    for (const k of SPINE_KEYS) if (!x.spine[k]) x.spine[k] = str(j?.spine?.[k], 180);
    for (const k of ['drunk', 'hung']) { const own = str(j?.[k] ?? j?.cass?.[k], 320); if (own.length > 8 && !str(x.cass?.[k])) x.cass = { ...x.cass, [k]: own }; }
    x.v = TEMPER_V;
}
/** Дособрать только новое (способ привязываться, стержень, алкоголь) — у тех, чей темперамент собран раньше. Остального не трогает. */
async function topUp(who) {
    const name = A.canonName(who);
    const usr = await sourcesOf(name);
    const whole = safe(() => !!A.story?.ready(), false);
    const check = { check: (x) => !!x && typeof x === 'object' && (!!x.spine || !!x.attach), what: 'Стержень' };
    const msgs = [{ role: 'system', content: DEPTH_SYS + (whole ? '\nТебе дан «Свод всей истории»: он важнее общих слов карточки — стержень и манеру бери из того, что он на деле делал и говорил.' : '') }, { role: 'user', content: usr }];
    const j = whole && A.askFillJson ? await A.askFillJson(msgs, 1800, check, { who: name, max: 14000 }) : await A.askJson(msgs, 1000, check);
    editTemper(name, (x) => applyDepth(x, j));
    return temperOf(name);
}

async function collect(who) {
    const name = A.canonName(who);
    const usr = await sourcesOf(name);
    // есть свод всей истории (Life 0.59) — он идёт в запрос, а считает умная модель: кассеты и больные места берутся
    // из того, как человек на самом деле вёл себя за всю историю, а не из последних постов и общих слов карточки
    const whole = safe(() => !!A.story?.ready(), false);
    const check = { check: (x) => !!x && typeof x === 'object' && (!!x.cass || !!x.base), what: 'Темперамент' };
    const msgs = [{ role: 'system', content: COLLECT_SYS + DEPTH_RULE + (whole ? STORY_RULE : '') }, { role: 'user', content: usr }];
    const j = whole && A.askFillJson ? await A.askFillJson(msgs, 8000, check, { who: name, max: 18000 }) : await A.askJson(msgs, 4200, check);
    const old = temperOf(name);
    const t = editTemper(name, (x) => {
        for (const a of P.AXES) x.base[a] = Math.round(P.clamp(j.base?.[a] ?? x.base[a], -30, 30));
        x.react = P.clamp(j.react ?? 1, 0.7, 1.4);
        x.recover = P.clamp(j.recover ?? 1, 0.6, 1.6);
        x.grit = P.clamp(j.grit ?? 1, 0.7, 1.6);
        x.wit = P.clamp(j.wit ?? 1, 0, 2);
        for (const k of Object.keys(x.sens)) x.sens[k] = P.clamp(j.sens?.[k] ?? 1, 0.6, 1.5);
        for (const k of P.DRIVES) x.want[k] = P.clamp(j.want?.[k] ?? 1, 0.6, 1.5);
        const cass = cleanCass(j.cass);
        if (Object.keys(cass).length) x.cass = { ...x.cass, ...cass };
        // что возвращает, убеждения и даты: собранное не затирает то, что уже есть (ты могла править руками)
        if (!x.fix.length) x.fix = arr(j.fix);
        if (!x.beliefs.length) x.beliefs = arr(j.beliefs).map(b => ({ t: str(b?.t, 90), truth: str(b?.truth, 140) })).filter(b => b.t);
        if (!x.dates.length) x.dates = arr(j.dates);
        x.note = str(j.note, 400);
        applyDepth(x, j);
        x.src = 'lore';
        x.story = whole;       // собран со сводом всей истории
    });
    cfg().prof[keyOf(name)] = P.normTemper(t);
    saveCfg();
    // характер в этом чате сдвигается вместе с темпераментом (накопленный дрейф остаётся)
    const s = stateOf(name);
    for (const a of P.AXES) s.base[a] = P.clamp(s.base[a] + (t.base[a] - old.base[a]), -100, 100);
    saveM();
    backfill(name);
    return temperOf(name);
}

/**
 * Память с чувством — задним числом: что человек пережил за ВСЮ историю (из свода Life), ложится метками,
 * чтобы старое могло всплывать, а не только случившееся после установки мозга. Запросов к модели нет.
 */
function backfill(who) {
    const felt = safe(() => A.story?.felt?.(who, 2) || [], []);
    const s = stateOf(who);
    if (!felt.length) return 0;
    let n = 0;
    // сильное — всё; заметное — последние: в памяти сорок мест, и слабое с давним она вытесняет сама
    const pick = [...felt.filter(f => f.w >= 3), ...felt.filter(f => f.w === 2).slice(-14)].sort((a, b) => a.mes - b.mes);
    for (const f of pick) if (P.mark(s, { mes: Math.max(0, num(f.mes)), day: f.day, t: f.t, emo: f.emo, w: f.w })) n++;
    s.filled = true;
    saveM();
    return n;
}

let ensuring = false;
/** Фоном, когда открыт чат: у главных без темперамента — собрать по одному (раз в шесть часов на попытку). */
async function ensure() {
    // круг «своих» и способы привязываться по умолчанию — без запросов к модели, поэтому и при выключенном автосборе
    if (on()) { safe(() => syncCircle()); for (const who of list()) safe(() => seedTemper(who)); }
    if (ensuring || !on() || cfg().auto === false || !A.askJson) return;
    ensuring = true;
    try {
        for (const who of list()) {
            const k = keyOf(who);
            const c = cfg();
            const whole = safe(() => !!A.story?.ready(), false);
            if (whole && !stateOf(who).filled) safe(() => backfill(who));
            // собран по карточке без свода, а свод с тех пор появился — один раз пересобрать по всей истории (руками правленое не трогаем)
            const redo = whole && c.prof[k]?.src === 'lore' && !c.prof[k].story;
            if (c.prof[k]?.src && c.prof[k].src !== 'auto' && !redo) {
                // темперамент собран до 0.8 — дособрать только новое: способ привязываться, стержень, алкоголь
                if (num(c.prof[k].v) < TEMPER_V && Date.now() - num(c.tried[`${k}:d`]) >= 6 * 36e5) {
                    c.tried[`${k}:d`] = Date.now();
                    saveCfg();
                    try {
                        await topUp(who);
                        A.toast('success', `${esc(short(who))}: дособраны стержень, способ привязываться и кассеты «под градусом» и «с похмелья». Посмотреть и поправить — Сцена → ${TITLE}.`, TITLE, { timeOut: 6000, escapeHtml: false });
                        safe(() => A.updatePrompt());
                        refresh();
                    } catch (e) { console.warn(`[Мозг] стержень ${who}`, e); }
                }
                continue;
            }
            if (Date.now() - num(c.tried[k]) < 6 * 36e5) continue;
            c.tried[k] = Date.now();
            saveCfg();
            try {
                await collect(who);
                A.toast('success', `${esc(short(who))}: темперамент и кассеты собраны ${temperOf(who).story ? 'по всей истории, карточке и лорбуку' : 'по карточке и лорбуку'}. Посмотреть и поправить — Сцена → ${TITLE}.`, TITLE, { timeOut: 6000, escapeHtml: false });
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
const LOG_ICON = { drink: '🥃', brk: '⚡', hand: '✋', fix: '🫶', night: '🌙', init: '👣', bel: '🧱' };
function logRow(e) {
    const kinds = e.hits ? Object.entries(e.hits).map(([k, n]) => `${KIND_NAME[k]} ${n}`).join(', ') : '';
    const head = LOG_ICON[e.src] || `#${e.mes}`;
    const tags = [e.by ? `от ${e.by}` : '', ...arr(e.tags).map(x => TAG_NAME[x]).filter(Boolean)].filter(Boolean).join(' · ');
    return `<div class="brn-log"><span>${head}</span><div><b>${esc(kinds || e.why || '')}</b>${kinds && e.why ? `<small>${esc(e.why)}</small>` : ''}${tags ? `<small class="tag">${esc(tags)}</small>` : ''}${e.d ? `<small class="d">${esc(deltaText(e.d))}</small>` : ''}</div></div>`;
}

/** Подсказки игроку: что сработает, что добьёт, чего ждать. Модель их не видит. */
function hintsHtml(v, who) {
    const here = present();
    const fore = v.s.brk ? {} : P.forecast(v.s, v.t, loadOf(v.sig), v.sig.off);
    const dear = v.sig.dear;
    const lastI = A.chatArr().length - 1;
    // кто обычно утоляет то, чего ему сейчас больше всего не хватает
    const low = P.DRIVES.map(k => [k, v.s.dr[k]]).sort((a, b) => a[1] - b[1])[0];
    const fed = Object.entries(v.s.feed || {}).map(([n, f]) => [n, num(f[low[0]])]).filter(x => x[1] >= 15).sort((a, b) => b[1] - a[1])[0];
    const h = hints({
        s: v.s, t: v.t, dom: v.dom, leak: P.leakOf(v.s, v.sig.loose), fore, apart: !!here.length && !inScene(who, here),
        dear: dear ? { name: short(dear.to), st: dear.st, sour: dear.t.sour, cosmic: !!dear.t.cosmic } : null, mine: !!dear && A.sameName(dear.to, user()), haven: !!v.sig.haven,
        worry: !!v.sig.worry, grudge: Object.entries(v.s.grudge || {}).filter(x => x[1] >= 30).map(x => short(x[0])),
        hurt: v.s.hurtBy && lastI - num(v.s.hurtBy.mes) <= 8 ? v.s.hurtBy.kind : '',
        feeder: fed ? { name: short(fed[0]), drive: low[0] } : null,
        booze: v.sig.booze ? { stage: v.sig.booze.stage, hung: v.sig.booze.hung, blank: v.sig.booze.blank } : null,
        spine: mech('spine') && hasSpine(v.t.spine) ? v.t.spine : null,
        ease: mech('style') ? STYLE_EASE[styleId(v.t.attach)] || '' : '',
        mute: v.combo.some(c => c.id === 'mute') ? STYLE_OBJECT[styleId(v.t.attach)] || 'mute' : '',
    });
    if (!h.help.length && !h.hurt.length && !h.expect.length) return '';
    const grp = (cls, ico, title, rows) => (rows.length ? `<div class="brn-hint ${cls}"><b>${ico} ${title}</b>${rows.map(r => `<span>${esc(r)}</span>`).join('')}</div>` : '');
    return `${A.sec('Подсказки тебе', 'модель их не видит')}<div class="brn-hints">${grp('ok', '✓', 'Сработает', h.help)}${grp('no', '✕', 'Добьёт', h.hurt)}${grp('eta', '⏳', 'Чего ждать', h.expect)}</div>`;
}

/** Потребности: шесть шкал «сыт — голоден» и то, что из них сейчас выходит. Тап — утолить. */
/** «К кому как»: привязанности и умные статы пары — что любовь сейчас делает с тем, что от этого человека приходит. */
function bondsHtml(v, who) {
    const list = bondsOf(who, v.s, v.E, v.t).filter(b => b.t.L >= 0.2).slice(0, 3);
    if (!list.length) return '';
    const kind = (b) => (b.t.cosmic ? 'космическая' : b.t.love >= 0.5 ? 'любовь' : b.t.L >= 0.5 ? 'свой человек' : 'привязанность');
    const own = mech('style');
    const sty = own ? STYLES[styleId(v.t.attach)] : null;
    const opt = (val, cur, label) => `<option value="${val}"${val === cur ? ' selected' : ''}>${esc(label)}</option>`;
    const tropeRow = (b) => {
        if (!own) return '';
        const tr = b.tr || { id: '', rom: 'no' };
        return `<div class="brn-trope"><select data-bin="tr" data-who="${esc(who)}" data-to="${esc(b.to)}" aria-label="Троп пары">${opt('', tr.id, 'троп не задан')}${TROPE_IDS.map(k => opt(k, tr.id, TROPES[k].name)).join('')}</select><select data-bin="rom" data-who="${esc(who)}" data-to="${esc(b.to)}" aria-label="Романтика"${tr.id ? '' : ' disabled'}>${Object.entries(ROM_NAME).map(([k, l]) => opt(k, tr.rom || 'no', l)).join('')}</select></div>
            ${TROPES[tr.id] ? `<div class="lf-hint">${esc(cap(TROPES[tr.id].dyn))}. Под давлением: ${esc(TROPES[tr.id].dark)}.</div>` : ''}`;
    };
    const row = (b) => {
        const fed = Object.entries(v.s.feed?.[b.to] || {}).filter(([, x]) => x >= 15).sort((a, c) => c[1] - a[1]).slice(0, 2).map(([k]) => DRIVE_NAME[k].toLowerCase());
        return `<div class="brn-bond">
            <div class="brn-bond-h">${A.ava(b.to, 'sm')}<b>${esc(short(b.to))}</b><small>${kind(b)}${b.t.sour >= 0.5 ? ' · накопилось' : ''}${num(v.s.grudge?.[b.to]) >= 30 ? ' · обида' : ''}</small></div>
            <div class="brn-bond-s">${PAIR_STAT.map(([k, l]) => `<span><em>${l}</em><i><u style="width:${b.st[k]}%"></u></i><small>${b.st[k]}</small></span>`).join('')}</div>
            ${fed.length ? `<div class="lf-hint">Рядом с ${esc(short(b.to))} растёт: ${esc(fed.join(', '))}.</div>` : ''}
            ${tropeRow(b)}
        </div>`;
    };
    return `${A.sec('К кому как', 'считается каждый пост')}
        ${sty ? `<div class="brn-style"><b>Привязывается: ${esc(sty.name)}</b><small>${esc(sty.how)}${rejectOf(v.t) >= 1.3 ? ' · рана отвержения: заранее ждёт, что бросят' : ''}</small></div>` : ''}
        <div class="brn-bonds">${list.map(row).join('')}</div>
        <div class="lf-hint">Шкалы пары — из «Отношений» Life. Здесь — что из них выходит прямо сейчас.</div>
        <details class="lf-details" ${det('circle')}><summary>Свои <small>космическая привязанность · ${circle().length ? esc(circle().join(', ')) : 'никого'}</small></summary>
            <div class="lf-field"><label>Кто между собой «свои» — по имени на строку</label><textarea rows="5" data-bin="circle">${esc(circle().join('\n'))}</textarea></div>
            <div class="lf-hint">Между «своими» привязанность не меняется, что бы ни случилось: удар от своего болит по-настоящему, но обидой не оседает и ничего не меняет в том, что он для него сделает. Ради своего нарушают собственные правила и не умеют отпускать. В «Отношениях» Life им сами ставятся любовь и близость по сто под замок. Тем, кто не «свой», предательство не прощают — остаётся обида.</div>
        </details>`;
}
function drivesHtml(v, who) {
    return `${A.sec('Потребности', 'тап — утолить')}
        <div class="brn-drs">${P.DRIVES.map(k => {
            const x = v.s.dr[k], b = driveBand(x);
            return `<button class="brn-dr b${b}" data-bact="feed" data-k="${k}" data-d="20" data-who="${esc(who)}"><span>${DRIVE_ICON[k]} ${DRIVE_NAME[k]}</span><i><u style="width:${Math.round(x)}%"></u></i><small>${BAND_NAME[b]}</small></button>`;
        }).join('')}</div>
        ${v.combo.length ? `<div class="lf-hint">Сейчас из этого выходит: ${esc(v.combo.slice(0, 2).map(c => c.t).join('; '))}.</div>` : ''}`;
}

/** Память с чувством: что запомнилось сильным и всплывает в тон настроению. */
function marksHtml(s, who) {
    const rows = arr(s.marks).slice(-6).reverse();
    if (!rows.length) return '';
    return `${A.sec('Память с чувством', 'всплывает в тон')}
        <div class="brn-marks">${rows.map(m => `<div class="brn-mark"><span>${EMO_ICON[m.emo] || ''}</span><div><b>${esc(m.t)}</b><small>${esc(m.day || `#${m.mes}`)} · ${esc((EMO_TITLE[m.emo] || '').toLowerCase())}</small></div><button class="lf-iconbtn" data-bact="unmark" data-id="${esc(m.id)}" data-who="${esc(who)}">✕</button></div>`).join('')}</div>`;
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
    const whole = safe(() => !!A.story?.ready(), false);
    const srcName = { auto: 'обычный человек — ещё не собран', lore: t.story ? 'собран по всей истории, карточке и лорбуку' : 'собран по карточке и лорбуку', hand: 'поправлен руками' }[t.src];
    const area = (bin, k, rows, val, ph = '') => `<textarea rows="${rows}" data-bin="${bin}" data-k="${k}" data-who="${esc(who)}" placeholder="${esc(ph)}">${esc(val)}</textarea>`;
    return `<details class="lf-more brn-more" ${det('t')}><summary>Темперамент и кассеты — ${srcName}</summary>
        ${t.note ? `<div class="lf-hint">${esc(t.note)}</div>` : ''}
        <button class="lf-btn full" data-bact="collect" data-who="${esc(who)}">${A.icon ? A.icon('refresh') : ''} ${whole ? 'Собрать по всей истории' : 'Собрать из карточки и лорбука'}</button>
        ${whole ? '' : `<div class="lf-hint">Свод всей истории ещё не собран (Life → Мир → Свод): пока темперамент пишется только по карточке и лорбуку. Со сводом кассеты берутся из того, как он на самом деле вёл себя за всю историю, а пережитое ложится в память с чувством.</div>`}
        ${A.sec('В спокойный день')}
        ${P.AXES.map(a => range(who, `base.${a}`, t.base[a], -45, 45, 1, `${AX_NAME[a][0]} ↔ ${AX_NAME[a][1]}`)).join('')}
        ${A.sec('Как устроен')}
        ${range(who, 'react', t.react, 0.4, 2, 0.1, 'Насколько задевает', 'ниже — толстокожий, выше — оголённый нерв')}
        ${range(who, 'recover', t.recover, 0.4, 2.5, 0.1, 'Как быстро отпускает', 'ниже — долго носит в себе')}
        ${range(who, 'grit', t.grit, 0.4, 2, 0.1, 'Запас воли', 'сколько может держать лицо и как быстро она возвращается')}
        ${range(who, 'wit', t.wit, 0, 2, 0.1, 'Юмор', '0 — не шутит никогда, 2 — шутит всегда и обо всём; каким юмором — решает состояние')}
        ${A.sec('Как привязывается', 'к своим')}
        <div class="lf-field"><select data-bin="ts" data-k="attach" data-who="${esc(who)}" aria-label="Как привязывается"><option value="">не задано</option>${STYLE_IDS.map(k => `<option value="${k}"${styleId(t.attach) === k ? ' selected' : ''}>${esc(STYLES[k].name)}</option>`).join('')}</select></div>
        ${STYLES[styleId(t.attach)] ? `<div class="lf-hint">${esc(cap(STYLES[styleId(t.attach)].how))}. Когда связь под угрозой — ${esc(STYLES[styleId(t.attach)].kind)}.</div>` : ''}
        ${range(who, 'reject', t.reject, 0.5, 2, 0.1, 'Рана отвержения', '1 — как у всех; выше — заранее ждёт, что бросят: сильнее боится потерять, ревнует, уход читает громче')}
        ${A.sec('Стержень', 'чем живёт')}
        ${SPINE_KEYS.map(k => `<div class="lf-field"><label>${SPINE_NAME[k]}</label><textarea rows="2" data-bin="sp" data-k="${k}" data-who="${esc(who)}">${esc(t.spine[k])}</textarea></div>`).join('')}
        ${A.sec('Алкоголь')}
        ${range(who, 'booze', t.booze, 0.4, 6, 0.1, 'Как берёт', '0.6 — пьянеет с бокала, 1 — как всех, 4 и выше — суперсолдат: почти не берёт, похмелья нет')}
        ${A.sec('Больные места', '1 — как у всех')}
        ${Object.keys(t.sens).map(k => range(who, `sens.${k}`, t.sens[k], 0.3, 2.5, 0.1, KIND_NAME[k])).join('')}
        ${A.sec('Чего сколько надо', 'потребности')}
        ${P.DRIVES.map(k => range(who, `want.${k}`, t.want[k], 0.4, 1.8, 0.1, `${DRIVE_ICON[k]} ${DRIVE_NAME[k]}`)).join('')}
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

/** Пьян или с похмелья: полоска «сколько в нём» и что это с ним делает. */
function boozeHtml(v, who) {
    const bz = v.sig.booze;
    if (!bz) return '';
    const bac = Math.round(num(v.s.bac));
    const drunk = bz.stage ? `<b>🥃 ${esc(cap(STAGE_NAME[bz.stage]))}</b><small>${esc(DRUNK[bz.stage].split(': ').slice(1).join(': '))}${bz.heavy ? ' Сейчас спиртное раздувает тяжёлое.' : ''}</small>` : '';
    const hung = bz.hung ? `<b>🤕 ${bz.hung === 2 ? 'Тяжёлое похмелье' : 'Похмелье'}</b><small>ещё ~${Math.max(1, Math.round(num(v.s.hung?.left)))} ч истории: плохое бьёт сильнее, сил держать лицо меньше${bz.blank ? '; вчерашний вечер помнит кусками' : ''}</small>` : '';
    return `<div class="brn-booze">${drunk}${bz.stage && bac ? `<i><u style="width:${bac}%"></u></i>` : ''}${hung}</div>`;
}
/** Стержень: чего добивается по его мнению и что ему нужно на самом деле. */
function spineHtml(v) {
    const sp = v.t.spine;
    if (!mech('spine') || !hasSpine(sp)) return '';
    const row = (k, label) => (sp[k] ? `<div><small>${label}</small><b>${esc(sp[k])}</b></div>` : '');
    return `${A.sec('Стержень', 'правится в темпераменте')}<div class="brn-spine">${row('goal', 'Добивается')}${row('need', 'На деле нужно')}${row('view', 'Мир видит так')}${row('fear', 'Боится')}${row('face', 'Хочет выглядеть')}</div>`;
}

/** Персонаж игрока под градусом или с похмелья: что видят боты и подсказка игроку. */
function meHtml() {
    if (!mech('booze')) return '';
    const me = meNow();
    if (!me) return '';
    const U = esc(short(user()));
    const bac = Math.round(num(me.s.bac));
    const title = me.stage ? STAGE_NAME[me.stage] : me.hung === 2 ? 'тяжёлое похмелье' : 'с похмелья';
    const seen = me.stage ? SEEN[me.stage] : SEEN_HUNG[me.hung];
    const tips = playerTips(me.s, meTol());
    return `<div class="brn-booze brn-me"><b>${me.stage ? '🥃' : '🤕'} ${U}: ${esc(title)}</b>
        ${me.stage && bac ? `<i><u style="width:${bac}%"></u></i>` : ''}
        <small>Ботам уходит только то, что видно со стороны: ${esc(seen)}. Как ${U} себя ведёт — решаешь ты.</small>
        ${tips.length ? `<small class="tip"><b>Подсказка.</b> ${esc(cap(tips.join('; ')))}.</small>` : ''}
        <div class="lf-chips"><button class="lf-chip" data-bact="me-drink">налить ещё</button><button class="lf-chip" data-bact="me-sober">протрезвить</button></div></div>`;
}

function cardHtml(who) {
    const v = view(who);
    const { s, t, dom, sig } = v;
    const W = esc(short(who));
    if (t.on === false) {
        return `<div class="brn-card"><div class="brn-top">${A.ava(who, 'md')}<div><b>${W}</b><small>мозг выключен — состояние ведёт Летописец, как раньше</small></div></div>
            <label class="lf-switch"><input type="checkbox" data-bin="on" data-who="${esc(who)}"><span></span>${W}: включить код-мозг</label></div>`;
    }
    const bzTop = sig.booze;
    const title = s.brk ? 'срыв' : dom.id ? domLabel(dom) : s.hang ? 'после срыва' : bzTop?.stage ? STAGE_NAME[bzTop.stage] : bzTop?.hung ? 'с похмелья' : 'ровно';
    const sub = s.brk ? cassText(t, 'brk') : dom.id ? cassOf(t, dom.id, dom.step) : s.hang ? cassText(t, 'hang') : bzTop?.stage ? drunkText(t, bzTop) : bzTop?.hung ? hungText(t, bzTop) : 'ничего не давит — модели про состояние ничего не уходит';
    const steps = dom.id && !s.brk ? `<span class="brn-steps">${Array.from({ length: P.EMO_STEPS[dom.id] }, (_, k) => `<i class="${k < dom.step ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const band = P.willBand(s.will);
    const leak = P.leakOf(s, sig.loose);
    const logs = s.log.slice(-7).reverse();
    return `<div class="brn-card${s.brk ? ' brk' : ''}">
        <div class="brn-top">${auraHtml(who, 'md', v)}<div><b>${s.brk ? '⚡' : EMO_ICON[dom.id] || ''} ${esc(cap(title))}</b>${steps}<small>${esc(sub)}</small></div></div>
        ${s.brk ? `<div class="brn-warn">В следующем ответе это прорвётся.${s.brk.why ? ` Последняя капля: ${esc(s.brk.why)}.` : ''}<button class="lf-btn small" data-bact="unbrk" data-who="${esc(who)}">отменить срыв</button></div>` : ''}
        ${s.hang && !s.brk ? '<div class="brn-warn soft">После срыва: сил на маску нет, плохое бьёт больнее обычного.</div>' : ''}
        ${boozeHtml(v, who)}
        <div class="brn-axes">${P.AXES.map(a => axisRow(a, v)).join('')}</div>
        <div class="brn-two">${bar('Воля', s.will, `will b${band}`, WILL_NAME[band])}${bar('Напряжение', s.strain, `strain${s.strain >= 75 ? ' hot' : ''}`, s.strain >= 75 ? 'сырые нервы' : s.strain >= 50 ? 'копится' : '')}</div>
        ${bar('Несказанное', s.mask, `mask l${leak}`, LEAK_NAME[leak])}
        ${hintsHtml(v, who)}
        ${drivesHtml(v, who)}
        ${bondsHtml(v, who)}
        ${spineHtml(v)}
        ${A.sec('Почему так')}
        ${sig.list.length ? `<div class="lf-chips wrap brn-sig">${sig.list.map(x => `<span class="lf-chip">${esc(x.text)}</span>`).join('')}</div>` : ''}
        ${logs.length ? `<div class="brn-logs">${logs.map(logRow).join('')}</div>` : `<div class="lf-hint">${sig.list.length ? '' : 'Пока ничего не случилось. '}События появятся после ответа: Летописец назовёт, что с ним произошло, а посчитает код.</div>`}
        ${beliefsHtml(v)}
        ${t.fix.length ? `${A.sec('Что возвращает')}<div class="lf-chips wrap brn-sig">${t.fix.map(f => `<span class="lf-chip">${esc(f)}</span>`).join('')}</div>` : ''}
        ${marksHtml(s, who)}
        ${chartHtml(s)}
        ${A.sec('Руками', 'сдвинуть сейчас')}
        <div class="lf-chips wrap">${NUDGE.map(([k, l]) => `<button class="lf-chip" data-bact="nudge" data-k="${k}" data-who="${esc(who)}">${l}</button>`).join('')}<button class="lf-chip" data-bact="rest" data-who="${esc(who)}">дать выспаться</button>${mech('booze') ? `<button class="lf-chip" data-bact="drink" data-who="${esc(who)}">налить</button>${num(s.bac) > 0 || s.hung ? `<button class="lf-chip" data-bact="sober" data-who="${esc(who)}">протрезвить</button>` : ''}` : ''}</div>
        ${temperHtml(who, t)}
        <label class="lf-switch"><input type="checkbox" data-bin="on" data-who="${esc(who)}" checked><span></span>${W}: код-мозг включён</label>
        <details class="lf-details" ${det('m')}><summary>Механизмы <small>для всех · выключи один — и смотри, что изменилось</small></summary>
            ${MECH.map(([k, name, what]) => `<label class="lf-switch"><input type="checkbox" data-bin="m" data-k="${k}"${mech(k) ? ' checked' : ''}><span></span>${name}<small class="brn-mech">${what}</small></label>`).join('')}
        </details>
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
        ${meHtml()}
        ${cardHtml(sel)}
        <details class="lf-more brn-more" ${det('g')}><summary>Настройки мозга</summary>
            ${sw('on', 'Мозг включён')}
            ${sw('drive', 'Вести состояние персонажа во «Внутри» Life (лица, чипы, соседние трекеры видят то же)')}
            ${sw('brk', 'Срывы: когда накопилось и держать нечем')}
            ${sw('aura', 'Ауры в Сцене')}
            ${sw('auto', 'Сам собирать темперамент по карточке и лорбуку')}
            <div class="brn-rng"><label>Сколько твоего поста видит Летописец<b data-out>${Math.round(P.clamp(c.postChars ?? 6000, 700, 20000))}</b></label><input type="range" min="700" max="20000" step="100" value="${Math.round(P.clamp(c.postChars ?? 6000, 700, 20000))}" data-bin="me" data-k="post"><small>Знаков. Сам Life показывает Летописцу только первые 700 — мозг досылает пост целиком, чтобы не терялось то, что ты написала в конце.</small></div>
            ${mech('booze') && user() ? `<div class="brn-rng"><label>Как алкоголь берёт ${esc(short(user()))}<b data-out>${meTol()}</b></label><input type="range" min="0.4" max="6" step="0.1" value="${meTol()}" data-bin="me" data-k="booze"><small>Твоего персонажа мозг не ведёт — только считает выпитое: стадию и похмелье. 0.6 — с бокала, 1 — как всех, 4 и выше — почти не берёт.</small></div>${meNow() ? '' : '<div class="lf-chips"><button class="lf-chip" data-bact="me-drink">налить</button></div>'}` : ''}
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
        const d = { ...P.hit(s, { [op.k]: 2 }, t), ...driveHit(s, { [op.k]: 2 }, t) };
        log(s, { mes, src: 'hand', why: 'руками', hits: { [op.k]: 2 }, d });
        s.why = { t: '', mes, neg: P.NEGATIVE.includes(op.k) };
    }
    if (op.act === 'rest') {
        s.will = P.clamp(s.will + 40, 0, 100);
        s.strain = P.clamp(s.strain - 30, 0, 100);
        if (s.night) s.night.bad = false;
        log(s, { mes, src: 'hand', why: 'отдых: воля +40, напряжение −30' });
    }
    if (op.act === 'reset') Object.assign(s, P.fresh(t), { at: nowStamp(), night: null, why: null, belBroke: null, recall: null, hurtBy: null, heldDay: null, jealTo: '', feed: {}, drf: {}, grudge: {}, seq: null, filled: false, bac: 0, bacPeak: 0, hung: null, blank: false, drankAt: null, swallow: null, dare: null, won: null, dr: freshDrives() });
    if (op.act === 'drink') { drink(s, 2, tolOf(t)); log(s, { mes, src: 'drink', why: `налито руками — ${STAGE_NAME[stageOf(s.bac)]}` }); }
    if (op.act === 'sober') { s.bac = 0; s.bacPeak = 0; s.hung = null; s.blank = false; log(s, { mes, src: 'hand', why: 'хмель снят руками' }); }
    if (op.act === 'feed' && P.DRIVES.includes(op.k)) { healDrives(s); s.dr[op.k] = P.clamp(s.dr[op.k] + num(op.d), 0, 100); }
    if (op.act === 'unmark') s.marks = s.marks.filter(x => x.id !== op.id);
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
        if (act === 'drink' || act === 'sober') manual(who, { act });
        if (act === 'me-drink' || act === 'me-sober') meHand(act === 'me-drink' ? 'drink' : 'sober');
        if (act === 'reset') manual(who, { act: 'reset' });
        if (act === 'feed') manual(who, { act: 'feed', k: el.dataset.k, d: Number(el.dataset.d) || 0 });
        if (act === 'unmark') manual(who, { act: 'unmark', id: el.dataset.id });
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
        if (kind === 'me' && k === 'post') { cfg().postChars = Math.round(P.clamp(el.value, 700, 20000)); saveCfg(); }
        if (kind === 'me' && k === 'booze') { cfg().meBooze = P.clamp(el.value, 0.4, 6); saveCfg(); safe(() => A.updatePrompt()); }
        if (kind === 'm' && MECH.some(x => x[0] === k)) { cfg().mech[k] = !!el.checked; saveCfg(); }
        if (kind === 'on') editTemper(who, (t) => { t.on = !!el.checked; });
        if (kind === 't') {
            const [a, b] = k.split('.');
            const val = Number(el.value);
            const old = temperOf(who);
            const t = editTemper(who, (x) => { if (b) x[a][b] = val; else x[a] = val; if (a === 'reject' || a === 'booze') x.seeded = TEMPER_V; else x.src = 'hand'; });
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
        if (kind === 'ts' && k === 'attach') editTemper(who, (t) => { t.attach = styleId(el.value); t.seeded = TEMPER_V; });
        if (kind === 'sp' && SPINE_KEYS.includes(k)) editTemper(who, (t) => { t.spine[k] = str(String(el.value || '').replace(/\s+/g, ' '), 180); t.v = TEMPER_V; });
        if (kind === 'tr') setPair(who, el.dataset.to, { id: TROPES[el.value] ? el.value : '' });
        if (kind === 'rom' && pairOf(who, el.dataset.to)) setPair(who, el.dataset.to, { rom: ROM_NAME[el.value] ? el.value : 'no' });
        if (kind === 'circle') { M().circle = linesOf(el.value).map(x => str(x, 40)).filter(Boolean).slice(0, 12); M().circleAuto = false; saveM(); relCache.clear(); syncCircle(); }   // вписано руками — эпоха круг больше не чистит
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
        chron: (i) => safe(() => chron(i), null),
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
    /** { E: оси, emo: { id, step, lvl, name }, will, strain, mask, leak, brk, hang, drunk: стадия 0…4, hung: похмелье 0…2, attach: способ привязываться, spine: стержень, dr: потребности, combo: [id], jeal, role, wit, dear: { to, L, blur, haven, fuse, dread, trope } } или null */
    view: (who) => safe(() => {
        if (!on() || !mine(who)) return null;
        const v = view(who);
        return { E: v.E, emo: { id: v.dom.id, step: v.dom.step, lvl: v.dom.lvl, name: domLabel(v.dom) }, will: Math.round(v.s.will), strain: Math.round(v.s.strain), mask: Math.round(v.s.mask), leak: P.leakOf(v.s, v.sig.loose), brk: !!v.s.brk, hang: !!v.s.hang, dr: Object.fromEntries(P.DRIVES.map(k => [k, Math.round(v.s.dr[k])])), combo: v.combo.map(c => c.id), drunk: num(v.sig.booze?.stage), hung: num(v.sig.booze?.hung), attach: mech('style') ? styleId(v.t.attach) : '', spine: mech('spine') && hasSpine(v.t.spine) ? { ...v.t.spine } : null, jeal: Math.round(num(v.s.jeal)), role: num(v.s.role), wit: v.wit || '', dear: v.sig.dear ? { to: v.sig.dear.to, L: v.sig.dear.t.L, cosmic: !!v.sig.dear.t.cosmic, trope: v.sig.dear.tr?.id || '', ...v.sig.dear.st } : null, grudge: { ...(v.s.grudge || {}) }, seq: v.s.seq ? num(v.s.seq.n) : null };
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
    /** Персонаж игрока: { drunk: стадия 0…4, hung: похмелье 0…2 } — мозг его не ведёт, только считает выпитое. */
    me: () => safe(() => { const me = meNow(); return { drunk: me?.stage || 0, hung: me?.hung || 0 }; }, { drunk: 0, hung: 0 }),
    /** Прогнать фоновую настройку сейчас: круг «своих», способы привязываться по умолчанию, сбор темперамента. */
    ensure: () => ensure(),
};

if (typeof jQuery === 'function') jQuery(() => boot()); else boot();
