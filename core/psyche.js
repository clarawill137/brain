// Код-мозг — ядро. Чистая математика психики персонажа: без Таверны, без Life, без DOM.
// Нейронка читает и пишет, код помнит и считает: сюда приходят события («удар по самооценке 2», «угроза 3»)
// и нагрузки от тела (боль, недосып), отсюда выходит состояние — четыре оси в три слоя, воля, напряжение,
// ведущая эмоция со ступенью и срыв. Этот файл не знает, кто его зовёт: переедет под любую модель как есть.
//
// Оси (−100…100):  val — мрак ↔ тепло;  aro — пусто ↔ заряд;  ctl — беспомощность ↔ контроль;  wor — стыд ↔ самоценность.
// Слои:  fast — вспышка (гаснет за час истории);  mood — настроение (держится полдня);  base — характер (ползёт неделями).

export const AXES = ['val', 'aro', 'ctl', 'wor'];
/** Потребности (считает core/drives.js): близость, безопасность, свобода, нужность, покой от людей, новизна. */
export const DRIVES = ['bond', 'safe', 'free', 'need', 'quiet', 'novel'];

/** Что может случиться с человеком. Летописец ставит силу 0–3 каждому виду. */
export const KINDS = ['warm', 'fun', 'win', 'calm', 'threat', 'blow', 'bound', 'wrong', 'loss', 'rival', 'held', 'open'];
export const NEGATIVE = ['threat', 'blow', 'bound', 'wrong', 'loss', 'rival'];

/** Сила 0–3 → единицы сдвига. */
export const STEP = [0, 10, 22, 36];

// как каждый вид события двигает оси (на единицу силы), напряжение и волю
const HIT = {
    warm: { val: 1.0, aro: 0.1, ctl: 0.25, wor: 0.55, strain: -0.5, will: 0.12 },
    fun: { val: 0.8, aro: 0.8, ctl: 0.2, wor: 0.2, strain: -0.45, will: 0.08 },
    win: { val: 0.45, aro: 0.2, ctl: 0.9, wor: 0.6, strain: -0.3, will: 0.1 },
    calm: { val: 0.3, aro: -0.85, ctl: 0.25, wor: 0, strain: -0.8, will: 0.2 },
    threat: { val: -0.5, aro: 1.0, ctl: -0.8, wor: 0, strain: 0.8, will: 0 },
    blow: { val: -0.6, aro: 0.15, ctl: -0.25, wor: -1.0, strain: 0.65, will: 0 },
    bound: { val: -0.45, aro: 0.5, ctl: -1.0, wor: -0.25, strain: 0.75, will: 0 },
    wrong: { val: -1.0, aro: 0.8, ctl: 0.1, wor: 0, strain: 0.65, will: 0 },
    loss: { val: -1.0, aro: -0.5, ctl: -0.2, wor: -0.2, strain: 0.5, will: 0 },
    // ревность: у того, кто дорог, появился кто-то ещё. Чем она станет — злостью, страхом или стыдом, — решают его оси
    rival: { val: -0.7, aro: 0.7, ctl: -0.45, wor: -0.7, strain: 0.7, will: 0 },
    held: { val: 0, aro: 0, ctl: 0, wor: 0, strain: 0.3, will: -0.5 },
    open: { val: 0.35, aro: -0.2, ctl: 0.2, wor: 0.35, strain: -0.5, will: 0.15 },   // выговорился, показал настоящее — отпускает
};
// маска — сколько он сейчас носит в себе несказанного: «сдержался» копит, «открылся» снимает
const MASK_UP = [0, 8, 16, 26];
const MASK_DOWN = [0, 14, 28, 45];

export const FAST_HL = 0.75;      // часов истории: вспышка гаснет наполовину
export const MOOD_HL = 10;        // настроение
export const STRAIN_HL = 18;      // напряжение
export const MASK_HL = 36;        // несказанное выветривается медленно
export const MOOD_SHARE = 0.35;   // какая доля события оседает в настроении
export const MUL_CAP = 1.35;      // потолок «характер × больное место»: одно событие не должно сносить человека
export const TOTAL_CAP = 2.05;    // потолок всех множителей одного события разом (характер × сырые нервы × линза привязанности)
export const JEAL_HL = 12;        // ревность остывает наполовину
export const DOM_MARGIN = 8;      // доминанта: другое чувство перехватывает, только обогнав её на столько
export const RAW_CAP = 1.5;       // потолок «сырых нервов»
export const BASE_SHARE = 0.5;    // насколько его обычное состояние считается чувством: живёт с этим годами — привык
export const WILL_REGEN = 4;      // воли в час истории
export const NIGHT_BONUS = 35;    // воли за ночь сна
export const BASE_DRIFT = 0.0008; // доля настроения, уходящая в характер за час (≈2% в сутки)
export const BASE_SPAN = 25;      // насколько характер может уйти от темперамента

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, num(v, a)));
const r1 = (v) => Math.round(v * 10) / 10;
const zero = () => ({ val: 0, aro: 0, ctl: 0, wor: 0 });

// ───────────── темперамент ─────────────

/** Обычный человек: слегка в плюсе, держит себя в руках. */
export function defaultTemper() {
    return {
        on: true,
        base: { val: 5, aro: 0, ctl: 10, wor: 5 },   // исходная точка характера
        react: 1,      // как сильно его задевает (0.5 — толстокожий, 1.8 — оголённый нерв)
        recover: 1,    // как быстро отходит (0.5 — долго носит, 2 — отходчивый)
        grit: 1,       // запас воли и как быстро она возвращается
        sens: { warm: 1, threat: 1, blow: 1, bound: 1, wrong: 1, loss: 1 },   // больные места
        cass: {},      // свои кассеты: { fear: ['…', …], …, brk: '…', hang: '…', care: '…', night: '…', leak: '…' }
        fix: [],       // что его возвращает в себя: ['её голос', 'счёт вслух', …]
        beliefs: [],   // с чем о себе живёт: [{ id, t: 'я испорченный', truth: 'что станет правдой, если сломается' }]
        dates: [],     // дни, которые помнит телом: [{ md: '12-16', t: 'что это', kind: 'loss' | 'blow' }]
        want: { bond: 1, safe: 1, free: 1, need: 1, quiet: 1, novel: 1 },   // насколько ему нужна каждая потребность
        wit: 1,        // насколько он вообще шутит (0 — никогда, 2 — шутит всегда и обо всём)
        note: '',
        src: 'auto',
    };
}

/** Привести темперамент к рабочему виду (что бы ни пришло из настроек или от модели). */
export function normTemper(t) {
    const d = defaultTemper();
    const x = t && typeof t === 'object' ? t : {};
    const out = { ...d, ...x };
    out.on = x.on !== false;
    out.base = {};
    for (const a of AXES) out.base[a] = Math.round(clamp(x.base?.[a] ?? d.base[a], -45, 45));
    out.react = r1(clamp(x.react ?? 1, 0.4, 2));
    out.recover = r1(clamp(x.recover ?? 1, 0.4, 2.5));
    out.grit = r1(clamp(x.grit ?? 1, 0.4, 2));
    out.wit = r1(clamp(x.wit ?? 1, 0, 2));
    out.sens = {};
    for (const k of Object.keys(d.sens)) out.sens[k] = r1(clamp(x.sens?.[k] ?? 1, 0.3, 2.5));
    out.want = {};
    for (const k of DRIVES) out.want[k] = r1(clamp(x.want?.[k] ?? 1, 0.4, 1.8));
    out.cass = x.cass && typeof x.cass === 'object' ? x.cass : {};
    out.fix = (Array.isArray(x.fix) ? x.fix : []).map(v => String(v || '').trim().slice(0, 80)).filter(Boolean).slice(0, 6);
    out.beliefs = (Array.isArray(x.beliefs) ? x.beliefs : []).map(b => {
        const t = String(b?.t || '').trim().slice(0, 90);
        return t ? { id: String(b.id || beliefId(t)), t, truth: String(b.truth || '').trim().slice(0, 140) } : null;
    }).filter(Boolean).slice(0, 4);
    out.dates = (Array.isArray(x.dates) ? x.dates : []).map(d => {
        const md = String(d?.md || '').match(/^(\d{1,2})-(\d{1,2})$/);
        const t = String(d?.t || '').trim().slice(0, 80);
        if (!md || !t || +md[1] < 1 || +md[1] > 12 || +md[2] < 1 || +md[2] > 31) return null;
        return { md: `${String(+md[1]).padStart(2, '0')}-${String(+md[2]).padStart(2, '0')}`, t, kind: d.kind === 'blow' ? 'blow' : 'loss' };
    }).filter(Boolean).slice(0, 6);
    out.note = typeof x.note === 'string' ? x.note.slice(0, 400) : '';
    out.src = ['auto', 'lore', 'hand'].includes(x.src) ? x.src : 'auto';
    return out;
}

/** Устойчивый короткий ключ убеждения — по его тексту (правка других строк его не сдвигает). */
export function beliefId(t) {
    let h = 2166136261;
    for (const ch of String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return `b${(h >>> 0).toString(36)}`;
}

// ───────────── состояние ─────────────

/** Новое состояние: всё спокойно, характер — в точке темперамента. */
export function fresh(temper) {
    const t = normTemper(temper);
    return { fast: zero(), mood: zero(), base: { ...t.base }, will: 85, strain: 10, mask: 0, jeal: 0, role: 0, at: null, brk: null, hang: null, dom: null, bel: {}, hist: [], marks: [], log: [] };
}

/** Починить состояние после загрузки (старый формат, пустые поля). */
export function heal(s, temper) {
    const f = fresh(temper);
    if (!s || typeof s !== 'object') return f;
    for (const L of ['fast', 'mood', 'base']) {
        if (!s[L] || typeof s[L] !== 'object') s[L] = f[L];
        for (const a of AXES) s[L][a] = num(s[L][a], f[L][a]);
    }
    s.will = clamp(s.will ?? f.will, 0, 100);
    s.strain = clamp(s.strain ?? f.strain, 0, 100);
    s.mask = clamp(s.mask ?? 0, 0, 100);
    s.jeal = clamp(s.jeal ?? 0, 0, 100);
    s.role = Math.round(clamp(s.role ?? 0, 0, 99));
    if (s.dom && typeof s.dom !== 'object') s.dom = null;
    if (!s.bel || typeof s.bel !== 'object' || Array.isArray(s.bel)) s.bel = {};
    if (!Array.isArray(s.hist)) s.hist = [];
    if (!Array.isArray(s.marks)) s.marks = [];
    if (!Array.isArray(s.log)) s.log = [];
    if (s.brk && typeof s.brk !== 'object') s.brk = null;
    if (s.hang && typeof s.hang !== 'object') s.hang = null;
    return s;
}

/** Что он чувствует сейчас: характер + настроение + вспышка (+ нагрузки тела, если дали). */
export function eff(s, off = null) {
    const out = {};
    for (const a of AXES) out[a] = Math.round(clamp(s.base[a] + s.mood[a] + s.fast[a] + num(off?.[a]), -100, 100));
    return out;
}

// ───────────── время ─────────────

/**
 * Прошло hours часов истории. load — что давит всё это время:
 *   strainIn — приток напряжения в час (боль, недосып, тревога за близкого);
 *   willMul  — множитель восстановления воли (недосып режет);
 *   willCap  — потолок воли (боль не даёт собраться);
 *   nights   — сколько ночей прошло;  sleepQ — насколько он выспался (0…1);
 *   maskIn   — приток несказанного в час (тайны, которые держит; желания, о которых молчит).
 */
export function decay(s, hours, temper, load = {}) {
    const t = normTemper(temper);
    const h = clamp(hours, 0, 24 * 30);
    if (h > 0) {
        const kf = Math.pow(0.5, h / FAST_HL);
        const km = Math.pow(0.5, h / (MOOD_HL / t.recover));
        // эмоциональная инерция (Kuppens и др., 2010): у кого с самооценкой плохо, плохое настроение переносится
        // из часа в час упорнее — «починка настроения» работает хуже. До +40% к сроку, только для минуса.
        const inert = 1 + 0.4 * clamp((-(s.base.wor + s.mood.wor) - 15) / 60, 0, 1);
        const kmNeg = Math.pow(0.5, h / (MOOD_HL / t.recover * inert));
        for (const a of AXES) {
            // характер медленно тянется за тем, чем он живёт
            const drift = s.mood[a] * Math.min(0.5, h * BASE_DRIFT);
            s.base[a] = clamp(s.base[a] + drift, t.base[a] - BASE_SPAN, t.base[a] + BASE_SPAN);
            s.fast[a] *= kf;
            s.mood[a] *= s.mood[a] < 0 ? kmNeg : km;
        }
        // напряжение: приток против естественного спада — к равновесию
        const k = Math.LN2 / (STRAIN_HL / t.recover);
        const eq = Math.max(0, num(load.strainIn)) / k;   // выше ста — значит, заполнится быстро и упрётся в потолок
        s.strain = clamp(eq + (s.strain - eq) * Math.exp(-k * h), 0, 100);
        // несказанное: держит тайны и молчит о своём — копится; иначе выветривается
        const km2 = Math.LN2 / MASK_HL;
        const meq = Math.max(0, num(load.maskIn)) / km2;
        s.mask = clamp(meq + (s.mask - meq) * Math.exp(-km2 * h), 0, 100);
        s.jeal = clamp(num(s.jeal) * Math.pow(0.5, h / JEAL_HL), 0, 100);
        // воля: возвращается сама; под напряжением — хуже
        const press = s.strain > 50 ? 1 - (s.strain - 50) / 100 : 1;
        s.will += WILL_REGEN * t.grit * num(load.willMul, 1) * press * h;
    }
    const nights = clamp(load.nights, 0, 2);
    if (nights) s.will += NIGHT_BONUS * t.grit * clamp(load.sleepQ ?? 1, 0, 1) * nights;
    s.will = clamp(s.will, 0, Math.min(100, num(load.willCap, 100)));
    return s;
}

// ───────────── события ─────────────

/** Разобрать строку Летописца: только известные виды, сила 0–3. */
export function cleanHits(row) {
    const out = {};
    if (!row || typeof row !== 'object') return out;
    for (const k of KINDS) {
        const n = Math.round(clamp(row[k], 0, 3));
        if (n > 0) out[k] = n;
    }
    return out;
}

/** Сложить два набора событий: по каждому виду — сильнейшее. */
export function mergeHits(a, b) {
    const out = { ...(a || {}) };
    for (const [k, n] of Object.entries(b || {})) out[k] = Math.max(out[k] || 0, n);
    return out;
}

/**
 * С ним это случилось. hits — { blow: 2, held: 1 }. opts.raw — множитель «сырых нервов» на плохое (от нагрузок тела).
 * Возвращает, что сдвинулось: { val, aro, ctl, wor, will, strain, mask }.
 */
export function hit(s, hits, temper, opts = {}) {
    const t = normTemper(temper);
    const d = { val: 0, aro: 0, ctl: 0, wor: 0, will: 0, strain: 0, mask: 0 };
    // сырые нервы: чем выше напряжение, тем больнее плохое; после срыва — тем более
    const raw = Math.min(RAW_CAP, num(opts.raw, 1) * (1 + Math.max(0, s.strain - 55) / 90) * (s.hang ? 1.3 : 1));
    for (const [k, n] of Object.entries(hits || {})) {
        const H = HIT[k];
        if (!H) continue;
        const u = STEP[Math.round(clamp(n, 0, 3))];
        if (!u) continue;
        const neg = NEGATIVE.includes(k);
        const own = k === 'held' ? 1 : clamp(t.react * num(t.sens[k], 1), 0.4, MUL_CAP);
        // линза привязанности (opts.kmul) — третий множитель; все вместе не выше потолка: одно событие не сносит человека
        const m = u * Math.min(TOTAL_CAP, own * (neg ? raw : 1) * clamp(opts.kmul?.[k] ?? 1, 0.2, 1.6)) * num(opts.mul, 1);
        const settle = clamp(opts.kmood?.[k] ?? 1, 0.2, 1.5);     // сколько осядет в настроении: любовь размывает плохое — оно не задерживается
        for (const a of AXES) {
            const x = H[a] * m;
            if (!x) continue;
            s.fast[a] = clamp(s.fast[a] + x, -150, 150);
            // инерция: пока настроение тяжёлое, хорошее греет минуту, а оседает вполсилы — «простил» не бывает мгновенным
            const heavy = x > 0 && s.mood[a] < -8 ? 0.5 : 1;
            s.mood[a] = clamp(s.mood[a] + x * MOOD_SHARE * heavy * settle, -120, 120);
            d[a] += x;
        }
        d.strain += H.strain * m;
        // цена «сдержался»: у отдохнувшего меньше, у вымотанного больше (opts.drain) — см. holdCost
        d.will += H.will * u * (H.will > 0 ? t.grit : clamp(opts.drain ?? 1, 0.5, 1.6));
        const lv = Math.round(clamp(n, 0, 3));
        if (k === 'held') d.mask += MASK_UP[lv];
        if (k === 'open') d.mask -= MASK_DOWN[lv];
    }
    s.mask = clamp(s.mask + d.mask, 0, 100);
    s.strain = clamp(s.strain + d.strain, 0, 100);
    s.will = clamp(s.will + d.will, 0, 100);
    for (const k of Object.keys(d)) d[k] = Math.round(d[k]);
    return d;
}

/** Держать лицо под сильным чувством стоит воли — за каждый ответ, где он в сцене. */
export function holdCost(s, dom, drain = 1) {
    if (!dom?.id || !['fear', 'anger', 'shame', 'low'].includes(dom.id)) return 0;
    const c = Math.max(0, dom.lvl - 45) * 0.12 * clamp(drain, 0.5, 1.6);
    s.will = clamp(s.will - c, 0, 100);
    return r1(c);
}

// ───────────── что из этого выходит ─────────────

export const EMOS = ['fear', 'anger', 'shame', 'low', 'tender', 'playful'];
export const STEPS_AT = [25, 42, 58, 86];
/** Сколько ступеней у каждой кассеты. */
export const EMO_STEPS = { fear: 4, anger: 4, shame: 4, low: 3, tender: 3, playful: 2 };

const FAMILY_NEG = ['fear', 'anger', 'shame', 'low'];
const c01 = (v) => Math.max(0, Math.min(1, v));
const gate = (x) => Math.min(1, x / 0.1);

/**
 * Шесть эмоций 0–100 из четырёх осей. base — характер: чувство считается от того, насколько человеку хуже
 * или лучше ОБЫЧНОГО (наполовину): кто годами живёт с виной, не ходит в остром стыде каждый день.
 */
export function scales(E, base = null) {
    const R = {};
    for (const a of AXES) R[a] = clamp(E[a] - BASE_SHARE * num(base?.[a]), -100, 100);
    const V = Math.max(0, R.val) / 100, v = Math.max(0, -R.val) / 100;
    const A = Math.max(0, R.aro) / 100, a = Math.max(0, -R.aro) / 100;
    const c = Math.max(0, -R.ctl) / 100;
    const w = Math.max(0, -R.wor) / 100;
    const power = 0.55 + 0.45 * ((R.ctl + 100) / 200);     // злиться может тот, у кого есть хоть какая-то сила
    const ease = 0.6 + 0.4 * ((R.ctl + 100) / 200);
    return {
        fear: Math.round(100 * c01((c + A * 0.5) * gate(c))),
        anger: Math.round(100 * c01((v * 0.9 + A * 0.45) * gate(v) * power)),
        shame: Math.round(100 * c01((w + v * 0.25) * gate(w))),
        low: Math.round(100 * c01((v * 0.8 + a * 0.6) * gate(v) * gate(a))),
        tender: Math.round(100 * c01(V * (1 - 0.45 * A) * gate(V))),
        playful: Math.round(100 * c01((V * 0.65 + A * 0.65) * gate(V) * gate(A) * ease)),
    };
}

export function stepOf(id, lvl) {
    let st = 0;
    for (const edge of STEPS_AT) if (lvl >= edge) st++;
    return Math.min(st, EMO_STEPS[id] || 4);
}

/**
 * Ведущая эмоция: { id, lvl, step, second } — id пуст, если всё ровно.
 * prev — что вело до этого (доминанта Ухтомского): раз возникнув, чувство держится и не уступает первому же
 * сопернику — другое перехватывает, только обогнав его на DOM_MARGIN. held: true — удержалось по инерции.
 */
export function dominant(E, base = null, prev = '') {
    const sc = scales(E, base);
    const order = EMOS.map(id => [id, sc[id]]).sort((x, y) => y[1] - x[1]);
    let [id, lvl] = order[0];
    let held = false;
    if (prev && prev !== id && sc[prev] >= STEPS_AT[0] && lvl - sc[prev] < DOM_MARGIN) { id = prev; lvl = sc[prev]; held = true; }
    if (lvl < STEPS_AT[0]) return { id: '', lvl, step: 0, second: '', all: sc };
    const other = order.find(x => x[0] !== id);
    const sec = other && other[1] >= STEPS_AT[1] ? other[0] : '';
    return { id, lvl, step: stepOf(id, lvl), second: sec, all: sc, held };
}

/** Запомнить, что ведёт и с какого момента: { id, ts, mes }. Смена чувства — отсчёт заново. */
export function setDominant(s, dom, now = {}) {
    if (!dom?.id) { s.dom = null; return null; }
    if (!s.dom || s.dom.id !== dom.id) s.dom = { id: dom.id, ts: now.ts ?? null, mes: num(now.mes) };
    return s.dom;
}

/** Залип: тяжёлое чувство держит его уже hours часов истории на второй ступени и выше — мысли ходят по кругу. */
export function stuck(s, dom, nowTs, hours = 6) {
    if (!dom?.id || dom.step < 2 || !FAMILY_NEG.includes(dom.id) || !s.dom || s.dom.id !== dom.id) return false;
    return s.dom.ts != null && nowTs != null && nowTs - s.dom.ts >= hours * 3.6e6;
}

// куда «своё» чувство тянет оси — чтобы постороннее плохое лило воду на ту же мельницу
const DOM_PULL = { fear: { aro: 0.6, ctl: -0.8 }, anger: { val: -0.7, aro: 0.6 }, shame: { wor: -1 }, low: { val: -0.8, aro: -0.4 } };

/**
 * Доминанта стягивает постороннее: пока тяжёлое чувство ведёт (вторая ступень и выше), любое другое плохое
 * событие частью уходит в него же. mag — сила события (самый большой сдвиг оси). Возвращает, сколько подлил.
 */
export function feedDominant(s, domId, mag, share = 0.2) {
    const P = DOM_PULL[domId];
    const x = Math.abs(num(mag)) * share;
    if (!P || x < 1) return 0;
    for (const [a, c] of Object.entries(P)) s.fast[a] = clamp(s.fast[a] + c * x, -150, 150);
    return Math.round(x);
}

export const willBand = (will) => (will >= 70 ? 3 : will >= 40 ? 2 : will >= 20 ? 1 : 0);

// ───────────── срыв ─────────────

/** Пора ли сорваться: 'strain' — накопилось и держать нечем; 'acute' — один удар в больное; '' — нет. */
export function breakCheck(s, E, hits = {}) {
    if (s.brk || s.hang) return '';
    if (s.strain >= 88 && s.will <= 18) return 'strain';
    if (s.strain >= 62) {
        if ((hits.blow || 0) >= 3 && E.wor <= -45) return 'acute';
        if ((hits.bound || 0) >= 3 && E.ctl <= -45) return 'acute';
        if ((hits.threat || 0) >= 3 && E.ctl <= -55) return 'acute';
    }
    return '';
}

/** Срыв прожит: напряжение вышло, сил нет, тяжёлый осадок — «похмелье» на hours часов истории. */
export function resolveBreak(s, now = {}, hours = 10) {
    // выплеснутая злость не разряжает (метаанализ Kjærvik и Bushman, 2024: «выпустить пар» злость не снижает,
    // снижает то, что успокаивает тело): после срыва в злости напряжение остаётся высоким и взвод не падает
    const hot = s.brk?.emo === 'anger';
    s.strain = Math.min(s.strain, hot ? 72 : 55);
    s.will = Math.min(s.will, 25);
    s.mood.val = clamp(s.mood.val - 22, -120, 120);
    if (!hot) { s.mood.aro = clamp(s.mood.aro - 12, -120, 120); s.fast.aro = Math.min(s.fast.aro, 0); }
    s.hang = { until: now.ts != null ? now.ts + hours * 3.6e6 : null, mes: num(now.mes), n: 0 };
    s.brk = null;
    s.role = 0; s.heldDay = null;      // сорвался — роль сильного больше не держит
    return s;
}

/** Кончилось ли похмелье (по времени истории; без дат — через 40 ответов). */
export function hangOver(s, now = {}) {
    if (!s.hang) return true;
    if (s.hang.until != null && now.ts != null) return now.ts >= s.hang.until;
    return num(now.mes) - num(s.hang.mes) >= 40;
}

// ───────────── аура ─────────────

/**
 * Как это выглядит: цвет — от холодного синего (мрак) через розовый к янтарю (тепло); пульс — заряд;
 * чёткость края — контроль; муть — страх и стыд; трещины — на пределе.
 */
export function auraOf(E, s) {
    const hue = Math.round((210 + ((E.val + 100) / 200) * 190) % 360);
    const sc = scales(E, s.base);
    const murk = Math.max(sc.fear, sc.shame) / 100;
    return {
        hue,
        sat: Math.round(clamp(62 - murk * 38 + Math.abs(E.val) * 0.18, 18, 85)),
        lum: Math.round(clamp(58 - murk * 14 + E.val * 0.06, 38, 68)),
        dur: r1(clamp(2.6 - (E.aro / 100) * 1.7, 0.8, 4.5)),
        blur: Math.round(clamp(8 - (E.ctl / 100) * 6, 2, 14)),
        size: Math.round(clamp(100 + E.aro * 0.12, 88, 114)),
        crack: !!(s.brk || s.hang || s.strain >= 75),
    };
}

// ───────────── маска: утечки ─────────────

/** Насколько проступает то, что он прячет: 0 — держит, 1 — трещит, 2 — почти не держит. loose — тормоза сняты (алкоголь). */
export function leakOf(s, loose = false) {
    const m = s.mask + (loose ? 15 : 0);
    const band = willBand(s.will);
    if (m >= 80 || (m >= 60 && band === 0)) return 2;
    if (m >= 70 || (m >= 55 && band <= 1)) return 1;
    return 0;
}

// ───────────── что его возвращает ─────────────

/** Сработало то, что его возвращает (её голос, счёт вслух, дело для рук): плохая вспышка гаснет быстро. */
export function soothe(s) {
    const d = { val: 0, aro: 0, ctl: 0, wor: 0, will: 6, strain: 0 };
    for (const a of AXES) {
        if (a === 'aro') { if (s.fast.aro > 0) { d.aro = -s.fast.aro * 0.45; s.fast.aro += d.aro; } continue; }
        if (s.fast[a] < 0) { d[a] = -s.fast[a] * 0.45; s.fast[a] += d[a]; }
        if (s.mood[a] < 0) s.mood[a] *= 0.85;
    }
    const st = Math.min(12, s.strain);
    s.strain -= st; d.strain = -st;
    s.will = clamp(s.will + 6, 0, 100);
    for (const k of Object.keys(d)) d[k] = Math.round(d[k]);
    return d;
}

// ───────────── убеждения ─────────────

/** Прочность убеждения 0…100 (нет записи — нетронуто). */
export const beliefHp = (s, id) => clamp(s.bel?.[id] ?? 100, 0, 100);
/** Как убеждение держится: 3 — крепко, 2 — шатается, 1 — почти не держит, 0 — сломано. */
export const beliefBand = (hp) => (hp >= 70 ? 3 : hp >= 35 ? 2 : hp > 0 ? 1 : 0);

/**
 * Поступок или слова задели убеждение: d от −2 (сильно поколебали) до +2 (сильно подтвердили).
 * Точится медленно — это дело недель истории; подтверждается чуть быстрее. Сломанное не возвращается.
 * Возвращает 'broken', когда прочность впервые дошла до нуля.
 */
export function beliefHit(s, id, d) {
    const cur = beliefHp(s, id);
    if (cur <= 0) return '';
    const k = Math.round(clamp(d, -2, 2));
    if (!k) return '';
    const next = clamp(cur + (k < 0 ? k * 4 : k * 5), 0, 100);
    s.bel[id] = next;
    return next <= 0 ? 'broken' : '';
}

// ───────────── прогноз ─────────────

/**
 * Что будет, если ничего не менять: при тех же нагрузках (load, off) — через сколько часов истории
 * нервы станут сырыми (rawIn), случится срыв (breakIn) и когда отпустит (calmIn). Часы или null.
 * Срыв без событий бывает редко (воля сама возвращается) — чаще он случается в сцене; rawIn говорит, когда он станет близок.
 */
export function forecast(s, temper, load = {}, off = null, horizon = 72) {
    const x = JSON.parse(JSON.stringify(s));
    const out = { breakIn: null, rawIn: null, calmIn: null };
    if (x.brk) return out;
    const now = dominant(eff(x, off), x.base);
    const wasRaw = x.strain >= 75;
    for (let h = 1; h <= horizon; h++) {
        decay(x, 1, temper, load);
        if (out.breakIn == null && !x.hang && x.strain >= 88 && x.will <= 18) out.breakIn = h;
        if (out.rawIn == null && !wasRaw && x.strain >= 75) out.rawIn = h;
        if (out.calmIn == null && now.id && !dominant(eff(x, off), x.base).id) out.calmIn = h;
    }
    return out;
}

// ───────────── инициатива: шаг стоит воли ─────────────

/** Сколько воли стоит шаг по своей инициативе. */
export const INIT_COST = { care: 3, own: 4, plot: 4, gift: 5, talk: 6, court: 8, touch: 8, flirt: 10, spicy: 12 };
const CLOSE_KINDS = ['talk', 'court', 'touch', 'flirt', 'spicy'];

/**
 * Хватит ли его на этот шаг. ctx.steps — сколько уже прожито вдвоём (каждая ступень удешевляет близкие шаги),
 * ctx.loose — тормоза сняты, ctx.hungry — изголодался по близости. { ok, cost, why, bold }
 */
export function afford(s, dom, kind, ctx = {}) {
    let cost = INIT_COST[kind] ?? 6;
    if (CLOSE_KINDS.includes(kind)) cost *= Math.max(0.45, 1 - num(ctx.steps) * 0.04);
    if (dom?.id === 'tender' || dom?.id === 'playful') cost *= 0.6;
    if ((dom?.id === 'fear' || dom?.id === 'shame') && dom.step >= 2) cost *= 1.5;
    if (ctx.loose) cost *= 0.6;
    if (ctx.hungry && CLOSE_KINDS.includes(kind)) cost *= 0.8;      // голод по близости подталкивает
    cost = Math.round(cost * 10) / 10;
    if (s.brk) return { ok: false, cost, why: 'сейчас не до того — его несёт' };
    if (dom?.id === 'fear' && dom.step >= 3 && CLOSE_KINDS.includes(kind)) return { ok: false, cost, why: 'страх держит: тянется и отдёргивает себя' };
    if (dom?.id === 'shame' && dom.step >= 3 && CLOSE_KINDS.includes(kind)) return { ok: false, cost, why: 'стыд держит: считает, что не вправе' };
    if (s.will - cost < 10) return { ok: false, cost, why: 'сил на это сейчас нет: выжат' };
    return { ok: true, cost, why: '', bold: s.will >= 70 && (dom?.id === 'tender' || dom?.id === 'playful') };
}

/** Шаг сделан — воля потрачена. */
export function spend(s, cost) {
    const c = clamp(cost, 0, 40);
    s.will = clamp(s.will - c, 0, 100);
    return c;
}

// ───────────── сырые нервы и раздражительность ─────────────

/** Нервы сырые: то, что обычно только задевает, сейчас бьёт сильнее. */
export const rawNerves = (s) => !!s.hang || s.strain >= 60 || willBand(s.will) === 0;

/** Как быстро сейчас тает его терпение (0.8 — в тепле, 1 — обычно, до 1.5 — на нервах). */
export function edgeOf(s, dom) {
    let e = 1 + clamp((s.strain - 40) / 120, 0, 0.4);
    if (willBand(s.will) <= 1) e += 0.15;
    if (dom?.id === 'anger') e += 0.08 * dom.step;
    if (dom?.id === 'tender' || dom?.id === 'playful') e *= 0.85;
    return Math.round(clamp(e, 0.8, 1.5) * 100) / 100;
}

// ───────────── плохая ночь ─────────────

function rnd(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

/** Шанс плохой ночи: чем выше напряжение, тем вероятнее; недавний триггер и срыв — добавляют. */
export function nightChance(s, ctx = {}) {
    return Math.round(clamp((s.strain - 40) / 80 + (ctx.trig ? 0.35 : 0) + (s.hang ? 0.3 : 0), 0, 0.9) * 100) / 100;
}
/** Была ли ночь плохой. seed — чтобы свайп того же поста дал ту же ночь. */
export const nightRoll = (s, seed, ctx = {}) => rnd(seed) < nightChance(s, ctx);

// ───────────── кардиограмма ─────────────

/** Запомнить, каким он был в этот день истории (последнее за день; хранится 60 дней). */
export function sample(s, E, day) {
    if (!day) return;
    const row = { d: String(day), val: E.val, aro: E.aro, ctl: E.ctl, wor: E.wor, will: Math.round(s.will), strain: Math.round(s.strain) };
    const k = s.hist.findIndex(x => x.d === row.d);
    if (k >= 0) s.hist[k] = row; else s.hist.push(row);
    if (s.hist.length > 60) s.hist.splice(0, s.hist.length - 60);
}

// ───────────── память с чувством ─────────────

const FAMILY = { fear: 'neg', anger: 'neg', shame: 'neg', low: 'neg', tender: 'pos', playful: 'pos' };

/**
 * Запомнить сильное: m = { mes, day, t: что случилось, emo: чем это было для него, w: вес 1–3 }.
 * Память короткая и злая: 40 меток, вытесняются слабые и старые.
 */
export function mark(s, m) {
    const t = String(m?.t || '').trim().slice(0, 120);
    if (!t || !FAMILY[m.emo]) return null;
    if (s.marks.some(x => x.mes === m.mes && x.emo === m.emo)) return null;
    const row = { id: `m${num(m.mes)}${m.emo[0]}`, mes: num(m.mes), day: String(m.day || ''), t, emo: m.emo, w: Math.round(clamp(m.w, 1, 3)), r: null };
    s.marks.push(row);
    if (s.marks.length > 40) {
        const drop = s.marks.slice().sort((a, b) => a.w - b.w || a.mes - b.mes)[0];
        s.marks = s.marks.filter(x => x !== drop);
    }
    return row;
}

/**
 * Что всплывает в тон тому, что он чувствует сейчас: метка с тем же чувством (или хотя бы того же знака),
 * не свежая (старше gap постов) и не всплывавшая недавно (cool постов). Тяжёлое — раньше. null — ничего.
 */
const RECALL_AX = { fear: 'ctl', anger: 'val', shame: 'wor', low: 'val' };
export function pickRecall(s, dom, lastI, gap = 20, cool = 25) {
    if (!dom?.id) return null;
    const fam = FAMILY[dom.id];
    // метаанализы памяти в тон настроению (Matt, Vázquez, Campbell, 1992): в обычном состоянии перевес у хорошего,
    // симметрия и перевес плохого — у подавленных. Поэтому хорошее всплывает уже с первой ступени, а плохое —
    // только когда тяжёлым стало само настроение (или чувство дошло до третьей ступени), не от одной вспышки
    if (fam === 'pos' ? dom.step < 1 : !(dom.step >= 3 || (dom.step >= 2 && num(s.mood?.[RECALL_AX[dom.id]]) <= -10))) return null;
    const pool = s.marks.filter(x => FAMILY[x.emo] === fam && lastI - x.mes >= gap && (x.r == null || lastI - x.r >= cool));
    if (!pool.length) return null;
    return pool.sort((a, b) => (b.emo === dom.id) - (a.emo === dom.id) || b.w - a.w || b.mes - a.mes)[0];
}

// эхо: всплывшее воспоминание возвращает часть того, чем оно было (только вспышкой — само проходит)
const ECHO = { fear: { aro: 7, ctl: -6 }, anger: { val: -5, aro: 6 }, shame: { wor: -7, val: -2 }, low: { val: -7, aro: -3 }, tender: { val: 7, wor: 3 }, playful: { val: 4, aro: 4 } };
export function echo(s, emo, w = 2) {
    const e = ECHO[emo];
    if (!e) return null;
    const k = clamp(w, 1, 3) / 3;
    const d = {};
    for (const [a, x] of Object.entries(e)) { s.fast[a] = clamp(s.fast[a] + x * k, -150, 150); d[a] = Math.round(x * k); }
    return d;
}

// ───────────── ревность ─────────────

/** Ревность сейчас (0…100) растёт от события «соперник»: n — сила 1…3, mul — насколько оно его берёт (линза привязанности). */
export function jealUp(s, n, mul = 1) {
    const x = STEP[Math.round(clamp(n, 0, 3))] * clamp(mul, 0.2, 1.6) * 1.5;
    s.jeal = clamp(num(s.jeal) + x, 0, 100);
    return Math.round(x);
}
/** Как ревнует: 'open' — в открытую, 'quiet' — молча, считая соперника лучше, 'cling' — тревожно. Пусто — не ревнует. */
export function jealStyle(s, E, dom) {
    if (num(s.jeal) < 25) return '';
    if (dom?.id === 'anger' || (E.ctl >= 10 && E.wor > -25)) return 'open';
    if (dom?.id === 'shame' || E.wor <= -25) return 'quiet';
    return 'cling';
}

// ───────────── роль сильного ─────────────

/**
 * Сколько дней подряд он держит лицо. Считается на смене дня: вчера сдерживался или носит в себе много —
 * день в зачёт; открылся или сорвался — счёт с нуля; пара спокойных дней — тоже.
 */
export function roleDay(s, prevDay) {
    const held = !!prevDay && s.heldDay === prevDay;
    if (held || s.mask >= 50) s.role = Math.min(99, num(s.role) + 1);
    else if (s.mask < 30) s.role = Math.max(0, num(s.role) - 2);
    return s.role;
}
export function roleHit(s, hits, day) {
    if ((hits?.held || 0) >= 1 && day) s.heldDay = day;
    if ((hits?.open || 0) >= 2) { s.role = 0; s.heldDay = null; }
    return s.role;
}
/** С какого дня роль начинает трещать: у кого воли больше — держит дольше. */
export const roleEdge = (temper) => Math.round(4 * clamp(temper?.grit ?? 1, 0.4, 2) + 1);
/** 0 — держит, 1 — устал держать, 2 — трещит. */
export function roleBand(s, temper) {
    const e = roleEdge(temper), r = num(s.role);
    return r >= e + 3 ? 2 : r >= e ? 1 : 0;
}

// ───────────── юмор ─────────────

/**
 * Каким юмором он сейчас шутит (если шутит): 'aff' — тёплый, на двоих; 'self' — ирония, чтобы держаться;
 * 'aggr' — с зубами; 'def' — над собой, раньше чем успеют другие. Пусто — не до шуток.
 * Когда и какой — решает состояние; как сказать — уже дело того, кто пишет.
 */
export function witOf(s, E, dom, temper) {
    const w = clamp(temper?.wit ?? 1, 0, 2);
    if (w < 0.4 || s.brk || s.hang) return '';
    const id = dom?.id || '', step = dom?.step || 0;
    if (id === 'fear') return step === 1 && w >= 0.8 ? 'self' : '';
    if (id === 'anger') return step <= 2 ? 'aggr' : '';
    if (id === 'shame') return step <= 2 && w >= 0.8 ? 'def' : '';
    if (id === 'low') return step === 1 && w >= 1 ? (E.wor <= -20 ? 'def' : 'self') : '';
    if (id === 'playful') return 'aff';
    if (id === 'tender') return w >= 1.2 ? 'aff' : '';
    if (s.strain >= 45) return rawNerves(s) && E.val < 0 ? 'aggr' : 'self';
    return E.val >= 8 && w >= 1 ? 'aff' : '';
}
