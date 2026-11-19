// Код-мозг — ядро. Чистая математика психики персонажа: без Таверны, без Life, без DOM.
// Нейронка читает и пишет, код помнит и считает: сюда приходят события («удар по самооценке 2», «угроза 3»)
// и нагрузки от тела (боль, недосып), отсюда выходит состояние — четыре оси в три слоя, воля, напряжение,
// ведущая эмоция со ступенью и срыв. Этот файл не знает, кто его зовёт: переедет под любую модель как есть.
//
// Оси (−100…100):  val — мрак ↔ тепло;  aro — пусто ↔ заряд;  ctl — беспомощность ↔ контроль;  wor — стыд ↔ самоценность.
// Слои:  fast — вспышка (гаснет за час истории);  mood — настроение (держится полдня);  base — характер (ползёт неделями).

export const AXES = ['val', 'aro', 'ctl', 'wor'];

/** Что может случиться с человеком. Летописец ставит силу 0–3 каждому виду. */
export const KINDS = ['warm', 'fun', 'win', 'calm', 'threat', 'blow', 'bound', 'wrong', 'loss', 'held'];
export const NEGATIVE = ['threat', 'blow', 'bound', 'wrong', 'loss'];

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
    held: { val: 0, aro: 0, ctl: 0, wor: 0, strain: 0.3, will: -0.5 },
};

export const FAST_HL = 0.75;      // часов истории: вспышка гаснет наполовину
export const MOOD_HL = 10;        // настроение
export const STRAIN_HL = 18;      // напряжение
export const MOOD_SHARE = 0.35;   // какая доля события оседает в настроении
export const MUL_CAP = 1.35;      // потолок «характер × больное место»: одно событие не должно сносить человека
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
        cass: {},      // свои кассеты: { fear: ['…', …], …, brk: '…', hang: '…' }
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
    out.sens = {};
    for (const k of Object.keys(d.sens)) out.sens[k] = r1(clamp(x.sens?.[k] ?? 1, 0.3, 2.5));
    out.cass = x.cass && typeof x.cass === 'object' ? x.cass : {};
    out.note = typeof x.note === 'string' ? x.note.slice(0, 400) : '';
    out.src = ['auto', 'lore', 'hand'].includes(x.src) ? x.src : 'auto';
    return out;
}

// ───────────── состояние ─────────────

/** Новое состояние: всё спокойно, характер — в точке темперамента. */
export function fresh(temper) {
    const t = normTemper(temper);
    return { fast: zero(), mood: zero(), base: { ...t.base }, will: 85, strain: 10, at: null, brk: null, hang: null, log: [] };
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
 *   nights   — сколько ночей прошло;  sleepQ — насколько он выспался (0…1).
 */
export function decay(s, hours, temper, load = {}) {
    const t = normTemper(temper);
    const h = clamp(hours, 0, 24 * 30);
    if (h > 0) {
        const kf = Math.pow(0.5, h / FAST_HL);
        const km = Math.pow(0.5, h / (MOOD_HL / t.recover));
        for (const a of AXES) {
            // характер медленно тянется за тем, чем он живёт
            const drift = s.mood[a] * Math.min(0.5, h * BASE_DRIFT);
            s.base[a] = clamp(s.base[a] + drift, t.base[a] - BASE_SPAN, t.base[a] + BASE_SPAN);
            s.fast[a] *= kf;
            s.mood[a] *= km;
        }
        // напряжение: приток против естественного спада — к равновесию
        const k = Math.LN2 / (STRAIN_HL / t.recover);
        const eq = clamp(num(load.strainIn) / k, 0, 100);
        s.strain = clamp(eq + (s.strain - eq) * Math.exp(-k * h), 0, 100);
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
 * Возвращает, что сдвинулось: { val, aro, ctl, wor, will, strain }.
 */
export function hit(s, hits, temper, opts = {}) {
    const t = normTemper(temper);
    const d = { val: 0, aro: 0, ctl: 0, wor: 0, will: 0, strain: 0 };
    // сырые нервы: чем выше напряжение, тем больнее плохое; после срыва — тем более
    const raw = Math.min(RAW_CAP, num(opts.raw, 1) * (1 + Math.max(0, s.strain - 55) / 90) * (s.hang ? 1.3 : 1));
    for (const [k, n] of Object.entries(hits || {})) {
        const H = HIT[k];
        if (!H) continue;
        const u = STEP[Math.round(clamp(n, 0, 3))];
        if (!u) continue;
        const neg = NEGATIVE.includes(k);
        const own = k === 'held' ? 1 : clamp(t.react * num(t.sens[k], 1), 0.4, MUL_CAP);
        const m = u * own * (neg ? raw : 1) * num(opts.mul, 1);
        for (const a of AXES) {
            const x = H[a] * m;
            if (!x) continue;
            s.fast[a] = clamp(s.fast[a] + x, -150, 150);
            // инерция: пока настроение тяжёлое, хорошее греет минуту, а оседает вполсилы — «простил» не бывает мгновенным
            const heavy = x > 0 && s.mood[a] < -8 ? 0.5 : 1;
            s.mood[a] = clamp(s.mood[a] + x * MOOD_SHARE * heavy, -120, 120);
            d[a] += x;
        }
        d.strain += H.strain * m;
        d.will += H.will * u * (H.will > 0 ? t.grit : 1);
    }
    s.strain = clamp(s.strain + d.strain, 0, 100);
    s.will = clamp(s.will + d.will, 0, 100);
    for (const k of Object.keys(d)) d[k] = Math.round(d[k]);
    return d;
}

/** Держать лицо под сильным чувством стоит воли — за каждый ответ, где он в сцене. */
export function holdCost(s, dom) {
    if (!dom?.id || !['fear', 'anger', 'shame', 'low'].includes(dom.id)) return 0;
    const c = Math.max(0, dom.lvl - 45) * 0.12;
    s.will = clamp(s.will - c, 0, 100);
    return r1(c);
}

// ───────────── что из этого выходит ─────────────

export const EMOS = ['fear', 'anger', 'shame', 'low', 'tender', 'playful'];
export const STEPS_AT = [25, 42, 58, 86];
/** Сколько ступеней у каждой кассеты. */
export const EMO_STEPS = { fear: 4, anger: 4, shame: 4, low: 3, tender: 3, playful: 2 };

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

/** Ведущая эмоция: { id, lvl, step, second } — id пуст, если всё ровно. */
export function dominant(E, base = null) {
    const sc = scales(E, base);
    const order = EMOS.map(id => [id, sc[id]]).sort((x, y) => y[1] - x[1]);
    const [id, lvl] = order[0];
    if (lvl < STEPS_AT[0]) return { id: '', lvl, step: 0, second: '', all: sc };
    const sec = order[1] && order[1][1] >= STEPS_AT[1] ? order[1][0] : '';
    return { id, lvl, step: stepOf(id, lvl), second: sec, all: sc };
}

/** Насколько воли хватает: 3 — с запасом, 2 — нормально, 1 — мало, 0 — на нуле. */
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
    s.strain = Math.min(s.strain, 55);
    s.will = Math.min(s.will, 25);
    s.mood.val = clamp(s.mood.val - 22, -120, 120);
    s.mood.aro = clamp(s.mood.aro - 12, -120, 120);
    s.fast.aro = Math.min(s.fast.aro, 0);
    s.hang = { until: now.ts != null ? now.ts + hours * 3.6e6 : null, mes: num(now.mes), n: 0 };
    s.brk = null;
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
