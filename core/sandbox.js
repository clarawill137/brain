// Код-мозг — Песочница: два героя играют сцену без игрока, игрок — режиссёр.
// Нейронка пишет ход и говорит, что он сделал с обоими; код считает, что с каждым стало, и из этого собирает
// состояние для следующего хода. Состояние героев — копия настоящего на момент старта: дальше оно живёт своей
// жизнью и в чат не возвращается. Чистые данные и функции: без Таверны, Life и DOM.

import * as P from './psyche.js';
import { EMO_NAME, WILL_TEXT, cassOf, cassText } from './cassettes.js';

export const SAND_MAX = 40;            // ходов в одной сцене
export const SAND_STEP_H = 3 / 60;     // один ход — около трёх минут истории
export const SPANS = [1, 3, 5, 999];   // на сколько ходов действует скрытый мотив или событие извне

const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const span = (x) => { const t = str(x?.t, 300); return t ? { t, left: SPANS.includes(+x?.left) ? +x.left : 3 } : null; };

/**
 * Новая сцена. o: { a, b, place, setup, first, opening, motive: { [имя]: { t, left } }, cond: { [имя]: '…' },
 * event: { t, left } }; states — { [имя]: состояние мозга } (берутся копии).
 */
export function sandNew(o, states) {
    const cast = [str(o.a, 80), str(o.b, 80)];
    return {
        cast,
        place: str(o.place, 160),
        setup: str(o.setup, 300),
        opening: str(o.opening, 300),
        next: cast.includes(o.first) ? o.first : cast[0],
        motive: Object.fromEntries(cast.map(n => [n, span(o.motive?.[n])])),
        cond: Object.fromEntries(cast.map(n => [n, str(o.cond?.[n], 200)])),
        event: span(o.event),
        st: Object.fromEntries(cast.map(n => [n, clone(states?.[n]) || P.fresh()])),
        turns: [],
        at: Date.now(),
    };
}
export const sandOther = (sb, who) => sb.cast.find(n => n !== who) || sb.cast[0];

/** Что с героем сейчас — цифрами, для листа: { E, emo, step, name, will, strain, mask, leak, brk }. */
export function sandView(s, temper) {
    const E = P.eff(s);
    const dom = P.dominant(E, s.base, s.dom?.id || '');
    return {
        E: Object.fromEntries(P.AXES.map(a => [a, Math.round(E[a])])),
        emo: dom.id, step: dom.step, name: dom.id ? EMO_NAME[dom.id][dom.step - 1] : 'ровно',
        will: Math.round(s.will), strain: Math.round(s.strain), mask: Math.round(s.mask),
        leak: !!P.leakOf(s), brk: !!s.brk,
    };
}
/** Что у героя внутри — словами для модели, которая пишет ЕГО ход. Цифр нет: модели нужны поведение и манера. */
export function sandInner(s, temper) {
    const v = sandView(s, temper);
    const bits = [];
    if (s.brk) return `срыв в этом ходе: ${cassText(temper, 'brk')}${s.brk.why ? ` — последняя капля: ${s.brk.why}` : ''}`;
    bits.push(v.emo ? `${v.name} — ${cassOf(temper, v.emo, v.step)}` : 'ровно: ничего не давит');
    const band = P.willBand(s.will);
    if (band < 2 && WILL_TEXT[band]) bits.push(WILL_TEXT[band]);
    if (v.leak) bits.push(`скрываемое просится наружу — ${cassText(temper, 'leak')}`);
    if (v.strain >= 60) bits.push('нервы на пределе: мелочь может стать последней каплей');
    return bits.join('; ');
}
/** Что видно со стороны — для хода ВТОРОГО героя: чужого нутра он не знает. */
export function sandSeen(s, temper) {
    const v = sandView(s, temper);
    if (s.brk) return 'сорвался — это видно всем';
    if (!v.emo || v.step < 2) return v.strain >= 60 ? 'держится ровно, но натянут' : 'держится ровно';
    return P.willBand(s.will) >= 2 && !v.leak ? `сдерживается; сквозь это проступает: ${v.name}` : `по нему видно: ${v.name}`;
}

/**
 * Ход сделан: время идёт у обоих, события ложатся на каждого. rows — строки «что этот ход сделал» от модели
 * ([{ who, by, warm: 2, …, why }]); tempers — { [имя]: темперамент }; o.same(x, y) — одно ли это имя;
 * o.kmul(кому, от кого, hits) — множители пары (троп). → { [имя]: { hits, why, d, view, brk } }.
 * Поручень тот же, что в чате: силу события ограничивает ядро (P.hit), сюда лишних множителей не добавляем.
 */
export function sandApply(sb, speaker, rows, tempers, o = {}) {
    const same = o.same || ((x, y) => x === y);
    const out = {};
    for (const n of sb.cast) {
        const s = sb.st[n], t = tempers?.[n];
        if (s.brk) { P.resolveBreak(s, {}, 10); s.brk = null; }           // срыв прожит прошлым ходом
        P.decay(s, SAND_STEP_H, t);
        const mine = (Array.isArray(rows) ? rows : []).filter(r => r && typeof r === 'object' && same(String(r.who || ''), n)).slice(0, 3);
        let hits = {};
        for (const r of mine) hits = P.mergeHits(hits, P.cleanHits(r));
        const other = sandOther(sb, n);
        const d = Object.keys(hits).length ? P.hit(s, hits, t, { kmul: o.kmul ? o.kmul(n, other, hits) : {} }) : null;
        const E = P.eff(s);
        const dom = P.dominant(E, s.base, s.dom?.id || '');
        // держать лицо стоит сил — тому, кто только что говорил
        if (n === speaker) P.holdCost(s, dom, 1);
        const kind = P.breakCheck(s, E, hits);
        const why = mine.map(r => str(r.why, 90)).filter(Boolean).join('; ');
        if (kind) s.brk = { kind, why, emo: dom.id || '' };
        P.setDominant(s, dom, { mes: sb.turns.length });
        out[n] = { hits, why, d: d ? Object.fromEntries(Object.entries(d).map(([k, x]) => [k, Math.round(x)]).filter(([, x]) => x)) : {}, view: sandView(s, t), brk: !!kind };
    }
    return out;
}
/** Записать ход и передать слово второму; сроки скрытых мотивов и события извне идут на убыль. */
export function sandPush(sb, who, text, thought, effect) {
    sb.turns.push({ who, text: str(text, 2400), thought: str(thought, 260), fx: effect || {}, ev: sb.event?.t || '', mot: sb.motive[who]?.t || '' });
    if (sb.turns.length > SAND_MAX) sb.turns.shift();
    const m = sb.motive[who];
    if (m && m.left < 999 && --m.left <= 0) sb.motive[who] = null;
    if (sb.event && sb.event.left < 999 && --sb.event.left <= 0) sb.event = null;
    sb.next = sandOther(sb, who);
    return sb;
}
/** Режиссёр правит последний ход руками: текст меняется, счёт остаётся. */
export function sandEdit(sb, text) {
    const last = sb.turns[sb.turns.length - 1];
    if (last) { last.text = str(text, 2400); last.hand = true; }
    return sb;
}
/** Задать событие извне или скрытый мотив посреди сцены. */
export function sandSet(sb, what, who, x) {
    if (what === 'event') sb.event = span(x);
    if (what === 'motive' && sb.cast.includes(who)) sb.motive[who] = span(x);
    return sb;
}
/** Последние ходы текстом — для запроса. */
export const sandScript = (sb, short, n = 8) => sb.turns.slice(-n).map(t => `${short ? short(t.who) : t.who}: ${t.text}`).join('\n\n');
