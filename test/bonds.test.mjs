// Проверка линзы привязанности, ревности, доминанты, роли сильного и юмора: node --test test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../core/psyche.js';
import * as D from '../core/drives.js';
import { tie, pairStats, lens, haven, afterHurt, jealMul } from '../core/bonds.js';

const T = (over = {}) => P.normTemper({ ...P.defaultTemper(), ...over });
const mk = (t = T()) => D.healDrives(P.fresh(t));
const LOVE = { trust: 90, closeness: 100, love: 100, desire: 80, jealousy: 10, tension: 10, guilt: 5, pin: { love: 100, closeness: 100 } };
const FRIEND = { trust: 80, closeness: 90, love: 0, tension: 10 };
const STRANGER = { trust: 50, closeness: 50, love: 0 };
const E0 = { val: 5, aro: 0, ctl: 10, wor: 5 };

test('привязанность: любовь под замком — единица; дружба держит, но не выше 0.8; чужой — ноль', () => {
    const a = tie(LOVE), b = tie(FRIEND), c = tie(STRANGER);
    assert.equal(a.L, 1); assert.equal(a.fixed, true);
    assert.ok(b.L >= 0.5 && b.L <= 0.8, `дружба ${b.L}`);
    assert.equal(c.L, 0);
    assert.equal(tie(null), null);
});

test('умные статы пары: прощает и гавань — от любви и доверия; накопилось — гаснут; неуверенность взводит ревность', () => {
    const t = tie(LOVE);
    const calm = pairStats(t, { E: E0, dr: { bond: 70 } });
    assert.ok(calm.blur >= 85 && calm.haven >= 80);
    assert.ok(calm.fuse <= 45, `уверенный в себе ревнует слабо: ${calm.fuse}`);
    const shaky = pairStats(t, { E: { ...E0, wor: -60 }, dr: { bond: 20 }, bel: 1 });
    assert.ok(shaky.fuse >= 80 && shaky.dread >= 80, `неуверенный: ${shaky.fuse} / ${shaky.dread}`);
    const sour = pairStats(tie({ ...LOVE, tension: 95 }), { E: E0, dr: { bond: 70 } });
    assert.equal(sour.blur, 0); assert.equal(sour.haven, 0);
    assert.deepEqual(pairStats(null), { blur: 0, haven: 0, fuse: 0, dread: 0 });
});

test('линза: мелкое плохое от любимого размывает и не даёт осесть; сильное, уход и соперник — больнее', () => {
    const t = tie(LOVE), st = pairStats(t, { E: E0, dr: { bond: 70 } });
    const soft = lens({ blow: 2, wrong: 1 }, t, st);
    assert.ok(soft.kmul.blow <= 0.65 && soft.kmood.blow <= 0.5, JSON.stringify(soft));
    assert.ok(soft.tags.includes('blur'));
    const hard = lens({ blow: 3 }, t, st);
    assert.ok(hard.kmul.blow === undefined && hard.kmood.blow === undefined && hard.tags.includes('deep'), 'сильное любовь не размывает и не усиливает');
    const gone = lens({ loss: 2 }, t, st);
    assert.equal(gone.kmul.loss, 1.2); assert.equal(gone.kmood.loss, 1.3); assert.ok(gone.tags.includes('deep'));
    assert.equal(lens({ loss: 3 }, t, st).kmul.loss, undefined);
    const warm = lens({ warm: 2 }, t, st);
    assert.equal(warm.kmul.warm, 1.3); assert.ok(warm.tags.includes('glow'));
    // чужой: линзы нет
    assert.deepEqual(lens({ blow: 2, loss: 2, warm: 2 }, tie(STRANGER), pairStats(tie(STRANGER), { E: E0 })).kmul, {});
});

test('линза: накопилось — любовь больше не размывает, и мелочь читается уколом; от чужого добра не ждал — цепляет', () => {
    const t = tie({ ...LOVE, tension: 90 }), st = pairStats(t, { E: E0 });
    const x = lens({ blow: 1, warm: 2 }, t, st);
    assert.ok(x.kmul.blow > 1 && x.tags.includes('sour') && !x.tags.includes('blur'));
    assert.ok((x.kmul.warm || 1) <= 1.05, 'и тепло сейчас не греет сильнее');
    const cold = tie({ trust: 10, closeness: 20 });
    assert.ok(lens({ warm: 2 }, cold, pairStats(cold, { E: E0 })).tags.includes('surprise'));
});

test('поручень: то же слово от любимого задевает слабее и проходит быстрее, уход — сильнее; потолок не пробит', () => {
    const t = T(), ti = tie(LOVE);
    const a = mk(t), b = mk(t);
    const L = lens({ blow: 2 }, ti, pairStats(ti, { E: P.eff(a) }));
    const da = P.hit(a, { blow: 2 }, t, { kmul: L.kmul, kmood: L.kmood });
    const db = P.hit(b, { blow: 2 }, t);
    assert.ok(Math.abs(da.wor) < Math.abs(db.wor) * 0.7, `${da.wor} против ${db.wor}`);
    assert.ok(Math.abs(a.mood.wor) < Math.abs(b.mood.wor) * 0.35, 'в настроении почти не осело');
    const c = mk(t), d = mk(t);
    const L2 = lens({ loss: 2 }, ti, pairStats(ti, { E: P.eff(c) }));
    assert.ok(Math.abs(P.hit(c, { loss: 2 }, t, { kmul: L2.kmul, kmood: L2.kmood }).val) > Math.abs(P.hit(d, { loss: 2 }, t).val) * 1.15);
    assert.ok(Math.abs(c.mood.val) > Math.abs(d.mood.val) * 1.4, 'и оседает глубже');
    // самое тяжёлое сочетание: больное место, сырые нервы, любимый человек, сила 3
    const hot = T({ react: 1.4, sens: { ...P.defaultTemper().sens, loss: 1.5 } });
    const e = mk(hot); e.strain = 95; e.hang = { until: null };
    const dv = P.hit(e, { loss: 3 }, hot, { raw: 1.5, kmul: { loss: 1.4 } });
    assert.ok(Math.abs(dv.val) <= P.STEP[3] * P.TOTAL_CAP + 1, `потолок: ${dv.val}`);
});

test('ревность: с любовью и неуверенностью берёт всерьёз, уверенного — задевает, без привязанности — почти никак', () => {
    const ti = tie(LOVE), t = T();
    const sure = pairStats(ti, { E: E0, dr: { bond: 70 } }), shaky = pairStats(ti, { E: { ...E0, wor: -55 }, dr: { bond: 25 }, bel: 0.9 });
    assert.ok(jealMul(shaky) > jealMul(sure) * 1.5);
    const a = mk(t), b = mk(t), c = mk(t);
    P.hit(a, { rival: 2 }, t, { kmul: { rival: jealMul(shaky) } }); P.jealUp(a, 2, jealMul(shaky));
    P.hit(b, { rival: 2 }, t, { kmul: { rival: jealMul(sure) } }); P.jealUp(b, 2, jealMul(sure));
    P.hit(c, { rival: 2 }, t, { kmul: { rival: jealMul(pairStats(tie(STRANGER), { E: E0 })) } }); P.jealUp(c, 2, 0.25);
    assert.ok(a.jeal >= 30 && b.jeal < 25 && c.jeal < 10, `${a.jeal} / ${b.jeal} / ${c.jeal}`);
    assert.ok(P.dominant(P.eff(a), a.base).id, 'есть чувство');
    assert.equal(P.dominant(P.eff(c), c.base).step <= 1, true);
    // остывает за полсуток наполовину
    const before = a.jeal; P.decay(a, 12, t);
    assert.ok(Math.abs(a.jeal - before / 2) < 1.5);
    // во что выливается
    a.jeal = 60;
    assert.equal(P.jealStyle(a, { val: -30, aro: 30, ctl: 20, wor: 0 }, { id: 'anger', step: 2 }), 'open');
    assert.equal(P.jealStyle(a, { val: -20, aro: 10, ctl: -10, wor: -50 }, { id: 'shame', step: 2 }), 'quiet');
    assert.equal(P.jealStyle(a, { val: -10, aro: 30, ctl: -30, wor: -10 }, { id: 'fear', step: 2 }), 'cling');
    assert.equal(P.jealStyle(c, E0, { id: '', step: 0 }), '');
    assert.equal(D.combos({ s: a, dom: { id: 'shame', step: 2 }, jeal: 'quiet' })[0].id, 'jealous');
});

test('гавань и «после того, как прилетело»', () => {
    const ti = tie(LOVE), st = pairStats(ti, { E: E0, dr: { bond: 70 } });
    const h = haven(st);
    assert.ok(h.on && h.threat < 0.85 && h.ease > 0.8);
    assert.equal(haven(st, true).on, false, 'сам за него боится — близость не успокаивает');
    assert.equal(afterHurt(ti, st), 'mend');
    assert.equal(afterHurt(ti, pairStats(ti, { E: { ...E0, wor: -60 }, dr: { bond: 20 }, bel: 1 })), 'guard');
    assert.equal(afterHurt(tie(STRANGER), st), '');
});

test('доминанта: чувство держится, пока соперник не обгонит всерьёз; залипает; стягивает постороннее', () => {
    const base = { val: 0, aro: 0, ctl: 0, wor: 0 };
    const E = { val: -42, aro: 20, ctl: 0, wor: -30 };
    const free = P.dominant(E, base);
    const other = free.id === 'shame' ? 'anger' : 'shame';
    assert.ok(Math.abs(free.all.shame - free.all.anger) < P.DOM_MARGIN, `нужны близкие чувства: ${JSON.stringify(free.all)}`);
    const held = P.dominant(E, base, other);
    assert.equal(held.id, other); assert.equal(held.held, true);
    const far = P.dominant({ val: -80, aro: 60, ctl: 20, wor: -30 }, base, 'shame');
    assert.equal(far.id, 'anger', 'обогнало всерьёз — перехватило');
    const s = mk();
    P.setDominant(s, { id: 'shame', step: 2 }, { ts: 0, mes: 1 });
    P.setDominant(s, { id: 'shame', step: 3 }, { ts: 5 * 3.6e6, mes: 9 });
    assert.equal(s.dom.ts, 0, 'то же чувство — отсчёт не сбрасывается');
    assert.equal(P.stuck(s, { id: 'shame', step: 2 }, 7 * 3.6e6), true);
    assert.equal(P.stuck(s, { id: 'shame', step: 1 }, 7 * 3.6e6), false);
    assert.equal(P.stuck(s, { id: 'tender', step: 3 }, 7 * 3.6e6), false);
    const w0 = s.fast.wor;
    assert.ok(P.feedDominant(s, 'shame', 30) > 0 && s.fast.wor < w0);
    assert.ok(D.combos({ s, dom: { id: 'shame', step: 2 }, stuck: true }).some(c => c.id === 'loop'));
});

test('роль сильного: дни подряд копятся, открылся или сорвался — с нуля; трещит позже у того, у кого воли больше', () => {
    const t = T(), s = mk(t);
    for (let d = 1; d <= 6; d++) { P.roleHit(s, { held: 1 }, `d${d}`); P.roleDay(s, `d${d}`); }
    assert.equal(s.role, 6);
    assert.equal(P.roleBand(s, t), 1);
    assert.equal(P.roleBand(s, T({ grit: 1.8 })), 0, 'железная выдержка держит дольше');
    P.roleDay(s, 'd6'); P.roleHit(s, { held: 2 }, 'd7'); P.roleDay(s, 'd7'); P.roleDay(s, 'd7');
    s.role = 8;
    assert.equal(P.roleBand(s, t), 2);
    assert.equal(D.combos({ s, dom: { id: '', step: 0 }, role: 2 })[0].id, 'crack');
    P.roleHit(s, { open: 2 }, 'd9');
    assert.equal(s.role, 0);
    s.role = 5; P.resolveBreak(s, { ts: 0, mes: 1 });
    assert.equal(s.role, 0);
    // спокойные дни без маски счёт снимают
    s.role = 3; s.mask = 0; s.heldDay = null; P.roleDay(s, 'd20');
    assert.equal(s.role, 1);
});

test('юмор и эхо воспоминания', () => {
    const t = T(), s = mk(t);
    assert.equal(P.witOf(s, { val: 30, aro: 30, ctl: 10, wor: 5 }, { id: 'playful', step: 1 }, t), 'aff');
    assert.equal(P.witOf(s, { val: -40, aro: 40, ctl: 10, wor: 0 }, { id: 'anger', step: 2 }, t), 'aggr');
    assert.equal(P.witOf(s, { val: -20, aro: 0, ctl: 0, wor: -50 }, { id: 'shame', step: 2 }, t), 'def');
    assert.equal(P.witOf(s, { val: -20, aro: 60, ctl: -60, wor: 0 }, { id: 'fear', step: 3 }, t), '', 'в настоящем страхе не шутят');
    assert.equal(P.witOf(s, { val: 30, aro: 30, ctl: 10, wor: 5 }, { id: 'playful', step: 1 }, T({ wit: 0 })), '', 'кто не шутит — не шутит');
    s.strain = 60;
    assert.equal(P.witOf(s, { val: 2, aro: 0, ctl: 10, wor: 5 }, { id: '', step: 0 }, t), 'self');
    const v0 = s.fast.val;
    const d = P.echo(s, 'low', 3);
    assert.ok(d.val < 0 && s.fast.val < v0);
    assert.equal(P.echo(s, 'nope'), null);
});

test('поручень: одно событие через линзу любви не уносит на предел даже ранимого', () => {
    const t = T({ base: { val: 5, aro: 0, ctl: 10, wor: -20 }, react: 1.1, sens: { ...P.defaultTemper().sens, blow: 1.4, bound: 1.4, loss: 1.4 } });
    const ti = tie({ ...LOVE, jealousy: 60 });
    for (const k of ['blow', 'wrong', 'bound', 'loss', 'rival']) {
        const s = mk(t);
        const E = P.eff(s);
        const st = pairStats(ti, { E, dr: s.dr, bel: 1 });
        const L = lens({ [k]: 3 }, ti, st);
        P.hit(s, { [k]: 3 }, t, { kmul: L.kmul, kmood: L.kmood });
        const dom = P.dominant(P.eff(s), s.base);
        assert.ok(dom.lvl < P.STEPS_AT[3], `${k} 3 от любимого → ${dom.id} ${dom.lvl}`);
        // а заметное (2) остаётся в пределах второй ступени
        const s2 = mk(t);
        const L2 = lens({ [k]: 2 }, ti, pairStats(ti, { E: P.eff(s2), dr: s2.dr, bel: 1 }));
        P.hit(s2, { [k]: 2 }, t, { kmul: L2.kmul, kmood: L2.kmood });
        assert.ok(P.dominant(P.eff(s2), s2.base).step <= 2, `${k} 2 от любимого → ступень ${P.dominant(P.eff(s2), s2.base).step}`);
    }
});

// ───── 0.6: поправки по исследованиям ─────

test('держать лицо: у отдохнувшего дешевле, у вымотанного дороже; чистого «истощения воли» почти нет', () => {
    const t = T();
    const a = mk(t), b = mk(t), c = mk(t);
    P.hit(a, { held: 2 }, t, { drain: 0.8 }); P.hit(b, { held: 2 }, t); P.hit(c, { held: 2 }, t, { drain: 1.5 });
    assert.ok(a.will > b.will && b.will > c.will, `${a.will} > ${b.will} > ${c.will}`);
    const dom = { id: 'shame', lvl: 80, step: 3 };
    assert.ok(P.holdCost(mk(t), dom, 0.8) < P.holdCost(mk(t), dom, 1.5));
});

test('эмоциональная инерция: при низкой самооценке плохое настроение держится дольше, хорошее — как у всех', () => {
    const t = T();
    const a = mk(t), b = mk(t);
    a.mood.val = -40; b.mood.val = -40; b.mood.wor = -60;
    P.decay(a, 10, t); P.decay(b, 10, t);
    assert.ok(b.mood.val < a.mood.val - 2, `${b.mood.val} против ${a.mood.val}`);
    const c = mk(t), d = mk(t);
    c.mood.val = 40; d.mood.val = 40; d.base.wor = -45;
    P.decay(c, 10, t); P.decay(d, 10, t);
    assert.ok(Math.abs(c.mood.val - d.mood.val) < 0.6, 'тепло уходит одинаково');
});

test('выплеснутая злость не разряжает: после срыва в злости напряжение остаётся высоким', () => {
    const t = T();
    const a = mk(t), b = mk(t);
    for (const s of [a, b]) { s.strain = 95; s.fast.aro = 40; }
    a.brk = { mes: 1, emo: 'anger' }; b.brk = { mes: 1, emo: 'low' };
    P.resolveBreak(a, { ts: 0, mes: 2 }); P.resolveBreak(b, { ts: 0, mes: 2 });
    assert.equal(a.strain, 72); assert.equal(b.strain, 55);
    assert.equal(a.fast.aro, 40, 'взвод не упал'); assert.equal(b.fast.aro, 0);
    assert.ok(a.hang && b.hang && !a.brk && !b.brk);
});

test('ущемление сильнее нехватки: придавленная потребность отзывается сразу, а не когда шкала опустеет', () => {
    const t = T();
    const s = mk(t);
    D.driveHit(s, { bound: 2 }, t);
    assert.ok(s.dr.free > 35, `шкала ещё не пустая: ${s.dr.free}`);
    assert.ok(s.drf.free >= 0.6);
    assert.ok(D.combos({ s, dom: { id: 'anger', step: 1 } }).some(c => c.id === 'rebel'));
    assert.ok(D.combos({ s, dom: { id: '', step: 0 } }).some(c => c.id === 'chafe'));
    D.driveDecay(s, 36, t, {});
    assert.ok(!D.combos({ s, dom: { id: '', step: 0 } }).some(c => c.id === 'chafe'), 'через полтора дня отпустило');
    // слабый удар — не ущемление
    const s2 = mk(t); D.driveHit(s2, { bound: 1 }, t);
    assert.ok(!D.combos({ s: s2, dom: { id: '', step: 0 } }).some(c => c.id === 'chafe'));
    // держит лицо — близость до него не доходит
    const s3 = mk(t); const b0 = s3.dr.bond; D.driveHit(s3, { held: 2 }, t);
    assert.ok(s3.dr.bond < b0);
});
