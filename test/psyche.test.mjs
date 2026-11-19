// Проверка ядра: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../core/psyche.js';

const T = (over = {}) => P.normTemper({ ...P.defaultTemper(), ...over });
const after = (hits, temper = T(), prep = null) => {
    const s = P.fresh(temper);
    if (prep) prep(s);
    const d = P.hit(s, hits, temper);
    return { s, d, E: P.eff(s), dom: P.dominant(P.eff(s)) };
};

test('спокойное состояние — без ведущей эмоции', () => {
    const s = P.fresh(T());
    assert.equal(P.dominant(P.eff(s)).id, '');
    assert.equal(P.willBand(s.will), 3);
});

test('угроза: 1 — не видно, 2 — страх на первой ступени, 3 — сильнее', () => {
    assert.equal(after({ threat: 1 }).dom.id, '');
    const two = after({ threat: 2 }).dom;
    assert.equal(two.id, 'fear');
    assert.equal(two.step, 1);
    const three = after({ threat: 3 }).dom;
    assert.equal(three.id, 'fear');
    assert.ok(three.step >= 2, `ступень ${three.step}`);
});

test('тренированный агент (контроль выше) заметную угрозу держит ровно', () => {
    const t = T({ base: { val: 5, aro: 0, ctl: 28, wor: 5 } });
    assert.equal(after({ threat: 2 }, t).dom.id, '');
    assert.equal(after({ threat: 3 }, t).dom.id, 'fear');
});

test('удар по самооценке: стыд; у кого самоценность ниже — сильнее', () => {
    const plain = after({ blow: 2 }).dom;
    assert.equal(plain.id, 'shame');
    assert.equal(plain.step, 1);
    const low = after({ blow: 2 }, T({ base: { val: 5, aro: 0, ctl: 10, wor: -15 } })).dom;
    assert.equal(low.id, 'shame');
    assert.ok(low.step >= 2);
});

test('фоновая вина сама по себе не даёт заметки', () => {
    const s = P.fresh(T({ base: { val: 0, aro: 0, ctl: 20, wor: -18 } }));
    assert.equal(P.dominant(P.eff(s)).id, '');
});

test('несправедливость → злость, утрата → тоска, тепло → нежность, веселье → кураж', () => {
    assert.equal(after({ wrong: 2 }).dom.id, 'anger');
    assert.ok(after({ wrong: 3 }).dom.step >= 2);
    assert.equal(after({ loss: 2 }).dom.id, 'low');
    assert.equal(after({ warm: 2 }).dom.id, 'tender');
    assert.equal(after({ fun: 2 }).dom.id, 'playful');
});

test('три заметных удара подряд — третья ступень и выше', () => {
    const t = T();
    const s = P.fresh(t);
    for (let k = 0; k < 3; k++) { P.hit(s, { wrong: 2 }, t); P.decay(s, 0.25, t); }
    const dom = P.dominant(P.eff(s));
    assert.equal(dom.id, 'anger');
    assert.ok(dom.step >= 3, `ступень ${dom.step}, уровень ${dom.lvl}`);
});

test('инерция: одна тёплая фраза после тяжёлого не переключает настроение', () => {
    const t = T();
    const s = P.fresh(t);
    P.hit(s, { blow: 3 }, t);
    P.hit(s, { wrong: 2 }, t);
    P.decay(s, 1, t);
    P.hit(s, { warm: 2 }, t);
    const now = P.eff(s);
    P.decay(s, 3, t);          // вспышка тепла погасла — настроение осталось
    const later = P.eff(s);
    assert.ok(later.val < now.val, 'после вспышки тепла настроение возвращается вниз');
    assert.ok(later.val < 0, `валентность ${later.val}`);
    assert.ok(s.mood.wor < -5, 'осадок в самоценности держится');
});

test('отходчивый отходит быстрее', () => {
    const slow = T({ recover: 0.5 }), quick = T({ recover: 2 });
    const a = P.fresh(slow), b = P.fresh(quick);
    P.hit(a, { wrong: 3 }, slow); P.hit(b, { wrong: 3 }, quick);
    P.decay(a, 12, slow); P.decay(b, 12, quick);
    assert.ok(P.eff(b).val > P.eff(a).val);
});

test('вспышка гаснет за пару часов, спокойное состояние возвращается', () => {
    const t = T();
    const s = P.fresh(t);
    P.hit(s, { threat: 2 }, t);
    P.decay(s, 30, t);
    assert.equal(P.dominant(P.eff(s)).id, '');
    assert.ok(s.strain < 15);
});

test('напряжение: приток тянет к равновесию, без притока — спадает', () => {
    const t = T();
    const s = P.fresh(t);
    P.decay(s, 200, t, { strainIn: 1.35 });
    assert.ok(s.strain > 30 && s.strain < 40, `равновесие ${s.strain}`);
    P.decay(s, 72, t, {});
    assert.ok(s.strain < 5);
});

test('воля: «сдержался» тратит, время возвращает, боль ставит потолок, ночь добавляет', () => {
    const t = T();
    const s = P.fresh(t);
    P.hit(s, { held: 3 }, t);
    P.hit(s, { held: 3 }, t);
    assert.ok(s.will < 50, `воля ${s.will}`);
    const w = s.will;
    P.decay(s, 5, t);
    assert.ok(s.will > w);
    P.decay(s, 48, t, { willCap: 70 });
    assert.equal(s.will, 70);
    s.will = 20;
    P.decay(s, 0, t, { nights: 1, sleepQ: 1 });
    assert.equal(s.will, 55);
    s.will = 20;
    P.decay(s, 0, t, { nights: 1, sleepQ: 0.2 });
    assert.equal(s.will, 27);
});

test('держать лицо под сильным чувством стоит воли', () => {
    const t = T();
    const s = P.fresh(t);
    P.hit(s, { wrong: 3 }, t);
    P.hit(s, { wrong: 3 }, t);
    const dom = P.dominant(P.eff(s));
    const before = s.will;
    const c = P.holdCost(s, dom);
    assert.ok(c > 0 && s.will < before);
    assert.equal(P.holdCost(s, { id: 'tender', lvl: 90 }), 0);
});

test('срыв: накопилось и держать нечем; потом похмелье и сырые нервы', () => {
    const t = T();
    const s = P.fresh(t);
    assert.equal(P.breakCheck(s, P.eff(s)), '');
    s.strain = 90; s.will = 10;
    assert.equal(P.breakCheck(s, P.eff(s)), 'strain');
    s.brk = { mes: 5 };
    assert.equal(P.breakCheck(s, P.eff(s)), '', 'второй срыв поверх первого не считается');
    P.resolveBreak(s, { ts: 1000, mes: 6 });
    assert.ok(s.hang && !s.brk);
    assert.ok(s.strain <= 55 && s.will <= 25);
    assert.equal(P.hangOver(s, { ts: 1000 + 5 * 3.6e6, mes: 9 }), false);
    assert.equal(P.hangOver(s, { ts: 1000 + 11 * 3.6e6, mes: 9 }), true);
    // после срыва плохое бьёт больнее
    const a = P.fresh(t), b = P.fresh(t);
    b.hang = { until: null, mes: 0 };
    const da = P.hit(a, { blow: 2 }, t), db = P.hit(b, { blow: 2 }, t);
    assert.ok(db.wor < da.wor);
});

test('острый срыв: один удар в больное при высоком напряжении', () => {
    const t = T({ base: { val: 0, aro: 0, ctl: 10, wor: -20 } });
    const s = P.fresh(t);
    s.strain = 65;
    P.hit(s, { blow: 3 }, t);
    assert.equal(P.breakCheck(s, P.eff(s), { blow: 3 }), 'acute');
    const calm = P.fresh(T());
    P.hit(calm, { blow: 3 }, T());
    assert.equal(P.breakCheck(calm, P.eff(calm), { blow: 3 }), '', 'без накопленного — не срыв');
});

test('характер ползёт медленно и недалеко', () => {
    const t = T();
    const s = P.fresh(t);
    for (let d = 0; d < 60; d++) { P.hit(s, { warm: 2 }, t); P.decay(s, 24, t); }
    assert.ok(s.base.val > t.base.val + 3, `характер сдвинулся: ${s.base.val}`);
    assert.ok(s.base.val <= t.base.val + P.BASE_SPAN);
    const one = P.fresh(t);
    P.hit(one, { warm: 3 }, t);
    P.decay(one, 24, t);
    assert.ok(Math.abs(one.base.val - t.base.val) < 1.5, 'за один день характер почти не меняется');
});

test('разбор ответа Летописца: мусор не проходит', () => {
    assert.deepEqual(P.cleanHits({ who: 'Баки', blow: 2, held: '1', threat: 9, junk: 3, warm: -2, why: 'x' }), { blow: 2, held: 1, threat: 3 });
    assert.deepEqual(P.cleanHits(null), {});
    assert.deepEqual(P.mergeHits({ blow: 1, warm: 2 }, { blow: 3 }), { blow: 3, warm: 2 });
});

test('состояние чинится после загрузки, значения не уходят за края', () => {
    const t = T();
    const s = P.heal({ fast: { val: 'x' }, will: 500, log: null }, t);
    assert.equal(s.will, 100);
    assert.equal(s.fast.val, 0);
    assert.ok(Array.isArray(s.log));
    for (let k = 0; k < 30; k++) P.hit(s, { threat: 3, blow: 3, bound: 3, wrong: 3, loss: 3 }, t);
    const E = P.eff(s);
    for (const a of P.AXES) assert.ok(E[a] >= -100 && E[a] <= 100);
    assert.ok(s.strain <= 100 && s.will >= 0);
});

test('аура: тепло — янтарь, мрак — синий; заряд ускоряет пульс; на пределе — трещины', () => {
    const t = T();
    const warm = P.fresh(t); P.hit(warm, { warm: 3 }, t); P.hit(warm, { warm: 3 }, t);
    const dark = P.fresh(t); P.hit(dark, { loss: 3 }, t); P.hit(dark, { loss: 3 }, t);
    const aw = P.auraOf(P.eff(warm), warm), ad = P.auraOf(P.eff(dark), dark);
    assert.ok(aw.hue < 60 || aw.hue > 330, `тёплый оттенок ${aw.hue}`);
    assert.ok(ad.hue >= 200 && ad.hue <= 260, `холодный оттенок ${ad.hue}`);
    const hot = P.fresh(t); P.hit(hot, { threat: 3 }, t);
    assert.ok(P.auraOf(P.eff(hot), hot).dur < P.auraOf(P.eff(dark), dark).dur);
    hot.strain = 80;
    assert.equal(P.auraOf(P.eff(hot), hot).crack, true);
});

// ───── поручни калибровки: одно событие не сносит человека, даже ранимого ─────

const domOf = (s) => P.dominant(P.eff(s), s.base);
const vulnerable = () => T({ base: { val: 5, aro: 0, ctl: 10, wor: -20 }, react: 1.1, sens: { blow: 1.4 } });

test('поручни: обычный человек — заметное событие даёт первую ступень, сильное — вторую-третью', () => {
    const t = T();
    for (const k of ['threat', 'blow', 'bound', 'wrong', 'loss']) {
        const two = P.fresh(t); P.hit(two, { [k]: 2 }, t);
        assert.equal(domOf(two).step, 1, `${k} 2`);
        const three = P.fresh(t); P.hit(three, { [k]: 3 }, t);
        assert.ok([2, 3].includes(domOf(three).step), `${k} 3 → ступень ${domOf(three).step}`);
    }
});

test('поручни: ранимый — одно событие не доводит до последней ступени, два сильных подряд — доводят', () => {
    const t = vulnerable();
    const two = P.fresh(t); P.hit(two, { blow: 2 }, t);
    assert.ok(domOf(two).step <= 2, `удар 2 → ступень ${domOf(two).step}`);
    const three = P.fresh(t); P.hit(three, { blow: 3 }, t);
    assert.ok(domOf(three).step <= 3, `удар 3 → ступень ${domOf(three).step}`);
    const loaded = P.fresh(t); P.hit(loaded, { blow: 2 }, t, { raw: 1.25 });
    assert.ok(P.dominant(P.eff(loaded, { val: -18, aro: -5, ctl: -10, wor: 0 }), loaded.base).step <= 3, 'под нагрузкой тела — не выше третьей');
    const twice = P.fresh(t); P.hit(twice, { blow: 3 }, t); P.decay(twice, 0.5, t); P.hit(twice, { blow: 3 }, t);
    assert.equal(domOf(twice).step, 4);
});

test('поручни: тяжёлое прошлое само по себе — не «на пределе»', () => {
    const t = T({ base: { val: -10, aro: 5, ctl: 28, wor: -30 }, react: 1.2, sens: { blow: 1.5, bound: 1.5 } });
    const s = P.fresh(t);
    assert.equal(domOf(s).id, '', 'в спокойный день — ровно');
    P.decay(s, 24 * 30, t);
    assert.equal(domOf(s).id, '', 'и через месяц покоя — ровно');
    assert.ok(s.strain < 15 && s.will > 80);
});

test('поручни: множители не складываются в лавину', () => {
    const wild = { base: { val: 0, aro: 0, ctl: 0, wor: 0 }, react: 2, sens: { blow: 2.5 } };
    const t = P.normTemper(wild);
    const s = P.fresh(t);
    s.strain = 100; s.hang = { until: null, mes: 0 };
    const d = P.hit(s, { blow: 1 }, t, { raw: 3 });
    assert.ok(Math.abs(d.wor) <= P.STEP[1] * P.MUL_CAP * P.RAW_CAP + 1, `слабое событие осталось слабым: ${d.wor}`);
});

// ───── 0.2: маска, что возвращает, убеждения, прогноз, инициатива, ночь, история ─────

test('маска: «сдержался» копит, «открылся» снимает, тайны держат её поднятой', () => {
    const t = T();
    const s = P.fresh(t);
    P.hit(s, { held: 3 }, t); P.hit(s, { held: 3 }, t); P.hit(s, { held: 2 }, t);
    assert.equal(s.mask, 68);
    assert.ok(s.will < 40, 'держать лицо стоило воли');
    assert.equal(P.leakOf(s), 1, 'после трёх «сдержался» сил мало — уже трещит');
    s.will = 80;
    assert.equal(P.leakOf(s), 0, 'воли хватает — держит');
    s.will = 30;
    assert.equal(P.leakOf(s), 1, 'сил мало — трещит');
    s.will = 10;
    assert.equal(P.leakOf(s), 2);
    s.will = 80; s.mask = 45;
    assert.equal(P.leakOf(s), 0);
    assert.equal(P.leakOf({ ...s, mask: 58, will: 30 }, true) >= 1, true, 'под алкоголем ближе к поверхности');
    P.hit(s, { open: 3 }, t);
    assert.equal(s.mask, 0);
    P.decay(s, 400, t, { maskIn: 0.75 });
    assert.ok(s.mask > 34 && s.mask < 44, `три тайны держат маску около сорока: ${s.mask}`);
    P.decay(s, 400, t, {});
    assert.ok(s.mask < 1);
});

test('что возвращает: плохая вспышка гаснет, напряжение спадает; хорошее не трогает', () => {
    const t = T();
    const s = P.fresh(t);
    P.hit(s, { threat: 3 }, t);
    const before = P.dominant(P.eff(s), s.base);
    const strain = s.strain;
    P.soothe(s);
    const after = P.dominant(P.eff(s), s.base);
    assert.ok(after.lvl < before.lvl);
    assert.ok(s.strain < strain);
    const w = P.fresh(t); P.hit(w, { warm: 2 }, t);
    const val = P.eff(w).val;
    P.soothe(w);
    assert.equal(P.eff(w).val, val);
});

test('убеждения: точатся неделями, подтверждаются быстрее, сломанное не возвращается', () => {
    const t = T({ beliefs: [{ t: 'я испорченный', truth: 'я был оружием, а не убийцей' }] });
    assert.equal(t.beliefs.length, 1);
    const id = t.beliefs[0].id;
    assert.equal(id, P.beliefId('Я  испорченный'), 'ключ — по тексту');
    const s = P.fresh(t);
    assert.equal(P.beliefHp(s, id), 100);
    assert.equal(P.beliefBand(P.beliefHp(s, id)), 3);
    P.beliefHit(s, id, -1);
    assert.equal(P.beliefHp(s, id), 96);
    P.beliefHit(s, id, 2);
    assert.equal(P.beliefHp(s, id), 100);
    let n = 0, got = '';
    while (!got && n < 100) { got = P.beliefHit(s, id, -2); n++; }
    assert.equal(got, 'broken');
    assert.ok(n >= 12, `сильных поступков понадобилось ${n}`);
    assert.equal(P.beliefHit(s, id, 2), '', 'сломанное не чинится');
    assert.equal(P.beliefHp(s, id), 0);
});

test('прогноз: под тяжёлой нагрузкой — срыв, без нагрузки — когда отпустит', () => {
    const t = T();
    const s = P.fresh(t);
    assert.deepEqual(P.forecast(s, t), { breakIn: null, rawIn: null, calmIn: null });
    P.hit(s, { wrong: 3 }, t);
    const f = P.forecast(s, t);
    assert.equal(f.breakIn, null);
    assert.ok(f.calmIn >= 1 && f.calmIn <= 24, `отпустит через ${f.calmIn} ч`);
    const before = JSON.stringify(s);
    const heavy = P.forecast(s, t, { strainIn: 5, willMul: 0.35, willCap: 15 });
    assert.ok(heavy.breakIn >= 1 && heavy.breakIn <= 72, `срыв через ${heavy.breakIn} ч`);
    assert.ok(heavy.rawIn >= 1 && heavy.rawIn <= heavy.breakIn, 'сначала сырые нервы, потом срыв');
    const load = P.forecast(P.fresh(t), t, { strainIn: 5 });
    assert.equal(load.breakIn, null, 'воля возвращается — сам по себе не сорвётся');
    assert.ok(load.rawIn >= 5 && load.rawIn <= 30, `сырые нервы через ${load.rawIn} ч`);
    assert.equal(JSON.stringify(s), before, 'прогноз состояние не трогает');
});

test('инициатива стоит воли: прожитое удешевляет, страх и стыд держат, без сил — не решится', () => {
    const t = T();
    const s = P.fresh(t);
    const calm = { id: '', step: 0 };
    assert.equal(P.afford(s, calm, 'flirt').cost, 10);
    assert.equal(P.afford(s, calm, 'flirt', { steps: 10 }).cost, 6);
    assert.equal(P.afford(s, calm, 'flirt', { steps: 40 }).cost, 4.5, 'дешевле половины не бывает');
    assert.equal(P.afford(s, calm, 'care', { steps: 40 }).cost, 3, 'забота и так дешёвая');
    assert.equal(P.afford(s, { id: 'tender', step: 2 }, 'court').cost, 4.8);
    assert.equal(P.afford(s, { id: 'tender', step: 2 }, 'court').bold, true);
    assert.equal(P.afford(s, { id: 'fear', step: 3 }, 'touch').ok, false);
    assert.equal(P.afford(s, { id: 'fear', step: 3 }, 'care').ok, true, 'на заботу страх не влияет');
    assert.equal(P.afford(s, { id: 'shame', step: 3 }, 'court').ok, false);
    s.will = 15;
    assert.equal(P.afford(s, calm, 'flirt').ok, false);
    assert.equal(P.afford(s, calm, 'care').ok, true);
    s.will = 50;
    assert.equal(P.spend(s, 10), 10);
    assert.equal(s.will, 40);
});

test('сырые нервы и раздражительность', () => {
    const t = T();
    const s = P.fresh(t);
    assert.equal(P.rawNerves(s), false);
    assert.equal(P.edgeOf(s, { id: '' }), 1);
    assert.equal(P.edgeOf(s, { id: 'tender', step: 1 }), 0.85);
    s.strain = 70;
    assert.equal(P.rawNerves(s), true);
    assert.ok(P.edgeOf(s, { id: 'anger', step: 2 }) > 1.3);
    s.strain = 100; s.will = 5;
    assert.equal(P.edgeOf(s, { id: 'anger', step: 4 }), 1.5, 'потолок');
});

test('плохая ночь: в покое не бывает, на нервах — вероятна; свайп даёт ту же ночь', () => {
    const t = T();
    const s = P.fresh(t);
    assert.equal(P.nightChance(s), 0);
    assert.equal(P.nightRoll(s, 'x'), false);
    s.strain = 80;
    assert.equal(P.nightChance(s), 0.5);
    assert.equal(P.nightChance(s, { trig: true }), 0.85);
    assert.equal(P.nightRoll(s, 'пост 12'), P.nightRoll(s, 'пост 12'));
    s.strain = 100; s.hang = { until: null, mes: 0 };
    assert.equal(P.nightChance(s, { trig: true }), 0.9);
});

test('кардиограмма: один замер на день, не больше шестидесяти дней', () => {
    const t = T();
    const s = P.fresh(t);
    P.sample(s, P.eff(s), '2024-12-01');
    P.hit(s, { loss: 3 }, t);
    P.sample(s, P.eff(s), '2024-12-01');
    assert.equal(s.hist.length, 1);
    assert.ok(s.hist[0].val < 0);
    for (let d = 0; d < 80; d++) P.sample(s, P.eff(s), `день ${d}`);
    assert.equal(s.hist.length, 60);
});

test('темперамент: что возвращает, убеждения и даты чистятся', () => {
    const t = P.normTemper({ fix: ['её голос', '', 5, 'счёт вслух'], beliefs: [{ t: '' }, { t: 'я испорченный' }], dates: [{ md: '12-16', t: 'гибель Старков', kind: 'blow' }, { md: '13-40', t: 'мусор' }, { md: '3-7', t: 'день рождения сестры' }] });
    assert.deepEqual(t.fix, ['её голос', '5', 'счёт вслух']);
    assert.equal(t.beliefs.length, 1);
    assert.deepEqual(t.dates.map(d => d.md), ['12-16', '03-07']);
    assert.equal(t.dates[1].kind, 'loss');
});
