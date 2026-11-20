// Проверка потребностей, комбинаций, подсказок и памяти с чувством: node --test test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../core/psyche.js';
import * as D from '../core/drives.js';
import { hints } from '../core/hints.js';

const T = (over = {}) => P.normTemper({ ...P.defaultTemper(), ...over });
const mk = (t = T()) => D.healDrives(P.fresh(t));

test('потребности: события кормят и отнимают; кому нужнее — теряет больнее', () => {
    const t = T();
    const s = mk(t);
    assert.deepEqual(s.dr, D.REST);
    D.driveHit(s, { warm: 2 }, t);
    assert.equal(Math.round(s.dr.bond), 80);
    assert.ok(s.dr.safe > D.REST.safe);
    D.driveHit(s, { loss: 3 }, t);
    assert.ok(s.dr.bond < 40);
    const needy = T({ want: { bond: 1.5 } });
    const a = mk(t), b = mk(needy);
    D.driveHit(a, { loss: 2 }, t); D.driveHit(b, { loss: 2 }, needy);
    assert.ok(b.dr.bond < a.dr.bond);
    D.driveHit(a, { warm: 2 }, t); D.driveHit(b, { warm: 2 }, needy);
    assert.equal(Math.round(a.dr.bond - b.dr.bond), Math.round(22 * 1.2 * 0.5), 'хорошее кормит всех одинаково');
    for (let k = 0; k < 20; k++) D.driveHit(s, { threat: 3, bound: 3, loss: 3, blow: 3 }, t);
    for (const k of D.DRIVES) assert.ok(s.dr[k] >= 0 && s.dr[k] <= 100);
});

test('потребности: близость тает в разлуке и набирается рядом; без близкого человека — держится у нормы', () => {
    const t = T();
    const s = mk(t);
    D.driveDecay(s, 24, t, { together: false });
    assert.equal(Math.round(s.dr.bond), 36);
    D.driveDecay(s, 10, t, { together: true });
    assert.equal(Math.round(s.dr.bond), 51);
    D.driveDecay(s, 100, t, { together: true });
    assert.equal(s.dr.bond, 75, 'рядом — до семидесяти пяти, выше только событиями');
    const lone = mk(t);
    lone.dr.bond = 10;
    D.driveDecay(lone, 24 * 14, t, { together: null });
    assert.ok(Math.abs(lone.dr.bond - D.REST.bond) < 2, 'у кого нет близкого — не голодает вечно');
});

test('потребности: рутина давит через неделю с лишним, толпа выматывает, тишина возвращает', () => {
    const t = T();
    const s = mk(t);
    D.driveDecay(s, 72, t, { together: true });
    assert.ok(s.dr.novel > 40, `три дня — ещё не скучно: ${s.dr.novel}`);
    D.driveDecay(s, 24 * 7, t, { together: true });
    assert.ok(s.dr.novel < 25);
    D.driveDecay(s, 10, t, { crowd: 6 });
    assert.ok(s.dr.quiet < 45);
    D.driveDecay(s, 8, t, { crowd: 2 });
    assert.ok(s.dr.quiet > 75);
    s.dr.safe = 20;
    D.driveDecay(s, 48, t, {});
    assert.ok(s.dr.safe > 55, 'безопасность возвращается за пару спокойных дней');
});

test('комбинации: одна и та же потребность с разным чувством даёт разное поведение', () => {
    const t = T();
    const s = mk(t);
    const ids = (dom, patch = {}, worry = false) => { Object.assign(s.dr, D.REST, patch); return D.combos({ s, dom, worry }).map(c => c.id); };
    assert.deepEqual(ids({ id: '', step: 0 }), [], 'все сыты — ничего');
    assert.equal(ids({ id: 'shame', step: 2 }, { bond: 20 })[0], 'starve');
    assert.equal(ids({ id: 'fear', step: 1 }, { bond: 15 })[0], 'cling');
    assert.equal(ids({ id: 'tender', step: 1 }, { bond: 20 })[0], 'reach');
    assert.equal(ids({ id: 'low', step: 1 }, { bond: 20 })[0], 'ache');
    assert.equal(ids({ id: 'anger', step: 1 }, { free: 15 })[0], 'rebel');
    assert.equal(ids({ id: 'fear', step: 2 }, { free: 15 })[0], 'yield');
    assert.equal(ids({ id: '', step: 0 }, { free: 15 })[0], 'chafe');
    assert.equal(ids({ id: '', step: 0 }, { safe: 20 })[0], 'guard');
    assert.equal(ids({ id: '', step: 0 }, { safe: 20 }, true)[0], 'control');
    assert.equal(ids({ id: '', step: 0 }, { need: 20 })[0], 'useful');
    assert.equal(ids({ id: 'low', step: 1 }, { need: 20 })[0], 'useless');
    assert.equal(ids({ id: '', step: 0 }, { quiet: 10 })[0], 'peopled');
    assert.equal(ids({ id: '', step: 0 }, { novel: 5 })[0], 'bored');
    assert.deepEqual(ids({ id: 'anger', step: 2 }, { novel: 5 }), [], 'когда злится — не до скуки');
    assert.equal(ids({ id: 'tender', step: 1 }, { safe: 90, bond: 80 })[0], 'rest');
    // несколько сразу — сильнейшая первой
    const many = ids({ id: 'anger', step: 2 }, { free: 5, safe: 30 });
    assert.equal(many[0], 'rebel');
    assert.ok(many.includes('guard'));
    s.will = 10;
    assert.equal(ids({ id: '', step: 0 }, { free: 15 })[0], 'yield', 'без сил — не спорит, а сдаётся');
});

test('комбинации: тексты без рода и без цифр', () => {
    const t = T();
    const s = mk(t);
    const all = new Set();
    const doms = [{ id: '', step: 0 }, { id: 'fear', step: 2 }, { id: 'anger', step: 2 }, { id: 'shame', step: 2 }, { id: 'low', step: 2 }, { id: 'tender', step: 2 }];
    for (const dom of doms) for (const worry of [false, true]) for (const will of [80, 10]) {
        s.will = will;
        Object.assign(s.dr, { bond: 10, safe: 10, free: 10, need: 10, quiet: 10, novel: 5 });
        for (const c of D.combos({ s, dom, worry })) all.add(c.t);
        Object.assign(s.dr, { bond: 90, safe: 95, free: 90, need: 90, quiet: 90, novel: 90 });
        s.strain = 5;
        for (const c of D.combos({ s, dom, worry })) all.add(c.t);
    }
    assert.ok(all.size >= 12, `комбинаций: ${all.size}`);
    for (const text of all) {
        assert.ok(!/\d/.test(text), text);
        assert.ok(!/(?<![а-яё])(устал|соскучился|засиделся|готов|должен|один|одному|самому|сам)(?![а-яё])/i.test(text), `род в тексте: ${text}`);
    }
});

test('память с чувством: сильное запоминается, всплывает в тон состоянию, не сразу и не подряд', () => {
    const t = T();
    const s = mk(t);
    assert.equal(P.mark(s, { mes: 10, day: '1 дек', t: '', emo: 'low', w: 3 }), null);
    P.mark(s, { mes: 10, day: '1 дек', t: 'она ушла, хлопнув дверью', emo: 'low', w: 3 });
    P.mark(s, { mes: 12, day: '1 дек', t: 'назвал его убийцей', emo: 'shame', w: 3 });
    P.mark(s, { mes: 14, day: '2 дек', t: 'она сказала «я выбрала тебя сама»', emo: 'tender', w: 3 });
    assert.equal(P.mark(s, { mes: 10, day: '1 дек', t: 'дубль', emo: 'low', w: 3 }), null, 'свайп не плодит метки');
    assert.equal(s.marks.length, 3);
    assert.equal(P.pickRecall(s, { id: 'low', step: 2 }, 20), null, 'свежее не всплывает');
    assert.equal(P.pickRecall(s, { id: 'low', step: 1 }, 60), null, 'на слабом чувстве не всплывает');
    assert.equal(P.pickRecall(s, { id: 'low', step: 2 }, 60).t, 'она ушла, хлопнув дверью');
    assert.equal(P.pickRecall(s, { id: 'fear', step: 2 }, 60).emo, 'shame', 'нет того же чувства — берёт того же знака, тяжёлое и свежее');
    assert.equal(P.pickRecall(s, { id: 'tender', step: 2 }, 60).emo, 'tender', 'в тепле всплывает хорошее');
    const m = P.pickRecall(s, { id: 'low', step: 3 }, 60);
    m.r = 60;
    assert.notEqual(P.pickRecall(s, { id: 'low', step: 3 }, 70)?.id, m.id, 'то же самое подряд не всплывает');
    assert.equal(P.pickRecall(s, { id: 'low', step: 3 }, 90).id, m.id);
    for (let k = 0; k < 60; k++) P.mark(s, { mes: 100 + k, t: `мелочь ${k}`, emo: 'anger', w: 1 });
    assert.equal(s.marks.length, 40);
    assert.ok(s.marks.some(x => x.t === 'назвал его убийцей'), 'тяжёлое не вытесняется мелочью');
});

test('подсказки игроку: что сработает, что добьёт, чего ждать', () => {
    const t = T({ fix: ['её голос', 'дело для рук'], sens: { blow: 1.4, bound: 1.3 }, beliefs: [{ t: 'я испорченный' }] });
    const s = mk(t);
    const calm = hints({ s, t, dom: { id: '', step: 0 }, leak: 0, fore: {} });
    assert.deepEqual(calm.help, []);
    assert.match(calm.hurt[0], /больные места: удары по самооценке, потеря контроля/);
    P.hit(s, { blow: 3 }, t); P.hit(s, { blow: 2 }, t);
    s.dr.bond = 20; s.will = 30; s.strain = 70; s.bel[t.beliefs[0].id] = 30;
    const dom = P.dominant(P.eff(s), s.base);
    const h = hints({ s, t, dom, leak: 1, fore: { breakIn: null, rawIn: null, calmIn: 5 }, apart: false });
    assert.ok(h.help.some(x => /стыд: слова отскакивают/.test(x)));
    assert.ok(h.help.some(x => /возвращает в себя: её голос, дело для рук/.test(x)));
    assert.ok(h.help.some(x => /не хватает близости/.test(x)));
    assert.ok(h.help.some(x => /сил мало/.test(x)));
    assert.ok(h.help.some(x => /спроси прямо/.test(x)));
    assert.ok(h.help.some(x => /«я испорченный» шатается/.test(x)));
    assert.ok(h.hurt.some(x => /нервы сырые/.test(x)));
    assert.ok(h.expect.some(x => /отпустит через ~5 ч/.test(x)));
    s.brk = { mes: 1 };
    assert.match(hints({ s, t, dom, leak: 0, fore: {} }).expect[0], /срыв в следующем ответе/);
    s.brk = null; s.strain = 90;
    assert.ok(hints({ s, t, dom, leak: 0, fore: { rawIn: null } }).expect.some(x => /ночь, скорее всего, будет плохой/.test(x)));
    assert.ok(hints({ s, t, dom: { id: '', step: 0 }, leak: 0, fore: {}, apart: true }).expect.some(x => /скучает/.test(x)));
});

test('голод по близости подталкивает: близкий шаг дешевле', () => {
    const t = T();
    const s = mk(t);
    assert.equal(P.afford(s, { id: '', step: 0 }, 'touch', { hungry: true }).cost, 6.4);
    assert.equal(P.afford(s, { id: '', step: 0 }, 'care', { hungry: true }).cost, 3);
});

test('комбинации: близкого нет рядом — голод по близости звучит тоской, а не тягой коснуться', () => {
    const s = P.fresh(P.defaultTemper()); D.healDrives(s); s.dr.bond = 10; s.will = 80;
    const near = D.combos({ s, dom: { id: '', step: 0 } })[0];
    const far = D.combos({ s, dom: { id: '', step: 0 }, apart: true })[0];
    assert.equal(near.id, 'reach'); assert.equal(far.id, 'reach');
    assert.match(near.t, /коснуться/);
    assert.match(far.t, /кого нет рядом/);
    assert.ok(!/коснуться|сесть рядом/.test(far.t));
});
