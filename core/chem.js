// Код-мозг — лекарства и вещества: седативное, сильное обезболивающее, стимуляторы. Устроено как алкоголь (booze.js):
// считается, сколько принято, на какой человек стадии и что будет, когда отпустит. Опора — опыты на здоровых
// добровольцах (обычные дозы, один приём), дальше — перенос на вымысел:
//   • седативное (бензодиазепины и то, что было до них): уже малая доза глушит вздрагивание (Murphy и др., 2008:
//     5 мг диазепама), а большая (15 мг) мешает узнавать на лицах злость и страх — человек может не заметить,
//     что рядом закипают (Blair, Curran, 1999; Zangara и др., 2002; с малой дозой и с лоразепамом этого не нашли,
//     поэтому здесь — только со второй стадии); память на этот час — кусками; после — вялость, возврат тревоги,
//     плохой сон;
//   • обезболивающее (опиоиды): по «опиоидной теории привязанности» чувство тепла и покоя рядом со своими держится
//     на собственных опиоидах мозга — заблокируй их, и близость ощущается слабее (Inagaki и др., 2016). Отсюда
//     перенос: лекарство даёт это тепло без людей — разлука и обида доходят глуше, и ничего не надо; когда
//     отпускает — наоборот, режет острее;
//   • стимулятор (амфетамин и родня): больше и быстрее говорит, малейшие перемены в чужих лицах ловит раньше,
//     на хорошее откликается живее (Wardle, de Wit, 2012; Wardle и др., 2012), прибавляет уверенности и тяги к
//     риску; усталость не снимает, а откладывает — потом обвал: вялость, раздражительность, сон и голод.
// Чистая математика: без Таверны, Life и DOM. Тексты — без рода.

import { clamp } from './psyche.js';

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const r1 = (v) => Math.round(v * 10) / 10;

export const KINDS = ['sed', 'pain', 'stim'];
export const KIND_NAME = { sed: 'седативное', pain: 'обезболивающее', stim: 'стимулятор' };
export const KIND_ICON = { sed: '💊', pain: '💉', stim: '⚡' };
const AT = [18, 40, 62];                 // с какого уровня стадии 1…3
const SPEC = {
    //      что добавляет доза 1…3     уходит за час   откат: с какого пика и на сколько часов (обычный, тяжёлый)
    sed: { dose: [0, 22, 42, 64], burn: 9, from: 40, hours: [8, 14] },
    pain: { dose: [0, 24, 44, 66], burn: 11, from: 40, hours: [8, 16] },
    stim: { dose: [0, 24, 44, 64], burn: 7, from: 38, hours: [10, 20] },
};
export const STAGE = {
    sed: ['', 'под успокоительным', 'под сильным седативным', 'седативного слишком много'],
    pain: ['', 'под обезболивающим', 'под сильным обезболивающим', 'обезболивающего слишком много'],
    stim: ['', 'на стимуляторе', 'на взводе от стимулятора', 'стимулятора слишком много'],
};
export const AFTER = {
    sed: ['', 'седативное отпустило', 'откат после седативного'],
    pain: ['', 'обезболивающее отпускает', 'откат после обезболивающего'],
    stim: ['', 'стимулятор отпустил', 'обвал после стимулятора'],
};

/** Стадия 0…3 по уровню вещества. */
export function stageOf(lvl) {
    let st = 0;
    for (const edge of AT) if (num(lvl) >= edge) st++;
    return st;
}
/**
 * Как человека берут лекарства. Привычка к спиртному тут не помогает; помогает только сверхчеловеческий обмен —
 * «как берёт алкоголь» от 2 и выше: тогда так же быстро выгорает и всё остальное.
 */
export const chemTol = (temper) => { const b = clamp(num(temper?.booze, 1), 0.4, 6); return b >= 2 ? b : 1; };

const cell = (s, kind) => { if (!s.chem || typeof s.chem !== 'object') s.chem = {}; if (!s.chem[kind]) s.chem[kind] = { lvl: 0, peak: 0 }; return s.chem[kind]; };

/** Принял: kind — что, n — 1 (обычная доза), 2 (сильная), 3 (много); k — доля, если это та же доза из поста в пост. */
export function take(s, kind, n, tol = 1, k = 1) {
    const sp = SPEC[kind];
    if (!sp) return 0;
    const add = sp.dose[Math.round(clamp(n, 0, 3))] * clamp(k, 0.1, 1) / clamp(tol, 0.4, 6);
    if (!add) return 0;
    const c = cell(s, kind);
    c.lvl = clamp(num(c.lvl) + add, 0, 100);
    c.peak = Math.max(num(c.peak), c.lvl);
    if (s.after?.[kind]) delete s.after[kind];          // принял снова — откат отложен
    if ((kind === 'sed' && stageOf(c.lvl) >= 2) || (kind === 'pain' && stageOf(c.lvl) >= 3)) s.fog = true;      // этот час запомнится кусками
    return r1(add);
}

/**
 * Прошло hours часов: вещество уходит; когда его осталось меньше трети от пика (а пик был настоящим) — начинается
 * откат. Длинный пропуск времени съедает его часть или весь. Кого почти не берёт (tol ≥ 3) — тому и отката нет.
 * Возвращает список того, у чего откат начался в этот раз: ['sed', …].
 */
export function wear(s, hours, tol = 1) {
    const h = clamp(hours, 0, 24 * 30);
    const began = [];
    if (s.after && typeof s.after === 'object') {
        for (const k of Object.keys(s.after)) { s.after[k].left = num(s.after[k].left) - h; if (s.after[k].left <= 0) delete s.after[k]; }
    }
    if (!s.chem || typeof s.chem !== 'object') { if (s.fog && !Object.keys(s.after || {}).length) s.fog = false; return began; }
    for (const kind of KINDS) {
        const c = s.chem[kind], sp = SPEC[kind];
        if (!c) continue;
        const l0 = num(c.lvl), peak = num(c.peak);
        if (!l0 && !peak) { delete s.chem[kind]; continue; }
        const rate = sp.burn * clamp(tol, 0.4, 6);
        c.lvl = Math.max(0, l0 - rate * h);
        const edge = peak * 0.35;
        if (peak >= sp.from && tol < 3 && c.lvl <= edge) {
            const lvl = peak >= 62 ? 2 : 1;
            const since = l0 > edge ? h - (l0 - edge) / rate : h;
            const left = sp.hours[lvl - 1] - Math.max(0, since);
            if (left > 0) { if (!s.after || typeof s.after !== 'object') s.after = {}; if (!s.after[kind] || num(s.after[kind].lvl) < lvl) { s.after[kind] = { lvl, left: r1(left) }; began.push(kind); } }
            c.peak = 0;
        }
        if (c.lvl <= 0) { c.peak = 0; delete s.chem[kind]; }
    }
    if (s.fog && !Object.keys(s.chem).length && !Object.keys(s.after || {}).length) s.fog = false;
    return began;
}

/** Сейчас в нём: стадии по веществам и откаты — { on: { sed, pain, stim }, after: { … }, any } (всё нули — any = false). */
export function chemStages(s, floor = {}) {
    const on = {}, after = {};
    for (const k of KINDS) {
        on[k] = stageOf(Math.max(num(s?.chem?.[k]?.lvl), num(floor[k])));
        after[k] = s?.after?.[k] ? Math.round(clamp(s.after[k].lvl, 1, 2)) : 0;
    }
    return { on, after, any: KINDS.some(k => on[k] || after[k]) };
}

/**
 * Что вещества делают с человеком сейчас. v: { drunk — стадия опьянения 0…4 (спиртное и седативное складываются),
 * prone — насколько тревожен (0…1): таким возврат тревоги достаётся сильнее, floor — уровни, о которых знает только
 * Life («Способности») }.
 * → { on, after, any, off: сдвиг осей, kmul: во сколько раз доходят события по видам (только не «сильные»),
 *     amp — всё остальное, raw, drain, loose, bold, fog — этот час не запомнит, willCap, strainIn, sleepQ,
 *     dull — во сколько раз тише своя рана, wake — усталости не слышит, miss — хуже считывает чужую злость и страх,
 *     keen — считывает острее, numb — обидное и разлука доходят глуше, afterAny, list: [{ id, text }] }
 */
export function chemNow(s, v = {}) {
    const { on, after, any } = chemStages(s, v.floor);
    const out = { on, after, any, off: { val: 0, aro: 0, ctl: 0, wor: 0 }, kmul: {}, amp: 1, raw: 1, drain: 0, loose: false, bold: false, fog: false, willCap: 100, strainIn: 0, sleepQ: 1, dull: 1, wake: false, miss: false, keen: false, numb: false, afterAny: false, list: [] };
    if (!any) return out;
    const mul = (k, x) => { out.kmul[k] = (out.kmul[k] ?? 1) * x; };
    const anx = clamp(num(v.prone), 0, 1);

    // седативное: спиртное поверх — на стадию глубже
    let sed = on.sed;
    if (sed && num(v.drunk) >= 1) sed = Math.min(3, sed + 1);
    if (sed) {
        out.off.aro -= 7 * sed;
        if (sed === 1) out.off.val += 2;
        mul('threat', 1 - 0.12 * sed);
        out.strainIn -= 0.3 * sed;
        out.drain += 0.15 * sed;
        out.loose = out.loose || sed >= 2;
        out.fog = out.fog || sed >= 2;
        out.willCap = Math.min(out.willCap, [100, 90, 80, 65][sed]);
        out.miss = sed >= 2;
        out.list.push({ id: 'sed', text: `${STAGE.sed[sed]}${sed > on.sed ? ' (со спиртным складывается)' : ''}` });
    }
    out.sedDeep = sed;
    // обезболивающее: своя рана тише, обидное и разлука — как через вату
    const pain = on.pain;
    if (pain) {
        out.off.val += 4 * Math.min(pain, 2);
        out.off.aro -= 6 * pain;
        mul('loss', 1 - 0.15 * pain);
        mul('blow', 1 - 0.12 * pain);
        mul('wrong', 1 - 0.08 * pain);
        mul('threat', 1 - 0.08 * pain);
        out.drain += 0.1 * pain;
        out.fog = out.fog || pain >= 3;
        out.willCap = Math.min(out.willCap, [100, 95, 85, 70][pain]);
        out.dull = [1, 0.55, 0.35, 0.2][pain];
        out.numb = true;
        out.list.push({ id: 'pain', text: STAGE.pain[pain] });
    }
    // стимулятор: всё доходит живее, усталость отложена
    const stim = on.stim;
    if (stim) {
        out.off.aro += 8 * stim;
        out.off.ctl += stim === 3 ? 2 : 3 * stim;
        if (stim <= 2) out.off.val += 3;
        out.amp = 1 + 0.06 * stim;
        if (stim >= 2) mul('wrong', 1.1);
        if (stim >= 3) mul('threat', 1.15);
        out.loose = out.loose || stim >= 2;
        out.bold = stim >= 2;
        out.wake = true;
        out.keen = true;
        out.sleepQ *= 1 - 0.3 * stim;
        out.strainIn += 0.15 * stim;
        out.list.push({ id: 'stim', text: `${STAGE.stim[stim]}${num(v.drunk) >= 2 ? ' (спиртного под ним не чувствует)' : ''}` });
        if (num(v.drunk) >= 2) out.bold = true;
    }
    // откаты
    if (after.sed) {
        const l = after.sed;
        out.off.aro += 4 * l;
        out.off.ctl -= Math.round(4 * l * (0.5 + anx));
        mul('threat', 1 + 0.1 * l);
        out.sleepQ *= 1 - 0.25 * l;
        out.strainIn += 0.3 * l;
        out.list.push({ id: 'sed-after', text: AFTER.sed[l] });
    }
    if (after.pain) {
        const l = after.pain;
        out.off.val -= 5 * l;
        out.off.aro += 3 * l;
        out.raw *= 1 + 0.12 * l;
        mul('loss', 1 + 0.1 * l);
        mul('blow', 1 + 0.1 * l);
        out.strainIn += 0.3 * l;
        if (!pain) out.dull = 1 + 0.15 * l;                // боль возвращается громче
        out.list.push({ id: 'pain-after', text: AFTER.pain[l] });
    }
    if (after.stim) {
        const l = after.stim;
        out.off.aro -= 10 * l;
        out.off.val -= 6 * l;
        out.raw *= 1 + 0.12 * l;
        out.willCap = Math.min(out.willCap, 85 - 15 * l);
        out.strainIn += 0.3 * l;
        out.drain += 0.2 * l;
        out.list.push({ id: 'stim-after', text: AFTER.stim[l] });
    }
    out.afterAny = KINDS.some(k => after[k]);
    out.strainIn = r1(out.strainIn);
    return out;
}

/** Как это играть: что человек делает и как звучит на каждой стадии (без рода). */
export const ON_TEXT = {
    sed: ['',
        'под успокоительным: движения и речь чуть медленнее, острые углы сглажены, тревога отступила; вздрагивает и пугается меньше обычного',
        'под сильным седативным: заторможенность, слова подбирает с задержкой, глаза закрываются; что обычно пугает — почти не трогает, чужую злость может не заметить вовсе; этот час потом вспомнит кусками',
        'седативного слишком много: речь смазана, засыпает на ходу, отвечает невпопад или не отвечает; на ногах без помощи не устоит, наутро — провал'],
    pain: ['',
        'под обезболивающим: боль отступила, плечи опустились, голос ровнее; всё чуть дальше, чем обычно, — и плохое тоже',
        'под сильным обезболивающим: тепло и далеко, зрачки узкие, движения ленивые, почёсывается; обидное и страшное доходит как через вату, ничего не надо — ни разговора, ни утешения',
        'обезболивающего слишком много: клюёт носом посреди фразы, дышит редко, зрачки в точку, слова тянутся; разговор не удержит, потом вспомнит обрывки'],
    stim: ['',
        'на стимуляторе: усталости как не было, говорит больше и быстрее, взгляд цепкий — ловит малейшие перемены в лицах; уверенности прибавилось',
        'на взводе от стимулятора: речь скачет, не сидится, челюсть сжата, зрачки широкие; берётся за рискованное не раздумывая, раздражается на помехи, есть и спать не может',
        'стимулятора слишком много: дёрганость, руки дрожат, сердце колотится, мысль перескакивает; в чужих словах слышит подвох, вспыхивает от пустяка'],
};
export const AFTER_TEXT = {
    sed: ['',
        'седативное отпустило: вялость и туман в голове, а тревога вернулась — сильнее, чем была; сон не идёт',
        'откат после седативного: разбитость, руки не слушаются, беспокойство без причины, вздрагивает от звуков; ночью не уснёт'],
    pain: ['',
        'обезболивающее отпускает: боль возвращается, всё раздражает, не сидится на месте; обидное цепляет сильнее обычного',
        'откат после обезболивающего: ломит, знобит, зевает и не может уснуть, срывается на мелочах; одиночество и обида режут острее, чем должны'],
    stim: ['',
        'стимулятор отпустил: усталость вернулась разом, с процентами; вялость, раздражительность, тянет есть и спать',
        'обвал после стимулятора: сил нет совсем, всё серое и бессмысленное, раздражает каждый звук; тянет проспать полсуток'],
};
/** Что заметно окружающим (для персонажа игрока: без того, что человек чувствует). */
export const SEEN = {
    sed: ['', 'движения и речь замедлены, взгляд спокойный, отвечает с задержкой', 'заторможенность, веки тяжёлые, слова с паузами', 'речь смазана, клонит в сон, отвечает невпопад'],
    pain: ['', 'лицо расслабилось, голос ровнее, движения спокойнее', 'зрачки узкие, взгляд плывёт, движения ленивые, почёсывается', 'клюёт носом, дыхание редкое, слова тянутся'],
    stim: ['', 'оживление, быстрая речь, цепкий взгляд', 'зрачки широкие, не сидится, челюсть сжата, речь скачет', 'руки дрожат, дёргается, озирается, вспыхивает от пустяка'],
};
export const SEEN_AFTER = {
    sed: ['', 'вялость, рассеянный взгляд, беспокойные руки', 'разбитость, вздрагивает от звуков, руки подрагивают'],
    pain: ['', 'морщится, ёрзает, раздражается по мелочам', 'знобит, зевает, лицо серое, не находит места'],
    stim: ['', 'вялость, зевает, раздражается', 'серое лицо, еле двигается, засыпает сидя'],
};

/** Строки «как играть» по тому, что сейчас действует: сначала само вещество, потом откаты. sedDeep — стадия седативного с учётом спиртного. */
export function chemLines(cz) {
    const out = [];
    if (!cz?.any) return out;
    for (const k of KINDS) { const st = k === 'sed' ? cz.sedDeep || cz.on.sed : cz.on[k]; if (st) out.push(ON_TEXT[k][st]); }
    for (const k of KINDS) if (cz.after[k] && !cz.on[k]) out.push(AFTER_TEXT[k][cz.after[k]]);
    if (cz.fog && !out.some(x => /кусками|провал|обрывки/.test(x))) out.push('этот час потом вспомнит кусками');
    return out;
}
/** То же, но только видимое со стороны — для персонажа игрока. */
export function seenLines(st) {
    const out = [];
    if (!st?.any) return out;
    for (const k of KINDS) if (st.on[k]) out.push(`${STAGE[k][st.on[k]]} — ${SEEN[k][st.on[k]]}`);
    for (const k of KINDS) if (st.after[k] && !st.on[k]) out.push(`${AFTER[k][st.after[k]]} — ${SEEN_AFTER[k][st.after[k]]}`);
    return out;
}

const TIP = {
    sed: ['', 'успокоительное: острое сглажено, испуг и тревога глуше', 'сильное седативное: заторможенность, час запомнится кусками', 'седативного слишком много: разговора не выйдет, наутро — провал'],
    pain: ['', 'обезболивающее: боль тише, всё чуть дальше', 'сильное обезболивающее: тепло и далеко, обидное и страшное — как через вату', 'обезболивающего слишком много: клонит в сон, слова тянутся'],
    stim: ['', 'стимулятор: усталость отложена, речь быстрее, уверенности больше', 'на взводе: тянет на риск, раздражают помехи, не уснуть', 'стимулятора слишком много: дёрганость и подозрительность'],
};
const AFTER_TIP = {
    sed: 'вялость, возврат тревоги, плохой сон',
    pain: 'боль вернётся громче, раздражительность, обидное цепляет сильнее',
    stim: 'усталость вернётся с процентами: вялость, раздражительность, сон и голод',
};
/** Подсказки игроку про его персонажа: что за стадия, когда выветрится, чего ждать потом. */
export function chemTips(s, tol = 1) {
    const out = [];
    const k = clamp(tol, 0.4, 6);
    for (const kind of KINDS) {
        const c = s?.chem?.[kind], st = stageOf(c?.lvl);
        if (st) {
            out.push(TIP[kind][st]);
            out.push(`${KIND_NAME[kind]}: если больше не принимать — отпустит примерно за ${Math.max(1, Math.round(num(c.lvl) / (SPEC[kind].burn * k)))} ч истории`);
            const peak = Math.max(num(c.peak), num(c.lvl));
            if (k < 3 && peak >= SPEC[kind].from) out.push(`потом откат: ${AFTER_TIP[kind]}`);
        }
        const a = s?.after?.[kind];
        if (a && !st) out.push(`${AFTER[kind][Math.round(clamp(a.lvl, 1, 2))]} — ещё ~${Math.max(1, Math.round(num(a.left)))} ч истории: ${AFTER_TIP[kind]} — если захочешь сыграть`);
    }
    if (s?.fog) out.push('по счёту этот час помнится кусками — можно сыграть провал');
    return out;
}
