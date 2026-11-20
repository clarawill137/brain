// Песочница — движок: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../core/psyche.js';
import { SPANS, SAND_MAX, sandNew, sandOther, sandView, sandInner, sandSeen, sandApply, sandPush, sandEdit, sandSet, sandScript } from '../core/sandbox.js';

const T = P.normTemper(P.defaultTemper());
const TT = { 'А': T, 'Б': T };
const scene = (o = {}) => sandNew({ a: 'А', b: 'Б', place: 'кухня', setup: 'ночной разговор', first: 'Б', ...o }, { 'А': P.fresh(T), 'Б': P.fresh(T) });

test('песочница: состояние — копия; настоящее от сцены не меняется', () => {
    const real = { 'А': P.fresh(T), 'Б': P.fresh(T) };
    const before = JSON.stringify(real);
    const sb = sandNew({ a: 'А', b: 'Б' }, real);
    sandPush(sb, 'А', 'Текст хода, достаточно длинный.', '', sandApply(sb, 'А', [{ who: 'Б', blow: 3, why: 'унизил' }], TT));
    assert.equal(JSON.stringify(real), before);
    assert.notEqual(JSON.stringify(sb.st['Б']), JSON.stringify(real['Б']));
    assert.equal(sb.next, 'Б');
    assert.equal(sandOther(sb, 'А'), 'Б');
});

test('песочница: событие ложится на того, с кем случилось; поручни те же, что в чате', () => {
    const sb = scene();
    const fx = sandApply(sb, 'Б', [{ who: 'А', by: 'Б', blow: 2, why: 'упрекнул при всех' }, { who: 'чужой', blow: 3 }], TT);
    assert.deepEqual(fx['А'].hits, { blow: 2 });
    assert.equal(fx['А'].why, 'упрекнул при всех');
    assert.deepEqual(fx['Б'].hits, {});
    assert.ok(fx['А'].view.E.wor < 0 && fx['А'].view.step <= 1, 'одно заметное событие — не выше первой ступени');
    assert.equal(fx['Б'].view.name, 'ровно');
    const one = scene();
    const hard = sandApply(one, 'Б', [{ who: 'А', blow: 3, why: 'сильно' }], TT);
    assert.ok(hard['А'].view.step >= 2 && hard['А'].view.step <= 3, 'одно сильное — вторая-третья, не последняя');
    // имена сверяет стыковка: короткое имя тоже находит героя
    const short = sandApply(scene(), 'Б', [{ who: 'а', warm: 2 }], TT, { same: (x, y) => x.toLowerCase() === y.toLowerCase() });
    assert.deepEqual(short['А'].hits, { warm: 2 });
    // множители пары приходят снаружи и только на некрупное решает стыковка — здесь просто доходят до ядра
    const plain = sandApply(scene(), 'Б', [{ who: 'А', warm: 2 }], TT)['А'].view.E.val;
    const more = sandApply(scene(), 'Б', [{ who: 'А', warm: 2 }], TT, { kmul: () => ({ warm: 1.25 }) })['А'].view.E.val;
    assert.ok(more > plain);
});

test('песочница: скрытый мотив и событие извне живут свой срок', () => {
    const sb = scene({ motive: { 'А': { t: 'скрывает отъезд', left: 3 }, 'Б': { t: 'пришёл мириться', left: 77 } }, event: { t: 'гаснет свет', left: 1 }, cond: { 'А': 'не спал двое суток' } });
    assert.deepEqual(SPANS, [1, 3, 5, 999]);
    assert.deepEqual(sb.motive['Б'], { t: 'пришёл мириться', left: 3 }, 'срок — только из списка, иначе три хода');
    assert.equal(sb.cond['А'], 'не спал двое суток');
    sandPush(sb, 'Б', 'Первый ход сцены, вполне длинный.', 'думает другое', {});
    assert.equal(sb.event, null, 'событие на один ход — отыграно');
    assert.equal(sb.turns[0].ev, 'гаснет свет');
    assert.equal(sb.motive['Б'].left, 2);
    assert.equal(sb.motive['А'].left, 3, 'срок мотива идёт только на ходах его героя');
    for (let k = 0; k < 3; k++) sandPush(sb, 'А', 'Ход.', '', {});
    assert.equal(sb.motive['А'], null);
    sandSet(sb, 'event', '', { t: 'звонит телефон', left: 999 });
    for (let k = 0; k < 5; k++) sandPush(sb, 'Б', 'Ход.', '', {});
    assert.equal(sb.event.t, 'звонит телефон', '«до конца сцены» не убывает');
    sandSet(sb, 'motive', 'А', { t: 'тянет время', left: 1 });
    assert.equal(sb.motive['А'].t, 'тянет время');
    sandSet(sb, 'event', '', { t: '' });
    assert.equal(sb.event, null);
});

test('песочница: модели — что внутри словами, второму — только видимое; правка хода руками; длина сцены', () => {
    const sb = scene();
    assert.equal(sandInner(sb.st['А'], T), 'ровно: ничего не давит');
    assert.equal(sandSeen(sb.st['А'], T), 'держится ровно');
    sandApply(sb, 'Б', [{ who: 'А', blow: 2, why: 'упрёк' }], TT);
    assert.match(sandInner(sb.st['А'], T), /^неловкость — /);
    assert.equal(sandSeen(sb.st['А'], T), 'держится ровно', 'слабое чувство со стороны не читается');
    for (let k = 0; k < 2; k++) sandApply(sb, 'Б', [{ who: 'А', blow: 3, why: 'добил' }], TT);
    assert.match(sandSeen(sb.st['А'], T), /видно|проступает/);
    assert.ok(!/\d/.test(sandInner(sb.st['А'], T)), 'модели — без цифр');
    assert.ok(sandView(sb.st['А'], T).strain > 0);
    sandPush(sb, 'Б', 'Старый текст хода.', '', {});
    sandEdit(sb, 'Новый текст, который вписал режиссёр.');
    assert.deepEqual([sb.turns[0].text, sb.turns[0].hand], ['Новый текст, который вписал режиссёр.', true]);
    assert.equal(sandScript(sb, (n) => n.toLowerCase()), 'б: Новый текст, который вписал режиссёр.');
    for (let k = 0; k < SAND_MAX + 5; k++) sandPush(sb, 'А', `Ход ${k}.`, '', {});
    assert.equal(sb.turns.length, SAND_MAX);
});

test('песочница: срыв случается по тем же правилам и проживается следующим ходом', () => {
    const sb = scene();
    Object.assign(sb.st['А'], { strain: 90, will: 10 });
    const fx = sandApply(sb, 'Б', [{ who: 'А', blow: 1, why: 'последняя капля' }], TT);
    assert.equal(fx['А'].brk, true);
    assert.match(sandInner(sb.st['А'], T), /^срыв в этом ходе: [\s\S]*последняя капля: последняя капля/);
    assert.equal(sandSeen(sb.st['А'], T), 'сорвался — это видно всем');
    const next = sandApply(sb, 'А', [], TT);
    assert.equal(next['А'].brk, false);
    assert.ok(sb.st['А'].strain < 90, 'напряжение вышло');
});
