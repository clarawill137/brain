// Лекарства и вещества (core/chem.js): стадии, уход со временем, откат, что они делают с событиями.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, STAGE, AFTER, ON_TEXT, AFTER_TEXT, SEEN, SEEN_AFTER, stageOf, chemTol, take, wear, chemStages, chemNow, chemLines, seenLines, chemTips } from '../core/chem.js';

const fresh = () => ({});

test('доза — стадия: обычная, сильная, слишком много; кого почти не берёт — того и это почти не берёт', () => {
    for (const k of KINDS) {
        for (const n of [1, 2, 3]) { const s = fresh(); take(s, k, n); assert.equal(stageOf(s.chem[k].lvl), n, `${k} × ${n}`); }
        const s = fresh();
        take(s, k, 2, 4);
        assert.equal(stageOf(s.chem[k].lvl), 0, `${k}: сверхчеловеческий обмен`);
    }
    assert.equal(chemTol({ booze: 1.6 }), 1, 'привычка к спиртному от лекарств не спасает');
    assert.equal(chemTol({ booze: 3 }), 3, 'сверхчеловеческий обмен выжигает всё');
    assert.equal(chemTol({}), 1);
    assert.equal(take(fresh(), 'нет такого', 2), 0);
});

test('время снимает; был настоящий пик — приходит откат, и он тоже проходит', () => {
    for (const k of KINDS) {
        const s = fresh();
        take(s, k, 2);
        assert.deepEqual(wear(s, 0.5), [], `${k}: через полчаса ещё действует`);
        assert.ok(chemStages(s).on[k] >= 1);
        const began = wear(s, 6);
        assert.deepEqual(began, [k], `${k}: отпустило — начался откат`);
        const st = chemStages(s);
        assert.equal(st.on[k], 0);
        assert.equal(st.after[k], 1);
        wear(s, 30);
        assert.equal(chemStages(s).any, false, `${k}: к следующему дню чисто`);
        assert.deepEqual(s.chem, {});
    }
    // одна обычная доза — без отката
    const a = fresh(); take(a, 'sed', 1); wear(a, 8);
    assert.equal(chemStages(a).any, false);
    // слишком много — откат тяжёлый
    const b = fresh(); take(b, 'stim', 3); wear(b, 9);
    assert.equal(chemStages(b).after.stim, 2);
    // кого почти не берёт — у того отката нет
    const c = fresh(); take(c, 'pain', 3, 0.5); wear(c, 12, 3);
    assert.equal(chemStages(c).after.pain, 0);
    // принял снова — откат отложен
    const d = fresh(); take(d, 'pain', 2); wear(d, 6); assert.equal(chemStages(d).after.pain, 1);
    take(d, 'pain', 1);
    assert.equal(chemStages(d).after.pain, 0);
    // долгий пропуск времени съедает и вещество, и откат
    const e = fresh(); take(e, 'sed', 3); assert.equal(e.fog, true); wear(e, 24 * 3);
    assert.equal(chemStages(e).any, false);
    assert.equal(e.fog, false);
});

test('седативное: испуг глуше, чужую злость не считывает; со спиртным — на стадию глубже; после — тревога возвращается', () => {
    const s = fresh(); take(s, 'sed', 1);
    const z = chemNow(s);
    assert.ok(z.kmul.threat < 1);
    assert.equal(z.miss, false, 'малая доза лица читать не мешает');
    const strong = fresh(); take(strong, 'sed', 2);
    assert.equal(chemNow(strong).miss, true, 'сильная — мешает');
    assert.ok(z.off.aro < 0);
    assert.equal(z.fog, false);
    const drunk = chemNow(s, { drunk: 2 });
    assert.equal(drunk.sedDeep, 2);
    assert.equal(drunk.fog, true, 'вместе со спиртным этот час уже не запомнится');
    assert.match(drunk.list[0].text, /со спиртным складывается/);
    wear(s, 0); take(s, 'sed', 2); wear(s, 9);
    const after = chemNow(s, { prone: 1 });
    assert.equal(after.afterAny, true);
    assert.ok(after.kmul.threat > 1);
    assert.ok(after.off.ctl < chemNow(s, { prone: 0 }).off.ctl, 'тревожным возврат тревоги достаётся сильнее');
    assert.ok(after.sleepQ < 1);
});

test('обезболивающее: своя рана тише, обидное и разлука — как через вату; отпустило — режет острее', () => {
    const s = fresh(); take(s, 'pain', 2);
    const z = chemNow(s);
    assert.ok(z.dull < 0.5);
    assert.ok(z.kmul.loss < 1 && z.kmul.blow < 1 && z.kmul.loss < z.kmul.wrong, 'разлука глушится сильнее всего');
    assert.equal(z.numb, true);
    assert.ok(z.off.val > 0 && z.off.aro < 0);
    wear(s, 6);
    const after = chemNow(s);
    assert.ok(after.dull > 1, 'боль возвращается громче');
    assert.ok(after.kmul.loss > 1 && after.kmul.blow > 1);
    assert.ok(after.raw > 1);
});

test('стимулятор: всё доходит живее, усталость отложена, тянет на риск; перебор — подозрительность; потом обвал', () => {
    const s = fresh(); take(s, 'stim', 1);
    const one = chemNow(s);
    assert.ok(one.amp > 1);
    assert.equal(one.wake, true);
    assert.equal(one.keen, true);
    assert.equal(one.bold, false);
    assert.equal(one.kmul.threat, undefined);
    take(s, 'stim', 1);
    assert.equal(chemNow(s).bold, true);
    take(s, 'stim', 1);
    const three = chemNow(s);
    assert.equal(three.on.stim, 3);
    assert.ok(three.kmul.threat > 1, 'в словах слышит подвох');
    assert.ok(three.sleepQ < 0.5);
    wear(s, 10);
    const crash = chemNow(s);
    assert.equal(crash.after.stim, 2);
    assert.ok(crash.willCap <= 55);
    assert.ok(crash.off.aro < 0 && crash.off.val < 0);
    assert.equal(crash.wake, false);
});

test('ничего не принято — ничего не меняется', () => {
    const z = chemNow(fresh());
    assert.equal(z.any, false);
    assert.deepEqual(z.off, { val: 0, aro: 0, ctl: 0, wor: 0 });
    assert.deepEqual(z.kmul, {});
    assert.deepEqual(chemLines(z), []);
    assert.deepEqual(seenLines(chemStages(fresh())), []);
    assert.deepEqual(chemTips(fresh()), []);
    // о веществе знает только Life — хотя бы первая стадия
    assert.equal(chemNow(fresh(), { floor: { stim: 20 } }).on.stim, 1);
});

test('слова: как играть, что видно со стороны, подсказка игроку — на каждую стадию и без рода', () => {
    const all = [];
    for (const k of KINDS) {
        for (const n of [1, 2, 3]) { assert.ok(ON_TEXT[k][n].length > 40 && SEEN[k][n].length > 15 && STAGE[k][n], `${k}.${n}`); all.push(ON_TEXT[k][n], SEEN[k][n], STAGE[k][n]); }
        for (const n of [1, 2]) { assert.ok(AFTER_TEXT[k][n].length > 40 && SEEN_AFTER[k][n].length > 15 && AFTER[k][n], `${k} после ${n}`); all.push(AFTER_TEXT[k][n], SEEN_AFTER[k][n], AFTER[k][n]); }
    }
    const s = fresh(); take(s, 'sed', 2); take(s, 'stim', 1);
    const z = chemNow(s);
    const lines = chemLines(z);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /под сильным седативным/);
    assert.match(lines[1], /на стимуляторе/);
    const seen = seenLines(chemStages(s));
    assert.match(seen[0], /^под сильным седативным — заторможенность/);
    const tips = chemTips(s);
    assert.ok(tips.some(x => /отпустит примерно за \d+ ч истории/.test(x)));
    assert.ok(tips.some(x => /потом откат/.test(x)));
    assert.ok(tips.some(x => /помнится кусками/.test(x)));
    wear(s, 8);
    assert.ok(chemTips(s).some(x => /ещё ~\d+ ч истории/.test(x)));
    assert.match(chemLines(chemNow(s)).join(' | '), /седативное отпустило/);
    all.push(...lines, ...seen, ...tips, ...chemTips(s));
    for (const t of all) assert.ok(!/(^|[^а-яё])(он|она|ему|ей|его|её|сам|сама|принял|приняла|устал|устала|должен|готов|один|одна)([^а-яё]|$)/i.test(t), `без рода — «${t}»`);
});
