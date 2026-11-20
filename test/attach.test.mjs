// Способы привязываться, тропы пар, стержень, алкоголь: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../core/psyche.js';
import { STYLES, STYLE_IDS, styleId, styleLine, STYLE_EASE, STYLE_OBJECT, statusHabit, statusFlip, TROPES, TROPE_IDS, tropeLine, tropeMul, rejectOf, normSpine, hasSpine, spineLine } from '../core/attach.js';
import { tie, pairStats, lens, afterHurt } from '../core/bonds.js';
import { combos } from '../core/drives.js';
import { hints } from '../core/hints.js';
import { STAGE_AT, stageOf, tolOf, drink, sober, boozeNow, DRUNK, HUNG, SEEN, SEEN_HUNG, playerTips } from '../core/booze.js';

const POS = ['near', 'quiet', 'threat', 'apart', 'hurt', 'rival'];
const LOVED = tie({ love: 100, closeness: 100, trust: 80 });
const COSMIC = tie({}, { cosmic: true });

test('способы: у каждого — свои слова во всех пяти положениях, без рода', () => {
    for (const id of STYLE_IDS) {
        assert.ok(STYLES[id].name && STYLES[id].how);
        if (id === 'secure') { for (const p of POS) assert.equal(styleLine(id, p), ''); continue; }
        for (const p of POS) {
            const t = styleLine(id, p);
            assert.ok(t.length > 30, `${id}.${p}`);
            assert.ok(!/(^|[^а-яё])(он|она|ему|ей|заслужил|привязан|должен|готов|сам)([^а-яё]|$)/i.test(t), `${id}.${p}: без рода — «${t}»`);
        }
    }
    const all = STYLE_IDS.filter(x => x !== 'secure').map(id => styleLine(id, 'hurt'));
    assert.equal(new Set(all).size, all.length, 'после удара каждый ведёт себя по-своему');
});

test('способы: читаются по id и по названию', () => {
    assert.equal(styleId('guard'), 'guard');
    assert.equal(styleId('Намертво'), 'fuse');
    assert.equal(styleId('сторож'), 'guard');
    assert.equal(styleId('в броне'), 'armor');
    assert.equal(styleId('что-то'), '');
    assert.equal(styleId(''), '');
});

test('способ красит умные статы пары: намертво — страшнее потерять и ревнивее, в броне — хуже успокаивается', () => {
    const v = { E: { wor: -30 }, dr: { bond: 50 }, bel: 0.5 };
    const plain = pairStats(LOVED, v);
    const fuse = pairStats(LOVED, { ...v, style: 'fuse' });
    const armor = pairStats(LOVED, { ...v, style: 'armor' });
    const serve = pairStats(LOVED, { ...v, style: 'serve' });
    assert.ok(fuse.dread > plain.dread && fuse.fuse > plain.fuse);
    assert.ok(armor.haven < plain.haven && armor.fuse < plain.fuse);
    assert.ok(serve.blur >= plain.blur && serve.fuse < plain.fuse);
    for (const st of [fuse, armor, serve]) for (const k of ['blur', 'haven', 'fuse', 'dread']) assert.ok(st[k] >= 0 && st[k] <= 100);
    assert.deepEqual(pairStats(LOVED, { ...v, style: '', reject: 1 }), plain, 'без способа и раны — как раньше');
});

test('рана отвержения: не уверен в своём месте и в хороший день; некрупный уход читает громче, сильный — не выше', () => {
    const calm = { E: { wor: 10 }, dr: { bond: 70 }, bel: 0 };
    assert.equal(pairStats(LOVED, calm).insecure, 0);
    const hurt = pairStats(LOVED, { ...calm, reject: 1.6 });
    assert.ok(hurt.insecure >= 0.1 && hurt.dread > pairStats(LOVED, calm).dread);
    assert.equal(rejectOf({ reject: 9 }), 2);
    assert.equal(rejectOf({}), 1);
    const st = pairStats(LOVED, calm);
    const a = lens({ loss: 2 }, LOVED, st, { reject: 1 }).kmul.loss;
    const b = lens({ loss: 2 }, LOVED, st, { reject: 2 }).kmul.loss;
    assert.equal(a, 1.2);
    assert.ok(b > a && b <= 1.3);
    assert.equal(lens({ loss: 3 }, LOVED, st, { reject: 2 }).kmul.loss, undefined, 'поручень: сильное линза не усиливает');
});

test('после удара от своего: способ решает, тянуться или закрыться; космическая — остаётся', () => {
    const sure = pairStats(LOVED, { E: { wor: 20 }, dr: { bond: 80 } });
    assert.equal(afterHurt(LOVED, sure), 'mend');
    assert.equal(afterHurt(LOVED, sure, 'armor'), 'guard');
    assert.equal(afterHurt(LOVED, sure, 'test'), 'guard');
    assert.equal(afterHurt(LOVED, { insecure: 0.9 }, 'fuse'), 'mend', 'залипает — цепляется, даже когда не уверен');
    assert.equal(afterHurt(COSMIC, sure, 'armor'), 'stay');
});

test('комбинации говорят его словами: ревность, удар от своего, тревога за своего', () => {
    const s = () => ({ ...P.fresh(), dr: { bond: 60, safe: 60, free: 60, need: 60, quiet: 60, novel: 60 } });
    const dom = { id: '', step: 0 };
    const plain = combos({ s: s(), dom, hurt: 'stay', stay: 'quiet', cosmic: true });
    const guard = combos({ s: s(), dom, hurt: 'stay', stay: 'quiet', cosmic: true, style: 'guard' });
    assert.match(plain.find(c => c.id === 'stay').t, /ни слова упрёка/);
    assert.match(guard.find(c => c.id === 'stay').t, /остаётся на посту/);
    assert.match(combos({ s: s(), dom, hurt: 'stay', stay: 'fierce', cosmic: true, style: 'guard' }).find(c => c.id === 'stay').t, /говорит в лицо/, 'злость говорит в лицо у любого');
    assert.match(combos({ s: s(), dom, jeal: 'open', style: 'test' }).find(c => c.id === 'jealous').t, /с издёвкой/);
    assert.match(combos({ s: s(), dom, worry: true, cosmic: true, style: 'fix' }).find(c => c.id === 'reckless').t, /превращает в задачу[\s\S]*цена сейчас не в счёт/);
    assert.match(combos({ s: s(), dom, worry: true, dear: true, style: 'serve' }).find(c => c.id === 'threat').t, /рефлекс/);
    assert.ok(!combos({ s: s(), dom, worry: true, dear: true }).some(c => c.id === 'threat'), 'без способа — как раньше');
});

test('тропы: строка пары, тёмная сторона — только под давлением, романтика — три вида', () => {
    for (const id of TROPE_IDS) assert.ok(TROPES[id].name && TROPES[id].dyn.length > 30 && TROPES[id].dark.length > 20 && TROPES[id].soft.length > 15, id);
    const calm = tropeLine({ id: 'hybrid', rom: 'yes' }, 'Хеди');
    assert.match(calm, /^с Хеди — равные/);
    assert.match(calm, /это любовь, и оба это знают/);
    assert.ok(!/под давлением|сейчас —|поднач/.test(calm), 'в обычную минуту — только ядро: шутить или молчать, модели не диктуем');
    assert.match(tropeLine({ id: 'hybrid', rom: 'hint' }, 'Наташа', true), /нет названия[\s\S]*вслух этого нет[\s\S]*под давлением вылезает другое[\s\S]*не умеет другого отпустить[\s\S]*тесно всем остальным/);
    assert.match(tropeLine({ id: 'sisters', rom: 'no' }, 'Елена', true), /подначки пропадают первыми — не от покоя, а от напряжения/);
    assert.ok(!/это любовь|вслух этого/.test(tropeLine({ id: 'kin', rom: 'no' }, 'Тони')));
    assert.equal(tropeLine({ id: 'нет такого' }, 'Хеди'), '');
    assert.equal(tropeLine(null, 'Хеди'), '');
});

test('тропы: подначки — в игривую минуту, в тихую — тишина; любовь бывает и без единой подколки', () => {
    const play = tropeLine({ id: 'hybrid', rom: 'yes' }, 'Хеди', false, 'play');
    assert.match(play, /сейчас — подначивают друг друга на риск[\s\S]*это любовь, и оба это знают/);
    const soft = tropeLine({ id: 'hybrid', rom: 'yes' }, 'Хеди', false, 'soft');
    assert.match(soft, /сейчас — им хватает тишины вдвоём[\s\S]*это любовь, и сейчас она тихая: нежность без единой подначки/);
    assert.ok(!/на риск|оба это знают/.test(soft));
    const hint = tropeLine({ id: 'hybrid', rom: 'hint' }, 'Наташа', false, 'soft');
    assert.match(hint, /рука, задержавшаяся дольше нужного/);
    assert.ok(!/сразу шутка/.test(hint), 'в тихую минуту несказанное не прячут за шуткой');
    assert.match(tropeLine({ id: 'sisters', rom: 'no' }, 'Елена', false, 'soft'), /молчание не неловкое/);
    assert.match(tropeLine({ id: 'sisters', rom: 'no' }, 'Елена', false, 'play'), /шутят по-чёрному/);
    // под давлением минута не важна: показывается тёмная сторона
    const dark = tropeLine({ id: 'hybrid', rom: 'yes' }, 'Хеди', true, 'soft');
    assert.ok(!/сейчас —|она тихая/.test(dark));
    assert.match(dark, /под давлением вылезает другое/);
    // у перемирия игривой минуты нет вовсе
    assert.ok(!/сейчас —/.test(tropeLine({ id: 'truce', rom: 'no' }, 'Тони', false, 'play')));
});

test('способы: в тихую минуту у каждого своя тишина; «редкий покой» говорит его словами', () => {
    assert.match(styleLine('guard', 'quiet'), /пост сдаёт/);
    assert.match(styleLine('test', 'quiet'), /не колет вовсе/);
    assert.match(styleLine('armor', 'quiet'), /броня снимается молча: ни шуток, ни дела/);
    const s = { ...P.fresh(), strain: 5, dr: { bond: 90, safe: 95, free: 60, need: 60, quiet: 60, novel: 60 } };
    const dom = { id: '', step: 0 };
    assert.match(combos({ s, dom }).find(c => c.id === 'rest').t, /редкий покой/);
    assert.match(combos({ s, dom, style: 'test' }).find(c => c.id === 'rest').t, /не колет вовсе/);
});

test('троп меняет, что у этих двоих задевает: только некрупное', () => {
    assert.deepEqual(tropeMul('kin', { bound: 2, fun: 1 }), { bound: 1.2 });
    assert.deepEqual(tropeMul('kin', { bound: 3 }), {}, 'поручень: сильное троп не трогает');
    assert.deepEqual(tropeMul('sisters', { blow: 1, open: 2 }), { blow: 0.85, open: 1.25 });
    assert.deepEqual(tropeMul('', { warm: 2 }), {});
});

test('стержень: в тихой сцене — чем живёт; под давлением — хочу против нужно; шатается убеждение — начинает видеть', () => {
    const sp = normSpine({ goal: 'искупить всё, что сделал Солдат', need: 'поверить, что его можно любить и таким', view: 'за всё платят', fear: 'снова стать оружием', face: 'тем, на кого можно положиться', junk: 1 });
    assert.equal(sp.junk, undefined);
    assert.ok(hasSpine(sp) && !hasSpine(normSpine({})) && !hasSpine(null));
    assert.match(spineLine(sp, 'calm'), /^чем живёт: искупить/);
    assert.ok(!/нужно другое/.test(spineLine(sp, 'calm')));
    const press = spineLine(sp, 'press');
    assert.match(press, /читает через своё: за всё платят[\s\S]*боится: снова стать оружием[\s\S]*хочет выглядеть тем/);
    assert.ok(!/добивается|нужно другое/.test(press), 'хочу и нужно — только на развилке');
    assert.match(spineLine(sp, 'choice'), /^решает из своего «хочу»: искупить[\s\S]*нужно другое: поверить[\s\S]*пока не видит[\s\S]*боится: снова стать оружием/);
    assert.ok(!/хочет выглядеть|читает через/.test(spineLine(sp, 'choice')));
    assert.match(spineLine(sp, 'choice', true), /уже начинает это видеть/);
    assert.match(spineLine(sp, 'choice', 1), /уже начинает это видеть/);
    assert.match(spineLine(sp, 'choice', 2), /впервые может выбрать второе, даже ценой первого/);
    assert.equal(spineLine(normSpine({}), 'press'), '');
});

test('темперамент хранит способ, рану, алкоголь и стержень', () => {
    const t = P.normTemper({ attach: 'guard', reject: 5, booze: 40, spine: { goal: '  искупить   вину ', x: 1 }, v: 8 });
    assert.equal(t.attach, 'guard');
    assert.equal(t.reject, 2);
    assert.equal(t.booze, 6);
    assert.deepEqual(t.spine, { goal: 'искупить вину', need: '', view: '', fear: '', face: '' });
    assert.equal(t.v, 8);
    const d = P.normTemper();
    assert.equal(d.attach, '');
    assert.equal(d.reject, 1);
    assert.equal(d.booze, 1);
});

// ───────────── алкоголь ─────────────

test('алкоголь: бокал — навеселе, много — пьян, дальше — по стадиям', () => {
    assert.deepEqual(STAGE_AT.map(x => stageOf(x)), [1, 2, 3, 4]);
    const s = {};
    drink(s, 1);
    assert.equal(stageOf(s.bac), 1);
    drink(s, 2);
    assert.equal(stageOf(s.bac), 2);
    drink(s, 3);
    assert.equal(stageOf(s.bac), 4);
    assert.equal(s.blank, true, 'с третьей стадии вечер запомнится кусками');
    assert.ok(s.bac <= 100);
    assert.equal(drink({}, 0), 0);
    const sip = {};
    drink(sip, 1); drink(sip, 1, 1, 0.4); drink(sip, 1, 1, 0.4);
    assert.equal(stageOf(sip.bac), 1, 'тот же бокал из поста в пост — всё ещё навеселе');
});

test('алкоголь: суперсолдата почти не берёт, и похмелья у него нет', () => {
    const s = {};
    drink(s, 3, 4);
    assert.equal(stageOf(s.bac), 0);
    drink(s, 3, 4); drink(s, 3, 4); drink(s, 3, 4); drink(s, 3, 4);
    assert.ok(stageOf(s.bac) >= 1);
    sober(s, 12, 4);
    assert.equal(s.bac, 0);
    assert.equal(s.hung, undefined);
    assert.equal(tolOf({ booze: 50 }), 6);
    assert.equal(tolOf({}), 1);
});

test('алкоголь: трезвеет со временем; после настоящей пьянки — похмелье, после бокала — нет', () => {
    const one = {};
    drink(one, 1);
    sober(one, 3);
    assert.equal(one.bac, 0);
    assert.ok(!one.hung);
    const s = {};
    drink(s, 3); drink(s, 2);
    assert.equal(stageOf(s.bac), 3);
    sober(s, 2);
    assert.ok(s.bac > 0 && !s.hung, 'ещё пьян');
    sober(s, 6);
    assert.equal(s.hung.lvl, 2, 'тяжёлое: был сильно пьян');
    assert.ok(s.hung.left > 12);
    sober(s, 10);
    assert.ok(s.hung && s.bac === 0, 'алкоголя нет, похмелье есть');
    sober(s, 14);
    assert.equal(s.hung, null);
    assert.equal(s.blank, false);
});

test('алкоголь: длинный пропуск времени съедает похмелье («проспался»)', () => {
    const s = {};
    drink(s, 3);
    assert.equal(stageOf(s.bac), 2);
    sober(s, 9);
    assert.equal(s.hung.lvl, 1);
    assert.ok(s.hung.left < 9, `утром осталось ${s.hung.left} ч`);
    const z = {};
    drink(z, 3);
    sober(z, 48);
    assert.ok(!z.hung, 'через двое суток — ни следа');
});

test('близорукость: в компании теплее и страх глуше; одному с тяжёлым — темнее и страшнее', () => {
    const fun = boozeNow({ bac: 45 }, { company: true });
    const dark = boozeNow({ bac: 45 }, { heavy: true });
    assert.equal(fun.stage, 2);
    assert.ok(fun.off.val > 0 && dark.off.val < 0);
    assert.ok(fun.threat < 1 && dark.threat > 1);
    assert.ok(fun.amp > 1 && fun.amp <= 1.6);
    assert.ok(fun.loose && fun.bold && !fun.blank);
    assert.ok(boozeNow({ bac: 60 }, {}).blank);
    assert.ok(boozeNow({ bac: 85 }, {}).off.aro < 0, 'в дрова — клонит, а не заводит');
    const none = boozeNow({ bac: 0 }, {});
    assert.equal(none.stage, 0);
    assert.equal(none.amp, 1);
    assert.deepEqual(none.off, { val: 0, aro: 0, ctl: 0, wor: 0 });
});

test('похмелье: нервы тоньше, сил меньше; тревожному достаётся ещё тревога и вина', () => {
    const easy = boozeNow({ bac: 0, hung: { lvl: 1, left: 8 } }, { prone: 0 });
    const hard = boozeNow({ bac: 0, hung: { lvl: 2, left: 8 } }, { prone: 1 });
    assert.equal(easy.hung, 1);
    assert.ok(easy.raw > 1 && easy.willCap < 100 && easy.strainIn > 0);
    assert.ok(easy.off.val < 0 && easy.off.aro < 0);
    assert.equal(easy.off.wor, 0);
    assert.ok(hard.off.wor < 0 && hard.off.ctl < easy.off.ctl);
    assert.ok(hard.raw > easy.raw && hard.willCap < easy.willCap);
    // само по себе похмелье чувства не создаёт — только делает всё плохое ближе
    const E = Object.fromEntries(P.AXES.map(a => [a, hard.off[a]]));
    assert.equal(P.dominant(E).id, '');
    for (const k of [1, 2, 3, 4]) assert.ok(DRUNK[k].length > 40);
    for (const k of [1, 2]) assert.ok(HUNG[k].length > 40);
});

test('опьянение само по себе страхом не становится', () => {
    for (const bac of [20, 45, 60, 90]) {
        const b = boozeNow({ bac }, {});
        assert.equal(P.dominant(Object.fromEntries(P.AXES.map(a => [a, b.off[a]]))).id, '', `стадия ${b.stage}`);
    }
});

test('подсказки: пьян, с похмелья, стержень', () => {
    const base = { s: { ...P.fresh(), dr: { bond: 60, safe: 60, free: 60, need: 60, quiet: 60, novel: 60 } }, t: P.normTemper(), dom: { id: '', step: 0 }, fore: {} };
    assert.match(hints({ ...base, booze: { stage: 2 } }).help.join('|'), /скажет больше обычного/);
    assert.match(hints({ ...base, dom: { id: 'low', step: 2 }, booze: { stage: 2 } }).help.join('|'), /раздувает именно это/);
    assert.match(hints({ ...base, booze: { stage: 3 } }).help.join('|'), /завтра не вспомнит/);
    const h = hints({ ...base, booze: { stage: 0, hung: 1, blank: true } });
    assert.match(h.help.join('|'), /с похмелья: тише/);
    assert.match(h.expect.join('|'), /помнит кусками/);
    const sp = hints({ ...base, spine: { need: 'поверить, что его можно любить', fear: 'снова стать оружием' } });
    assert.match(sp.help.join('|'), /на деле нужно: поверить/);
    assert.match(sp.hurt.join('|'), /главный страх: снова стать оружием/);
});

test('персонаж игрока: что видно со стороны и подсказки — когда выветрится и чего ждать наутро', () => {
    for (const k of [1, 2, 3, 4]) assert.ok(SEEN[k].length > 20);
    for (const k of [1, 2]) assert.ok(SEEN_HUNG[k].length > 20);
    const s = {};
    drink(s, 3);
    const tips = playerTips(s, 1).join('|');
    assert.match(tips, /под градусом: что на первом плане/);
    assert.match(tips, /выветрится примерно за 6 ч истории/);
    assert.match(tips, /наутро — похмелье, на полдня/);
    drink(s, 3);
    const hard = playerTips(s, 1).join('|');
    assert.match(hard, /наутро — тяжёлое похмелье/);
    assert.match(hard, /помниться кусками/);
    assert.match(playerTips({ bac: 20 }, 1).join('|'), /похмелья с такого не будет/);
    assert.match(playerTips({ bac: 50, bacPeak: 50 }, 4).join('|'), /похмелья не будет/);
    assert.match(playerTips({ bac: 0, hung: { lvl: 1, left: 7.4 } }, 1).join('|'), /похмелье ещё ~7 ч истории/);
    assert.deepEqual(playerTips({ bac: 0 }, 1), []);
});

// ───────────── 0.9 ─────────────

test('что с кем работает: у каждого способа — своя подсказка; несогласие выходит по-разному', () => {
    for (const id of STYLE_IDS.filter(x => x !== 'secure')) {
        assert.ok(STYLE_EASE[id].length > 30, id);
        assert.ok(['mute', 'cold', 'fight', 'control'].includes(STYLE_OBJECT[id]), id);
    }
    assert.equal(STYLE_EASE.secure, undefined);
    const s = () => ({ ...P.fresh(), dr: { bond: 60, safe: 60, free: 60, need: 60, quiet: 60, novel: 60 } });
    const dom = { id: '', step: 0 };
    assert.match(combos({ s: s(), dom, mute: 'mute' }).find(c => c.id === 'mute').t, /возражение застревает в горле/);
    assert.match(combos({ s: s(), dom, mute: 'cold' }).find(c => c.id === 'mute').t, /холодную вежливость/);
    assert.match(combos({ s: s(), dom, mute: 'fight' }).find(c => c.id === 'mute').t, /колкостью не по делу/);
    assert.match(combos({ s: s(), dom, mute: 'control' }).find(c => c.id === 'mute').t, /обходной план/);
    assert.ok(!combos({ s: s(), dom }).some(c => c.id === 'mute'));
    assert.match(combos({ s: s(), dom, dare: true }).find(c => c.id === 'dare').t, /поднимает ставку/);
    assert.ok(!combos({ s: s(), dom: { id: 'fear', step: 2 }, dare: true }).some(c => c.id === 'dare'), 'когда страшно — не до азарта');
    const base = { s: s(), t: P.normTemper(), dom: { id: 'anger', step: 2 }, fore: {} };
    const h = hints({ ...base, ease: STYLE_EASE.guard, mute: 'mute' }).help.join('|');
    assert.match(h, /с ним работает: не требовать слов о чувствах/);
    assert.match(h, /молчит из преданности/);
    assert.ok(!/с ним работает/.test(hints({ ...base, dom: { id: '', step: 0 }, ease: STYLE_EASE.guard }).help.join('|')), 'когда всё ровно — подсказка не нужна');
});

test('качели статуса: уверенного придавило — видно; тихого вынесло наверх — тоже; середина не качается', () => {
    assert.equal(statusHabit({ base: { ctl: 5, wor: 0 } }, 'fix'), 'high');
    assert.equal(statusHabit({ base: { ctl: -6, wor: -10 } }, 'serve'), 'low');
    assert.equal(statusHabit({ base: { ctl: 0, wor: 0 } }, 'guard'), '');
    assert.equal(statusHabit({ base: { ctl: 20, wor: 0 } }, ''), 'high');
    assert.equal(statusFlip('high', { id: 'shame', step: 2 }), 'drop');
    assert.equal(statusFlip('high', { id: 'fear', step: 3 }), 'drop');
    assert.equal(statusFlip('high', { id: 'shame', step: 1 }), '', 'первая ступень позу не ломает');
    assert.equal(statusFlip('high', { id: 'anger', step: 3 }), '', 'злость уверенного — не падение');
    assert.equal(statusFlip('low', { id: 'anger', step: 2 }), 'rise');
    assert.equal(statusFlip('low', { id: '', step: 0 }, true), 'rise');
    assert.equal(statusFlip('low', { id: 'shame', step: 3 }), '');
    assert.equal(statusFlip('', { id: 'shame', step: 3 }), '');
    const s = { ...P.fresh(), dr: { bond: 60, safe: 60, free: 60, need: 60, quiet: 60, novel: 60 } };
    assert.match(combos({ s, dom: { id: 'shame', step: 2 }, status: 'drop' }).find(c => c.id === 'drop').t, /привычная уверенность слетела/);
    assert.match(combos({ s, dom: { id: '', step: 0 }, status: 'rise' }).find(c => c.id === 'rise').t, /непривычно выпрямляется/);
});
