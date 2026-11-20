// Проверка стыковки с Life на макете моста: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';

const first = (n) => String(n || '').trim().split(/\s+/)[0].toLowerCase();
const world = { timestamp: { story_date: '2024-12-01', story_time: '10:00' }, scene: { characters_present: ['Баки Барнс', 'Хеди Барлоу'] } };
const chat = [];
const post = (name, user = false) => { chat.push({ name, is_user: user, is_system: false, mes: '…', horae_meta: { timestamp: { ...world.timestamp } } }); return chat.length - 1; };
const handlers = {};
const st = { depth: null, ext: { brain: { auto: false } }, md: { brain: { circle: [] } }, toasts: [], inner: {}, hurt: {}, sleep: {}, stones: null, trig: {}, shelf: {}, asked: 0, fx: {}, kept: {}, wants: {}, steps: 0, core: [], faces: [], rel: {}, story: null, fill: [], pins: {} };

const api = {
    ctx: () => ({ name1: 'Хеди Барлоу', extensionSettings: st.ext, chatMetadata: st.md, saveSettingsDebounced() {}, saveMetadataDebounced() {}, eventSource: { on() {} }, eventTypes: { CHAT_CHANGED: 'chat' } }),
    esc: (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    canonName: (n) => String(n || '').trim(),
    sameName: (a, b) => !!a && !!b && first(a) === first(b),
    shortName: (n) => String(n || '').trim().split(/\s+/)[0],
    groupMembers: () => ['Баки Барнс', 'Наташа Романофф', 'Рассказчик'],
    hasChat: () => true,
    settings: () => ({ enabled: true }),
    worldState: () => world,
    parseDate: (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
    chatArr: () => chat,
    relOf: (a, b) => st.rel[`${first(a)}>${first(b)}`] || { closeness: 90 },
    toast: (...a) => st.toasts.push(a),
    updatePrompt() {}, render() {}, saveMeta() {},
    sec: (t, s = '') => `<div class="lf-sec">${t}${s}</div>`,
    ava: (n, c = '') => `<span class="lf-ava ${c}">${n}</span>`,
    icon: () => '',
    openSheet() {},
    withBusy: async (_el, fn) => fn(),
    cardOf: () => ({ description: 'Бывший Зимний солдат. Сдержан, говорит коротко.' }),
    askJson: async () => {
        st.asked++;
        return { ...(st.depth || {}), note: 'Держится ровно, вину носит молча.', base: { val: -5, aro: 5, ctl: 28, wor: -18 }, react: 0.9, recover: 0.7, grit: 1.5, sens: { blow: 1.4, bound: 1.5, threat: 0.7, warm: 0.8, wrong: 1, loss: 1.2 },
            cass: { shame: ['отводит глаза и трёт запястье живой руки', 'замолкает и уходит чинить что-нибудь руками', 'отказывается от её рук: «не надо, я грязный»', 'лицо пустеет, отвечает рапортом'], brk: 'лицо пустеет, тело собирается, речь сжимается до односложных рапортов' } };
    },
    senses: {
        hurt: (who) => ({ lvl: st.hurt[first(who)] || 0, n: st.hurt[first(who)] ? 1 : 0 }),
        sleep: (who) => st.sleep[first(who)] || null,
        needs: () => ({ food: 80, energy: 80, clean: 80, health: 100 }),
        stones: () => st.stones,
        patience: () => null,
        trigAt: (i) => st.trig[i] || [],
        state: (who) => st.inner[first(who)] || null,
        setState: (who, id, why, i, src) => { if (!id) { delete st.inner[first(who)]; return true; } st.inner[first(who)] = { id, why, src, manual: false }; return true; },
        under: () => null,
        kept: (who) => st.kept[first(who)] || { n: 0, list: [] },
        wants: (who) => st.wants[first(who)] || [],
        fx: (who) => st.fx[first(who)] || [],
        steps: () => ({ n: st.steps, themes: [] }),
        face: (i, who, k) => { st.faces.push([i, first(who), k]); return true; },
        rel: (a, b) => st.rel[`${first(a)}>${first(b)}`] || { closeness: 90 },
    },
    story: { ready: () => !!st.story, felt: (who, w = 2) => (st.story?.felt || []).filter(f => f.w >= w) },
    relPin: (a, b, v) => { const k = `${first(a)}>${first(b)}`; if (st.pins[k]) return false; st.pins[k] = v; return true; },
    askFillJson: async (messages, tokens, o, opts) => { st.fill.push({ messages, tokens, opts }); return api.askJson(); },
    lore: { about: async () => 'Лор о нём.', card: () => 'Карточка.', core: () => '• говорит коротко', key: (w) => String(w).trim(), coreAdd: (who, line) => { st.core.push([who, line]); return true; } },
    shelf: { tracker: (t) => { st.shelf.tracker = t; return true; }, mind: (f) => { st.shelf.mind = f; }, recs: (f) => { st.shelf.recs = f; }, open() {} },
};

globalThis.document = { addEventListener: (type, fn) => { handlers[type] = fn; }, querySelectorAll: () => [], activeElement: null };
const click = (dataset) => handlers.click({ target: { closest: () => ({ dataset }) }, preventDefault() {}, stopPropagation() {} });
const change = (dataset, value, extra = {}) => handlers.change({ target: { dataset, value, tagName: 'INPUT', ...extra }, stopPropagation() {} });
globalThis.LifeBridge = { version: 'макет', register(mod) { this.mod = mod; mod.init(api); return true; } };
await import('../index.js');
const mod = globalThis.LifeBridge.mod;
const brain = globalThis.LifeBrain;

const hour = (h) => { const d = new Date(2024, 11, 1, 10 + h, 0); world.timestamp = { story_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, story_time: `${String(d.getHours()).padStart(2, '0')}:00` }; };

test('подключился к мосту и занял полки', () => {
    assert.equal(mod.id, 'brain');
    assert.ok(st.shelf.tracker && st.shelf.mind && st.shelf.recs);
    assert.deepEqual(brain.list(), ['Баки Барнс', 'Наташа Романофф'], 'персона игрока и рассказчик — без мозга');
});

test('Летописцу уходит правило и строка «Психика»', () => {
    const c = mod.chron();
    assert.equal(c.key, '"psy": []');
    assert.match(c.rule, /blow/);
    assert.match(c.input, /Баки Барнс — ровно/);
    assert.ok(!/Хеди Барлоу — |Рассказчик/.test(c.input), 'психику персонажа игрока и рассказчика мозг не ведёт');
    assert.match(c.input, /персонаж игрока: Хеди \(только выпитое\)/);
    assert.ok(c.tokens > 100);
});

test('спокойно — модели ничего не уходит', () => {
    assert.equal(mod.prompt('normal'), '');
});

test('удар по самооценке → стыд, заметка с причиной, состояние во «Внутри»', () => {
    post('Хеди Барлоу', true);
    const i = post('Баки Барнс');
    mod.afterPost(i, { psy: [{ who: 'Баки', blow: 3, held: 1, why: 'она напомнила про Старков' }] }, chat[i]);
    const p = mod.prompt('normal');
    assert.match(p, /Баки — что внутри сейчас/);
    assert.match(p, /стыд|никчёмност|неловкость/);
    assert.match(p, /напомнила про Старков/);
    assert.ok(!/\d{2,}/.test(p), 'без цифр');
    assert.equal(st.inner['баки'].src, 'brain');
    assert.equal(brain.owns('Баки Барнс'), true);
    assert.equal(brain.view('Баки Барнс').emo.id, 'shame');
    assert.equal(mod.prompt('quiet'), '');
});

test('свайп того же поста не удваивает событие', () => {
    const i = chat.length - 1;
    const before = brain.view('Баки Барнс');
    mod.afterPost(i, { psy: [{ who: 'Баки', blow: 3, held: 1, why: 'она напомнила про Старков' }] }, chat[i]);
    const after = brain.view('Баки Барнс');
    assert.equal(after.E.wor, before.E.wor);
    assert.equal(after.will, before.will);
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.equal(brain.view('Баки Барнс').emo.id, '', 'свайп без события — состояние как до поста');
    assert.equal(st.inner['баки'], undefined, 'своё состояние во «Внутри» мозг снял');
});

test('«что записал пост» и отмена записи', () => {
    const i = post('Баки Барнс');
    mod.afterPost(i, { psy: [{ who: 'Баки Барнс', wrong: 2, why: 'ему соврали' }] }, chat[i]);
    const rows = st.shelf.recs(i);
    assert.equal(rows.length, 1);
    assert.match(rows[0].t, /Баки: несправедливость 2 — ему соврали/);
    rows[0].del();
    assert.equal(brain.view('Баки Барнс').emo.id, '');
});

test('перечитать старый пост — события второй раз не считаются', () => {
    const old = post('Баки Барнс');
    mod.afterPost(old, { psy: [{ who: 'Баки', loss: 2, why: 'она уехала' }] }, chat[old]);
    const i = post('Баки Барнс');
    mod.afterPost(i, { psy: [] }, chat[i]);
    const before = JSON.stringify(st.md.brain.who['Баки Барнс']);
    mod.afterPost(old, { psy: [{ who: 'Баки', loss: 3, why: 'она уехала' }] }, chat[old]);
    assert.equal(JSON.stringify(st.md.brain.who['Баки Барнс']), before);
    hour(60);
    const j = post('Баки Барнс');
    mod.afterPost(j, { psy: [] }, chat[j]);
    hour(0);
});

test('время лечит: через сутки истории вспышка ушла', () => {
    const i = post('Баки Барнс');
    mod.afterPost(i, { psy: [{ who: 'Баки', threat: 3, why: 'выстрел за окном' }] }, chat[i]);
    assert.equal(brain.view('Баки Барнс').emo.id, 'fear');
    hour(30);
    assert.equal(brain.view('Баки Барнс').emo.id, '');
    assert.equal(mod.prompt('normal'), '');
});

test('тело: рана и недосып давят, тревога за неё — тоже', () => {
    st.hurt['баки'] = 3;
    st.sleep['баки'] = { debt: 10, nights: 7, last: 4 };
    st.stones = { who: 'Хеди Барлоу', lvl: 80, mode: 'attack', pend: true };
    const html = st.shelf.tracker.html();
    assert.match(html, /рана \(тяжёлая\)/);
    assert.match(html, /недосып: 10 ч/);
    assert.match(html, /приступ Камней/);
    const v = brain.view('Баки Барнс');
    assert.ok(v.will <= 70, `потолок воли от раны: ${v.will}`);
    assert.ok(v.E.val < 0 && v.E.ctl < 10);
    st.hurt = {}; st.sleep = {}; st.stones = null;
});

test('сработавший триггер — событие без слов Летописца', () => {
    const i = post('Баки Барнс');
    st.trig[i] = [{ who: 'Баки Барнс', t: 'Фиксация рук', coped: false, lvl: 3 }];
    mod.afterPost(i, { psy: [] }, chat[i]);
    const p = mod.prompt('normal');
    assert.match(p, /триггер: Фиксация рук/);
    assert.equal(brain.view('Баки Барнс').emo.id, 'fear');
    hour(80);
});

test('срыв: накопилось → сигнал, в следующем ответе прорывается, потом похмелье', async () => {
    let i = post('Баки Барнс');
    mod.afterPost(i, { psy: [] }, chat[i]);
    const s = st.md.brain.who['Баки Барнс'];
    assert.ok(!s.brk && !s.hang, 'триггер сам по себе срыв не взводит');
    s.strain = 92; s.will = 8;
    i = post('Баки Барнс');
    const n = st.toasts.length;
    mod.afterPost(i, { psy: [{ who: 'Баки', blow: 2, why: 'ещё одна колкость' }] }, chat[i]);
    assert.ok(s.brk, 'срыв взведён');
    assert.equal(st.toasts.length, n + 1);
    assert.match(mod.prompt('normal'), /Баки — срыв в этом ответе/);
    assert.equal(brain.view('Баки Барнс').brk, true);
    // отменить срыв тапом — и свайп его не вернёт
    await click({ bact: 'unbrk', who: 'Баки Барнс' });
    assert.ok(!st.md.brain.who['Баки Барнс'].brk);
    mod.afterPost(i, { psy: [{ who: 'Баки', blow: 2, why: 'ещё одна колкость' }] }, chat[i]);
    assert.ok(!st.md.brain.who['Баки Барнс'].brk, 'после свайпа отмена держится');
    // а теперь по-настоящему
    const s2 = st.md.brain.who['Баки Барнс'];
    s2.strain = 92; s2.will = 8;
    i = post('Баки Барнс');
    mod.afterPost(i, { psy: [{ who: 'Баки', wrong: 1, why: 'и ещё одна' }] }, chat[i]);
    assert.ok(s2.brk);
    i = post('Баки Барнс');
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.ok(!s2.brk && s2.hang, 'срыв прожит — похмелье');
    assert.match(mod.prompt('normal'), /после срыва/);
    hour(120);
    i = post('Баки Барнс');
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.ok(!s2.hang);
});

test('темперамент и кассеты из карточки и лорбука — в заметке его кассета', async () => {
    assert.match(st.shelf.tracker.html(), /обычный человек — ещё не собран/);
    await click({ bact: 'collect', who: 'Баки Барнс' });
    assert.equal(st.asked, 1);
    const t = st.ext.brain.prof['Баки Барнс'];
    assert.equal(t.src, 'lore');
    assert.equal(t.base.ctl, 28);
    assert.equal(t.sens.bound, 1.5);
    assert.match(st.shelf.tracker.html(), /собран по карточке и лорбуку/);
    const i = post('Баки Барнс');
    mod.afterPost(i, { psy: [{ who: 'Баки', blow: 2, why: 'она назвала его руки руками убийцы' }] }, chat[i]);
    const p = mod.prompt('normal');
    assert.match(p, /замолкает и уходит чинить|отказывается от её рук|лицо пустеет|трёт запястье/, 'играет его кассета, а не запасная');
    hour(200);
});

test('руками: сдвинуть, поправить темперамент и кассету', async () => {
    const i = post('Баки Барнс');
    mod.afterPost(i, { psy: [] }, chat[i]);
    await click({ bact: 'nudge', k: 'warm', who: 'Баки Барнс' });
    await click({ bact: 'nudge', k: 'warm', who: 'Баки Барнс' });
    assert.equal(brain.view('Баки Барнс').emo.id, 'tender');
    // свайп последнего поста ручную правку не съедает
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.equal(brain.view('Баки Барнс').emo.id, 'tender');
    change({ bin: 't', k: 'base.val', who: 'Баки Барнс' }, '20');
    assert.equal(st.ext.brain.prof['Баки Барнс'].base.val, 20);
    assert.equal(st.ext.brain.prof['Баки Барнс'].src, 'hand');
    const stepNow = brain.view('Баки Барнс').emo.step;
    change({ bin: 'c', k: 'tender', n: String(stepNow - 1), who: 'Баки Барнс' }, 'приносит ей кофе\n и молчит рядом', { tagName: 'TEXTAREA' });
    assert.equal(st.ext.brain.prof['Баки Барнс'].cass.tender[stepNow - 1], 'приносит ей кофе и молчит рядом');
    assert.match(mod.prompt('normal'), /приносит ей кофе и молчит рядом/);
    // пустая ступень — вернулась запасная кассета
    change({ bin: 'c', k: 'tender', n: String(stepNow - 1), who: 'Баки Барнс' }, '', { tagName: 'TEXTAREA' });
    assert.ok(!/кофе/.test(mod.prompt('normal')));
    assert.match(mod.prompt('normal'), /Баки — что внутри сейчас/);
    await click({ bact: 'reset', who: 'Баки Барнс' });
    assert.equal(brain.view('Баки Барнс').emo.id, '');
    change({ bin: 'on', who: 'Наташа Романофф', checked: false }, '', { checked: false });
    assert.deepEqual(brain.list(), ['Баки Барнс']);
    change({ bin: 'on', who: 'Наташа Романофф' }, '', { checked: true });
    assert.equal(brain.list().length, 2);
});

test('страница персонажа и Сцена рисуются', () => {
    assert.match(st.shelf.mind('Баки Барнс'), /Код-мозг/);
    assert.equal(st.shelf.mind('Хеди Барлоу'), '');
    assert.match(mod.sceneHtml(), /brn-aura/);
    assert.ok(!/Наташа/.test(mod.sceneHtml()), 'кого нет в сцене — без ауры');
    assert.match(st.shelf.tracker.html(), /Настройки мозга/);
    assert.equal(typeof st.shelf.tracker.state(), 'string');
});

test('выключенный мозг молчит', () => {
    st.ext.brain.on = false;
    assert.equal(mod.chron(), null);
    assert.equal(mod.prompt('normal'), '');
    assert.equal(mod.sceneHtml(), '');
    assert.equal(brain.owns('Баки Барнс'), false);
    st.ext.brain.on = true;
});


// ───── 0.2 ─────

const B = 'Баки Барнс';
const live = () => st.md.brain.who[B];
const fresh = async (h) => { hour(h); await click({ bact: 'reset', who: B }); const i = post(B); mod.afterPost(i, { psy: [] }, chat[i]); return i; };
const next = (psy = [], who = B) => { const i = post(who); mod.afterPost(i, { psy }, chat[i]); return i; };
const lastIndex = () => chat.length - 1;

test('0.2: «сдержался» копит несказанное, без сил оно проступает; «открылся» — отпускает', async () => {
    await fresh(300);
    next([{ who: 'Баки', held: 3, why: 'проглотил' }]);
    next([{ who: 'Баки', held: 3, why: 'опять промолчал' }]);
    next([{ who: 'Баки', held: 3, why: 'и снова' }]);
    assert.ok(live().mask >= 70, `несказанное ${live().mask}`);
    assert.ok(brain.view(B).leak >= 1);
    assert.match(mod.prompt('normal'), /то, что прячет/);
    assert.match(st.shelf.tracker.html(), /Несказанное/);
    next([{ who: 'Баки', open: 3, why: 'наконец сказал ей' }]);
    assert.ok(live().mask < 40);
    assert.equal(brain.view(B).leak, 0);
    assert.ok(!/то, что прячет/.test(mod.prompt('normal')));
});

test('0.2: тайны и несказанные желания держат маску поднятой', async () => {
    await fresh(400);
    st.kept['баки'] = { n: 4, list: ['знает, кто сдал базу'] };
    st.wants['баки'] = [{ t: 'хочет съездить в Бруклин один', mes: -100, voiced: null }];
    assert.match(st.shelf.tracker.html(), /тайны, которых не знает Хеди: 4/);
    assert.match(st.shelf.tracker.html(), /молчит о своих желаниях: 1/);
    hour(520);
    next();
    assert.ok(live().mask > 40, `за пять дней накопилось ${Math.round(live().mask)}`);
    st.kept = {}; st.wants = {};
});

test('0.2: что возвращает — Летописец называет номер, вспышка гаснет', async () => {
    await fresh(600);
    change({ bin: 'f', k: 'fix', who: B }, 'её голос\nсчёт вслух\n\nдело для рук', { tagName: 'TEXTAREA' });
    assert.deepEqual(st.ext.brain.prof[B].fix, ['её голос', 'счёт вслух', 'дело для рук']);
    assert.match(mod.chron().input, /возвращает: \[1\] её голос, \[2\] счёт вслух, \[3\] дело для рук/);
    next([{ who: 'Баки', threat: 3, bound: 2, why: 'её чуть не сбила машина' }]);
    const hot = brain.view(B);
    assert.match(mod.prompt('normal'), /что возвращает в себя/);
    const i = next([{ who: 'Баки', fix: [1, 9, 1], why: 'она говорила с ним тихо' }]);
    const cool = brain.view(B);
    assert.ok(cool.emo.lvl < hot.emo.lvl && cool.strain < hot.strain);
    assert.ok(st.shelf.recs(i).some(r => /сработало: её голос/.test(r.t)));
});

test('0.2: убеждение точится поступками, ломается — и просится в ядро характера', async () => {
    await fresh(700);
    change({ bin: 'b', k: 'beliefs', who: B }, 'я испорченный => я был оружием, а не убийцей', { tagName: 'TEXTAREA' });
    const bel = st.ext.brain.prof[B].beliefs[0];
    assert.ok(bel.id.startsWith('b') && bel.truth);
    assert.match(mod.chron().input, new RegExp(`убеждения: \\[${bel.id}\\] «я испорченный»`));
    next([{ who: 'Баки', blow: 2, why: 'вспомнил Даллас' }]);
    assert.match(mod.prompt('normal'), /живёт с убеждением «я испорченный» — оно держится крепко/);
    next([{ who: 'Баки', warm: 2, bel: [{ id: bel.id, d: -2 }, { id: 'чужое', d: -2 }], why: 'она поцеловала шов плоти и металла' }]);
    assert.equal(live().bel[bel.id], 92);
    assert.match(st.shelf.tracker.html(), /Убеждения/);
    live().bel[bel.id] = 6;
    const n = st.toasts.length;
    next([{ who: 'Баки', bel: [{ id: bel.id, d: -2 }], why: 'он сам сказал: это были не мои руки' }]);
    assert.equal(live().bel[bel.id], 0);
    assert.equal(st.toasts.length, n + 1);
    st.toasts[n][3].onclick();
    assert.deepEqual(st.core[st.core.length - 1], [B, 'я был оружием, а не убийцей']);
    assert.match(mod.prompt('normal'), /прежнее «я испорченный» больше не правда; теперь знает: я был оружием/);
    assert.ok(!/убеждения:/.test(mod.chron().input), 'сломанное Летописцу больше не показываем');
});

test('0.2: инициатива стоит воли, прожитое её удешевляет; без сил — мнётся', async () => {
    await fresh(800);
    st.steps = 0;
    const g = brain.afford(B, 'flirt');
    assert.equal(g.ok, true);
    assert.equal(g.cost, 10);
    st.steps = 10;
    assert.equal(brain.afford(B, 'flirt').cost, 6);
    const will = live().will;
    const i = post(B);
    brain.spend(B, 'flirt', i);
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.ok(Math.abs(live().will - (will - 6)) < 0.5, `воля ${will} → ${live().will}`);
    assert.ok(st.shelf.recs(i).some(r => /сам сделал шаг \(флирт\)/.test(r.t)));
    // свайп: шаг не случился — воля на месте
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.ok(Math.abs(live().will - will) < 0.5);
    live().will = 12;
    const no = brain.afford(B, 'court');
    assert.equal(no.ok, false);
    assert.match(no.why, /сил/);
    assert.ok(no.safe);
    assert.equal(brain.afford('Хеди Барлоу', 'care'), null, 'за героиню игрока мозг не отвечает');
    st.steps = 0;
});

test('0.2: сырые нервы и терпение — что Life спрашивает у мозга', async () => {
    await fresh(900);
    assert.equal(brain.raw(B), false);
    assert.equal(brain.edge(B), 1);
    live().strain = 75;
    assert.equal(brain.raw(B), true);
    assert.ok(brain.edge(B) > 1.2);
    st.ext.brain.on = false;
    assert.equal(brain.edge(B), 0, 'мозг выключен — Life считает по-старому');
    assert.equal(brain.raw(B), false);
    st.ext.brain.on = true;
});

test('0.2: химия — под алкоголем скрываемое ближе, обезболивающее глушит рану', async () => {
    await fresh(1000);
    st.hurt['баки'] = 2;
    const sober = brain.view(B).E.val;
    st.fx['баки'] = [{ what: 'морфин', left: 1e6 }];
    assert.ok(brain.view(B).E.val > sober);
    assert.match(st.shelf.tracker.html(), /под обезболивающим/);
    st.hurt = {};
    st.fx['баки'] = [{ what: 'выпил полбутылки виски', left: 1e6 }];
    live().mask = 60; live().will = 30;
    assert.match(mod.prompt('normal'), /навеселе/, 'о спиртном знает только Life — хотя бы «навеселе»');
    assert.ok(brain.view(B).leak >= 1);
    st.fx = {};
});

test('0.2: день, который помнит телом', async () => {
    await fresh(1100);
    const d = new Date(2024, 11, 1, 10 + 1100);
    change({ bin: 'd', k: 'dates', who: B }, `${d.getDate()}.${d.getMonth() + 1} — гибель Старков (вина)\nмусор без даты`, { tagName: 'TEXTAREA' });
    const dates = st.ext.brain.prof[B].dates;
    assert.equal(dates.length, 1);
    assert.match(st.shelf.tracker.html(), /сегодня: гибель Старков/);
    assert.match(mod.prompt('normal'), /сегодня гибель Старков — помнит этот день телом/);
    assert.ok(brain.view(B).E.wor < -10);
    hour(1100 + 24);
    assert.ok(!/гибель Старков — помнит/.test(mod.prompt('normal')), 'на следующий день — уже нет');
    change({ bin: 'd', k: 'dates', who: B }, '', { tagName: 'TEXTAREA' });
});

test('0.2: плохая ночь на нервах — утро другое; свайп даёт ту же ночь', async () => {
    await fresh(1200);
    let bad = false, i = 0;
    for (let day = 1; day <= 12 && !bad; day++) {
        live().strain = 100;
        hour(1200 + day * 24);
        i = next();
        bad = !!live().night?.bad;
    }
    assert.equal(bad, true, 'за двенадцать ночей на пределе хоть одна плохая');
    assert.equal(brain.night(B), true);
    assert.match(mod.prompt('normal'), /ночь была плохой/);
    assert.match(st.shelf.tracker.html(), /плохая ночь/);
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.equal(live().night.bad, true);
    await click({ bact: 'rest', who: B });
    assert.equal(brain.night(B), false, '«дать выспаться» ночь исправляет');
});

test('0.2: прогноз и кардиограмма в листе', async () => {
    await fresh(1600);
    hour(1624); next([{ who: 'Баки', warm: 2 }]);
    hour(1648); next([{ who: 'Баки', loss: 3, why: 'она уехала' }]);
    const html = st.shelf.tracker.html();
    assert.match(html, /Кардиограмма/);
    assert.match(html, /<polyline class="val"/);
    assert.match(html, /отпустит через/);
    st.hurt['баки'] = 4; st.sleep['баки'] = { debt: 20 }; st.stones = { who: 'Хеди Барлоу', mode: 'attack' };
    live().will = 10;
    assert.match(st.shelf.tracker.html(), /нервы станут сырыми|срыв через/);
    st.hurt = {}; st.sleep = {}; st.stones = null;
});

test('0.2: тревога за неё выходит опекой, пока она рядом', async () => {
    await fresh(1700);
    st.stones = { who: 'Хеди Барлоу', mode: 'hum' };
    live().fast.aro = 30; live().fast.ctl = -40;
    assert.ok(!/выходит опекой/.test(mod.prompt('normal')), 'Камни просто гудят — фон, без опеки');
    st.stones = { who: 'Хеди Барлоу', mode: 'attack' };
    assert.match(mod.prompt('normal'), /тревога за близкого \(Хеди\) выходит опекой/);
    st.stones = null;
});


// ───── 0.3: мозг рулит соседями ─────

test('0.3: «Языки» — срывается на свой язык по порогу чувства', async () => {
    await fresh(1800);
    assert.equal(brain.tongue(B), '');
    next([{ who: 'Баки', wrong: 3, why: 'ей угрожали при нём' }]);
    next([{ who: 'Баки', wrong: 2, why: 'и продолжили' }]);
    assert.equal(brain.tongue(B), 'злость');
    await fresh(1900);
    const i = post(B);
    st.trig[i] = [{ who: B, t: 'Русские кодовые слова', coped: true, lvl: 2 }];
    mod.afterPost(i, { psy: [] }, chat[i]);
    assert.equal(brain.tongue(B), 'триггер');
});

test('0.3: лицо на аватарке — мозг подсказывает, если человек не держал маску', async () => {
    await fresh(2000);
    st.faces.length = 0;
    let i = next([{ who: 'Баки', loss: 3, why: 'она ушла, хлопнув дверью' }]);
    assert.deepEqual(st.faces[st.faces.length - 1], [i, 'баки', 'sad']);
    const n = st.faces.length;
    i = next([{ who: 'Баки', loss: 2, held: 2, why: 'сделал вид, что всё в порядке' }]);
    assert.equal(st.faces.length, n, 'держал лицо — лицо остаётся тем, что видно снаружи');
});

test('0.3: что назрело — для твиста вслепую и искры драмы', async () => {
    await fresh(2100);
    assert.equal(brain.ripe(), '');
    live().strain = 70;
    assert.match(brain.ripe(), /Баки: нервы на пределе/);
    live().mask = 85;
    assert.match(brain.ripe(), /Баки носит в себе несказанное/);
    live().mask = 0; live().strain = 10;
    world.scene.characters_present = ['Наташа Романофф', 'Хеди Барлоу'];
    live().strain = 90;
    const other = brain.ripe();
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
    assert.ok(!/Баки/.test(other), 'кого нет в сцене — не в счёт');
});

test('0.3: стук от тоски — давно не виделись', async () => {
    await fresh(2200);
    assert.deepEqual(brain.miss(), [], 'он рядом — не скучает');
    world.scene.characters_present = ['Наташа Романофф', 'Хеди Барлоу'];
    hour(2210);
    assert.deepEqual(brain.miss().filter(x => x.who === B), [], 'десять часов — рано');
    hour(2240);
    const m = brain.miss();
    assert.equal(m.length, 1);
    assert.equal(m[0].who, B);
    assert.equal(m[0].how, 'text');
    assert.match(m[0].id, /^brn:Баки Барнс:/);
    hour(2300);
    assert.equal(brain.miss()[0].how, 'call', 'три дня — уже звонит');
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
    assert.deepEqual(brain.miss().filter(x => x.who === B), []);
});

// ───── 0.4: потребности, комбинации, подсказки, память с чувством, заражение ─────

test('0.4: потребности двигаются событиями, видны соседям и утоляются тапом', async () => {
    await fresh(2400);
    const base = brain.view(B).dr;
    assert.deepEqual(Object.keys(base), ['bond', 'safe', 'free', 'need', 'quiet', 'novel']);
    next([{ who: 'Баки', loss: 3, why: 'она сказала, что ей нужно побыть одной' }]);
    assert.ok(brain.view(B).dr.bond < base.bond - 25);
    const html = st.shelf.tracker.html();
    assert.match(html, /Потребности/);
    assert.match(html, /Близость/);
    const low = brain.view(B).dr.bond;
    await click({ bact: 'feed', k: 'bond', d: '20', who: B });
    assert.equal(brain.view(B).dr.bond, low + 20);
});

test('0.4: комбинация уходит модели поведением — голод по близости со стыдом', async () => {
    await fresh(2500);
    live().dr.bond = 15;
    next([{ who: 'Баки', blow: 3, why: 'увидел себя в записи ГИДРЫ' }]);
    next([{ who: 'Баки', blow: 2, why: 'она это тоже видела' }]);
    assert.ok(brain.view(B).combo.includes('starve'));
    const p = mod.prompt('normal');
    assert.match(p, /тянется к близости и отдёргивает себя/);
    assert.match(st.shelf.tracker.html(), /Сейчас из этого выходит/);
});

test('0.4: подсказки игроку — в листе, но не в промпте', async () => {
    await fresh(2600);
    change({ bin: 'f', k: 'fix', who: B }, 'её голос\nдело для рук', { tagName: 'TEXTAREA' });
    next([{ who: 'Баки', threat: 3, bound: 2, why: 'его прижали к стене' }]);
    const html = st.shelf.tracker.html();
    assert.match(html, /Подсказки тебе/);
    assert.match(html, /Сработает/);
    assert.match(html, /страх: верни контроль/);
    assert.match(html, /больные места/);
    assert.match(html, /Чего ждать/);
    assert.ok(!/верни контроль|больные места|Подсказки/.test(mod.prompt('normal')));
});

test('0.4: память с чувством — сильное запоминается и всплывает позже в тон', async () => {
    await fresh(2700);
    const i0 = next([{ who: 'Баки', loss: 3, why: 'она ушла, хлопнув дверью' }]);
    assert.equal(live().marks.length, 1);
    assert.equal(live().marks[0].emo, 'low');
    assert.match(st.shelf.tracker.html(), /Память с чувством/);
    assert.ok(!/всплывает прежнее/.test(mod.prompt('normal')), 'свежее не всплывает');
    hour(2760);
    for (let k = 0; k < 22; k++) next();
    assert.ok(!/всплывает прежнее/.test(mod.prompt('normal')), 'пока ровно — молчит');
    next([{ who: 'Баки', loss: 3, why: 'опять один в пустой квартире' }]);
    assert.match(mod.prompt('normal'), /всплывает прежнее[^:]*: «она ушла, хлопнув дверью»/);
    assert.equal(live().marks.find(m => m.mes === i0).r, lastIndex());
    const id = live().marks.find(m => m.mes === i0).id;
    await click({ bact: 'unmark', id, who: B });
    assert.ok(!live().marks.some(m => m.id === id));
});

test('0.4: заражение настроением — близкие в одной сцене тянут друг друга', async () => {
    await fresh(2900);
    world.scene.characters_present = ['Баки Барнс', 'Наташа Романофф', 'Хеди Барлоу'];
    const nat = () => st.md.brain.who['Наташа Романофф'];
    let i = next();
    const calm = nat().fast.aro;
    i = next([{ who: 'Баки', threat: 3, bound: 3, why: 'сработала тревога, двери заблокированы' }]);
    assert.ok(nat().fast.aro > calm + 4, 'его страх передаётся ей');
    assert.ok(st.shelf.recs(i).some(r => /Наташа: рядом Баки/.test(r.t)));
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
    const far = nat().fast.aro;
    next([{ who: 'Баки', threat: 3, why: 'ещё один взрыв' }]);
    assert.ok(nat().fast.aro <= far, 'кого нет рядом — не заражается');
});

test('0.4: темперамент — насколько нужна каждая потребность', async () => {
    change({ bin: 't', k: 'want.quiet', who: B }, '1.6');
    assert.equal(st.ext.brain.prof[B].want.quiet, 1.6);
    assert.match(st.shelf.tracker.html(), /Чего сколько надо/);
});

// ───── 0.5: линза привязанности, ревность, гавань, роль сильного, погода дома, механизмы ─────

const LOVE = { trust: 90, closeness: 100, love: 100, desire: 80, jealousy: 10, tension: 10, guilt: 5, pin: { love: 100, closeness: 100 } };
const N = 'Наташа Романофф';
const lastLog = (src = 'post') => live().log.slice().reverse().find(e => e.src === src);

test('0.5: Летописцу — «от кого» и ревность', () => {
    const c = mod.chron();
    assert.match(c.rule, /"by":"его имя"/);
    assert.match(c.rule, /rival — ревность/);
});

test('0.5: любовь — линза: то же слово от неё размывается, от другого — нет; уход от неё больнее', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    await fresh(3200);
    next([{ who: 'Баки', by: 'Хеди', blow: 2, why: 'она бросила резкое слово' }]);
    const soft = lastLog();
    assert.equal(soft.by, 'Хеди');
    assert.ok(soft.tags.includes('blur'));
    const html = st.shelf.tracker.html();
    assert.match(html, /от Хеди · любовь размыла/);
    await fresh(3300);
    next([{ who: 'Баки', by: 'Наташа', blow: 2, why: 'Наташа бросила резкое слово' }]);
    const plain = lastLog();
    assert.ok(Math.abs(soft.d.wor) < Math.abs(plain.d.wor) * 0.8, `${soft.d.wor} против ${plain.d.wor}`);
    await fresh(3400);
    next([{ who: 'Баки', by: 'Хеди', loss: 2, why: 'она сказала, что уезжает одна' }]);
    const deep = lastLog();
    assert.ok(deep.tags.includes('deep'));
    await fresh(3500);
    next([{ who: 'Баки', loss: 2, why: 'сорвалась поездка' }]);
    assert.ok(Math.abs(deep.d.val) > Math.abs(lastLog().d.val) * 1.1);
});

test('0.5: «К кому как» — умные статы пары в листе и у соседей', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    await fresh(3600);
    const html = st.shelf.tracker.html();
    assert.match(html, /К кому как/);
    assert.match(html, /космическая/);
    assert.match(html, /Прощает/); assert.match(html, /Ревность наготове/);
    const d = brain.view(B).dear;
    assert.equal(d.to, 'Хеди Барлоу'); assert.equal(d.L, 1);
    assert.ok(d.blur >= 80 && d.haven >= 70);
});

test('0.5: ревность — берёт по любви и неуверенности, уходит модели поведением, игроку — подсказкой', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    await fresh(3700);
    next([{ who: 'Баки', blow: 3, why: 'увидел своё досье' }]);
    next([{ who: 'Баки', by: 'Хеди', rival: 3, why: 'она весь вечер смеялась с другим' }]);
    assert.ok(live().jeal >= 40, `ревность ${live().jeal}`);
    assert.equal(live().jealTo, 'Хеди Барлоу');
    assert.ok(brain.view(B).combo.includes('jealous'));
    assert.match(mod.prompt('normal'), /ревнует/);
    const html = st.shelf.tracker.html();
    assert.match(html, /ревность \(Хеди\)/);
    assert.match(html, /ревнует: само за час не пройдёт/);
    // без привязанности соперник почти не берёт
    st.rel['баки>хеди'] = { trust: 50, closeness: 50 };
    await fresh(3800);
    next([{ who: 'Баки', by: 'Хеди', rival: 3, why: 'она смеялась с другим' }]);
    assert.ok(live().jeal < 25, `без любви: ${live().jeal}`);
    st.rel['баки>хеди'] = { ...LOVE };
});

test('0.5: гавань — рядом со своим человеком угроза переносится легче и отпускает быстрее', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    await fresh(3900);
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
    next();
    assert.match(st.shelf.tracker.html(), /рядом Хеди — отпускает/);
    next([{ who: 'Баки', threat: 2, why: 'выстрел за окном' }]);
    const near = lastLog();
    assert.ok(near.tags.includes('haven'));
    await fresh(4000);
    world.scene.characters_present = ['Баки Барнс'];
    next();
    next([{ who: 'Баки', threat: 2, why: 'выстрел за окном' }]);
    assert.ok(Math.abs(near.d.aro) < Math.abs(lastLog().d.aro), `${near.d.aro} против ${lastLog().d.aro}`);
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
});

test('0.5: от своего прилетело — неуверенный закрывается; тепло от того же человека отпускает', async () => {
    st.rel['баки>хеди'] = { ...LOVE, pin: {} };      // любит, но не «космически»: замка нет
    await fresh(4100);
    next([{ who: 'Баки', blow: 3, why: 'увидел запись своих убийств' }]);
    next([{ who: 'Баки', blow: 2, why: 'ещё одна' }]);
    next([{ who: 'Баки', by: 'Хеди', wrong: 2, why: 'она решила за него' }]);
    assert.equal(live().hurtBy.kind, 'guard');
    assert.ok(brain.view(B).combo.includes('shut'));
    assert.match(mod.prompt('normal'), /закрывается и отступает раньше, чем оттолкнут/);
    assert.match(st.shelf.tracker.html(), /шаг за тобой/);
    next([{ who: 'Баки', by: 'Хеди', warm: 2, why: 'она взяла его за руку' }]);
    assert.equal(live().hurtBy, null);
    assert.ok(live().feed['Хеди Барлоу'].bond > 0, 'кто чем кормит');
});

test('0.5: роль сильного — дни подряд, потом трещит', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    await fresh(4300);
    for (let d = 1; d <= 12; d++) { hour(4300 + d * 24); next([{ who: 'Баки', held: 1, why: 'сказал, что всё нормально' }]); }
    assert.ok(live().role >= 10, `дней: ${live().role}`);
    assert.equal(brain.view(B).role, live().role);
    assert.ok(brain.view(B).combo.includes('crack'));
    const html = st.shelf.tracker.html();
    assert.match(html, /держит лицо \d+-й день подряд — трещит/);
    assert.match(html, /дай возможность не держаться/);
    assert.match(mod.prompt('normal'), /слишком долго держит лицо/);
    next([{ who: 'Баки', by: 'Хеди', open: 3, why: 'наконец рассказал ей' }]);
    assert.equal(live().role, 0);
});

test('0.5: погода дома — свои на нервах, и ему тяжелее', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    world.scene.characters_present = ['Баки Барнс', 'Наташа Романофф'];
    await fresh(4600);
    st.md.brain.who[N].strain = 85;
    assert.match(st.shelf.tracker.html(), /дома тяжело: Наташа на нервах/);
    const calm = live().strain;
    hour(4612); next();
    assert.ok(live().strain > calm, 'за полдня рядом с этим у него тоже накопилось');
    st.md.brain.who[N].strain = 10;
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
});

test('0.5: юмор — каким шутит, решает состояние', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    await fresh(4700);
    next([{ who: 'Баки', fun: 3, warm: 2, why: 'она его рассмешила' }]);
    assert.equal(brain.view(B).wit, 'aff');
    assert.match(mod.prompt('normal'), /если шутит — тепло и на двоих/);
});

test('0.5: механизмы выключаются по одному', async () => {
    st.rel['баки>хеди'] = { ...LOVE };
    assert.match(st.shelf.tracker.html(), /Механизмы/);
    change({ bin: 'm', k: 'lens' }, '', { checked: false });
    assert.equal(st.ext.brain.mech.lens, false);
    await fresh(4800);
    next([{ who: 'Баки', by: 'Хеди', blow: 2, why: 'резкое слово' }]);
    assert.deepEqual(lastLog().tags, [], 'без линзы — как от любого');
    assert.equal(brain.view(B).dear, null);
    change({ bin: 'm', k: 'lens' }, '', { checked: true });
    change({ bin: 'm', k: 'wit' }, '', { checked: false });
    assert.equal(brain.view(B).wit, '');
    change({ bin: 'm', k: 'wit' }, '', { checked: true });
    delete st.rel['баки>хеди'];
});

// ───── 0.6: поправки по исследованиям и заполнение по всей истории ─────

test('0.6: темперамент по всей истории — свод в запрос, умная модель, пережитое ложится в память', async () => {
    await fresh(5000);
    assert.match(st.shelf.tracker.html(), /Свод всей истории ещё не собран/);
    st.story = { felt: [{ day: '2024-11-20', mes: 3, t: 'она сказала да', emo: 'tender', w: 3 }, { day: '2024-11-25', mes: 9, t: 'увидел запись ГИДРЫ', emo: 'shame', w: 3 }, { day: '2024-11-26', mes: 12, t: 'она уехала на день', emo: 'low', w: 2 }, { day: '2024-11-27', mes: 14, t: 'мелочь', emo: 'low', w: 1 }] };
    assert.match(st.shelf.tracker.html(), /Собрать по всей истории/);
    const before = st.fill.length;
    await click({ bact: 'collect', who: B });
    assert.equal(st.fill.length, before + 1, 'пошло через большое заполнение');
    const f = st.fill[st.fill.length - 1];
    assert.equal(f.opts.who, B);
    assert.ok(f.tokens >= 7000);
    assert.match(f.messages[0].content, /Свод всей истории/);
    assert.equal(st.ext.brain.prof[B].story, true);
    assert.match(st.shelf.tracker.html(), /собран по всей истории, карточке и лорбуку/);
    const marks = live().marks.map(m => m.t);
    assert.ok(marks.includes('она сказала да') && marks.includes('увидел запись ГИДРЫ') && marks.includes('она уехала на день'));
    assert.ok(!marks.includes('мелочь'));
    assert.equal(live().filled, true);
    await click({ bact: 'collect', who: B });
    assert.equal(live().marks.filter(m => m.t === 'она сказала да').length, 1, 'повторный сбор меток не плодит');
    st.story = null;
});

test('0.6: тайна давит фоном, мысли по кругу не дают напряжению спасть', async () => {
    await fresh(5100);
    const calm = brain.view(B).E.val;
    st.kept['баки'] = { n: 3, list: [] };
    assert.ok(brain.view(B).E.val <= calm - 4, 'три тайны — фон темнее');
    st.kept['баки'] = { n: 0, list: [] };
    next([{ who: 'Баки', blow: 3, why: 'увидел своё досье' }]);
    next([{ who: 'Баки', blow: 3, why: 'и ещё одно' }]);
    assert.ok(!/мысли ходят по кругу/.test(st.shelf.tracker.html()), 'сразу — ещё не залип');
    hour(5107); next([{ who: 'Баки', blow: 2, why: 'снова об этом' }]);
    assert.match(st.shelf.tracker.html(), /мысли ходят по кругу — не отпускает/);
    assert.ok(brain.view(B).combo.includes('loop'));
});

test('0.6: заражение зависит от того, что между ними', async () => {
    const N = 'Наташа Романофф';
    const run = async (rel, h) => {
        st.rel['наташа>баки'] = rel;
        world.scene.characters_present = ['Баки Барнс', 'Наташа Романофф'];
        await fresh(h);
        st.md.brain.who[N] = undefined;
        next();
        const a0 = st.md.brain.who[N].fast.aro;
        next([{ who: 'Баки', threat: 3, bound: 3, why: 'тревога, двери заблокированы' }]);
        return st.md.brain.who[N].fast.aro - a0;
    };
    const plain = await run({ closeness: 90 }, 5200);
    const haven = await run({ closeness: 100, trust: 95, love: 80, tension: 5 }, 5300);
    const sour = await run({ closeness: 90, trust: 60, tension: 95 }, 5400);
    assert.ok(haven < plain && plain < sour, `в ладу ${haven} < обычно ${plain} < накопилось ${sour}`);
    delete st.rel['наташа>баки'];
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
});

// ───── 0.7: космическая привязанность, обида, отклик на сильное ─────

test('0.7: «свои» — круг заполняется сам, в Life им запираются любовь и близость', async () => {
    delete st.md.brain.circle;
    st.pins = {};
    await fresh(6000);
    assert.match(st.shelf.tracker.html(), /Свои[\s\S]*Хеди, Баки, Наташа, Тони, Елена/);
    assert.deepEqual(st.md.brain.circle, ['Хеди', 'Баки', 'Наташа', 'Тони', 'Елена']);
    change({ bin: 'circle' }, 'Хеди\nБаки', { tagName: 'TEXTAREA' });
    assert.deepEqual(st.md.brain.circle, ['Хеди', 'Баки']);
    assert.deepEqual(Object.keys(st.pins).sort(), ['баки>хеди', 'хеди>баки']);
    assert.deepEqual(st.pins['баки>хеди'], { love: 100, closeness: 100 });
    assert.equal(brain.view(B).dear.cosmic, true, 'и без единой шкалы в Life');
    assert.match(st.shelf.tracker.html(), /космическая/);
});

test('0.7: предательство своего — больно, сказано в лицо или взято на себя, но ничего не меняет', async () => {
    await fresh(6100);
    next([{ who: 'Баки', by: 'Хеди', wrong: 3, why: 'она выбросила ключи, чтобы заставить его' }]);
    const e = lastLog();
    assert.ok(e.tags.includes('forgive'));
    assert.ok(Math.abs(e.d.val) >= 25, `больно по-настоящему: ${e.d.val}`);
    assert.equal(live().hurtBy.kind, 'stay');
    assert.equal(live().grudge?.['Хеди Барлоу'], undefined, 'обиды на своего нет');
    assert.ok(brain.view(B).combo.includes('stay'));
    assert.match(mod.prompt('normal'), /ничего не меняет|никуда не уходит/);
    const html = st.shelf.tracker.html();
    assert.match(html, /больно, но ничего не меняет/);
    assert.match(html, /для тебя сделает всё то же/);
});

test('0.7: другу предательство не прощают — остаётся обида, пока тот не сделает шаг', async () => {
    const N = 'Наташа Романофф';
    st.rel['баки>наташа'] = { trust: 85, closeness: 85 };
    await fresh(6200);
    next([{ who: 'Баки', by: 'Наташа', wrong: 3, why: 'сдала его местоположение Россу' }]);
    assert.ok(lastLog().tags.includes('grudge'));
    assert.equal(live().grudge[N], 100);
    assert.ok(brain.view(B).combo.includes('grudge'));
    assert.match(mod.prompt('normal'), /держит обиду \(Наташа\)/);
    assert.match(st.shelf.tracker.html(), /обида \(Наташа\): 100/);
    // пока обида держится, её тепло не греет, а колкость не размывается
    hour(6201); next([{ who: 'Баки', by: 'Наташа', blow: 1, why: 'пошутила про это' }]);
    assert.ok(lastLog().tags.includes('cold'));
    hour(6202); next([{ who: 'Баки', by: 'Наташа', open: 3, why: 'рассказала, зачем это сделала' }]);
    assert.ok(live().grudge[N] < 60);
    hour(6202 + 24 * 14); next();
    assert.equal(live().grudge?.[N], undefined, 'за две недели сошла');
    delete st.rel['баки>наташа'];
});

test('0.7: отклик на сильное — реакция, развилка, решение; потом пропадает', async () => {
    await fresh(6700);
    next([{ who: 'Баки', blow: 3, why: 'при всех назвали убийцей' }]);
    assert.match(mod.prompt('normal'), /сначала тело и чувство, потом жест или движение и только потом слова/);
    assert.equal(brain.view(B).seq, 0);
    next();
    assert.match(mod.prompt('normal'), /развилка: хорошего выхода нет/);
    next();
    assert.match(mod.prompt('normal'), /сам выбирает, что делать дальше/);
    next();
    assert.ok(!/после сильного|только что случилось сильное/.test(mod.prompt('normal')));
    // хорошее сильное отклик не открывает; выключатель работает
    await fresh(6800);
    next([{ who: 'Баки', warm: 3, why: 'она сказала да' }]);
    assert.equal(live().seq ?? null, null);
    change({ bin: 'm', k: 'seq' }, '', { checked: false });
    next([{ who: 'Баки', blow: 3, why: 'снова' }]);
    assert.ok(!/только что случилось сильное/.test(mod.prompt('normal')));
    change({ bin: 'm', k: 'seq' }, '', { checked: true });
});

test('0.7: тёмная сторона — за своего на что угодно', async () => {
    await fresh(6900);
    st.stones = { who: 'Хеди Барлоу', mode: 'attack' };
    next();
    assert.ok(brain.view(B).combo.includes('reckless'));
    assert.match(mod.prompt('normal'), /нарушит собственные правила/);
    assert.match(st.shelf.tracker.html(), /опаснее всего для самого себя/);
    st.stones = null;
    st.md.brain.circle = [];
});

// ───────────── 0.8: как привязывается, тропы пар, стержень, алкоголь ─────────────

const setStyle = (id, who = B) => change({ bin: 'ts', k: 'attach', who }, id, { tagName: 'SELECT' });
const mechSet = (k, v) => change({ bin: 'm', k }, '', { checked: v });
/** Три ответа подряд в тихой сцене: что за них ушло модели. */
const three = () => { const out = []; for (let k = 0; k < 3; k++) { out.push(mod.prompt('normal')); next(); } return out; };
const count = (rows, re) => rows.filter(x => re.test(x)).length;

test('0.8: Летописцу — «пил»', () => {
    assert.match(mod.chron().rule, /в ЭТОМ посте пил спиртное[\s\S]*"drink": 1 \(глоток, бокал-другой\)/);
});

test('0.8: алкоголь — пьянеет по стадиям, играет под градусом, наутро похмелье', async () => {
    await fresh(8000);
    assert.equal(brain.view(B).drunk, 0);
    next([{ who: 'Баки', drink: 2 }]);
    assert.equal(brain.view(B).drunk, 1);
    assert.match(mod.prompt('normal'), /навеселе: говорит свободнее/);
    next([{ who: 'Баки', drink: 3, fun: 1, why: 'пьют с ней на кухне' }]);
    assert.equal(brain.view(B).drunk, 3);
    assert.match(lastLog('drink').why, /спиртное: много — сильное опьянение/);
    assert.match(mod.prompt('normal'), /сильное опьянение: язык заплетается/);
    assert.match(st.shelf.tracker.html(), /🥃 Сильное опьянение/);
    assert.match(st.shelf.tracker.html(), /завтра не вспомнит/);
    // утро: алкоголь ушёл — пришло похмелье
    hour(8010);
    const v = brain.view(B);
    assert.equal(v.drunk, 0);
    assert.equal(v.hung, 2);
    const p = mod.prompt('normal');
    assert.match(p, /тяжёлое похмелье: мутит/);
    assert.match(p, /помнит кусками/);
    next();
    assert.match(lastLog('drink').why, /тяжёлое похмелье/);
    const html = st.shelf.tracker.html();
    assert.match(html, /🤕 Тяжёлое похмелье/);
    assert.match(html, /с похмелья: тише, вода/);
    assert.match(html, /может спросить, что говорил и делал/);
    hour(8040);
    assert.equal(brain.view(B).hung, 0, 'к следующему дню прошло');
    assert.equal(mod.prompt('normal'), '');
});

test('0.8: близорукость — под градусом то же событие крупнее; сильное — на том же потолке', async () => {
    await fresh(8100);
    next([{ who: 'Баки', warm: 2, why: 'обняла' }]);
    const dry = lastLog().d.val;
    await fresh(8200);
    next([{ who: 'Баки', drink: 3 }]);
    next([{ who: 'Баки', warm: 2, why: 'обняла' }]);
    assert.ok(lastLog().d.val > dry, `${lastLog().d.val} > ${dry}`);
    assert.ok(lastLog().tags.includes('drunk'));
    assert.match(st.shelf.tracker.html(), /спьяну — крупнее/);
    await fresh(8300);
    next([{ who: 'Баки', blow: 3, why: 'унизили при всех' }]);
    const hard = lastLog().d.wor;
    await fresh(8400);
    next([{ who: 'Баки', drink: 3 }]);
    next([{ who: 'Баки', blow: 3, why: 'унизили при всех' }]);
    assert.equal(lastLog().d.wor, hard, 'поручень: сильное событие алкоголь не раздувает');
});

test('0.8: суперсолдата почти не берёт; руками — налить и протрезвить', async () => {
    change({ bin: 't', k: 'booze', who: B }, '4');
    await fresh(8500);
    next([{ who: 'Баки', drink: 3 }]);
    assert.equal(brain.view(B).drunk, 0);
    assert.match(lastLog('drink').why, /почти не берёт/);
    change({ bin: 't', k: 'booze', who: B }, '1');
    await fresh(8550);
    await click({ bact: 'drink', who: B });
    assert.equal(brain.view(B).drunk, 1);
    assert.match(st.shelf.tracker.html(), /протрезвить/);
    await click({ bact: 'sober', who: B });
    assert.equal(brain.view(B).drunk, 0);
});

test('0.8: алкоголь выключен — как раньше: о спиртном знает только Life', async () => {
    mechSet('booze', false);
    await fresh(8600);
    st.fx['баки'] = [{ what: 'выпил полбутылки виски', left: 1e6 }];
    live().mask = 60; live().will = 30;
    assert.match(mod.prompt('normal'), /под алкоголем/);
    next([{ who: 'Баки', drink: 3 }]);
    assert.equal(brain.view(B).drunk, 0);
    st.fx = {};
    mechSet('booze', true);
});

test('0.8: как привязывается — у каждого свои слова после удара, в ревности и в тихой сцене', async () => {
    st.md.brain.circle = ['Хеди', 'Баки'];
    st.md.brain.pairs = [];
    setStyle('guard');
    await fresh(8700);
    assert.match(st.shelf.tracker.html(), /Привязывается: сторож/);
    assert.equal(brain.view(B).attach, 'guard');
    next([{ who: 'Баки', by: 'Хеди', blow: 3, why: 'она сказала, что он ей в тягость' }]);
    assert.equal(live().hurtBy.kind, 'stay');
    assert.match(mod.prompt('normal'), /принимает как заслуженный и остаётся на посту/);
    setStyle('test');
    await fresh(8800);
    next([{ who: 'Баки', by: 'Хеди', blow: 3, why: 'она сказала, что он ей в тягость' }]);
    assert.match(mod.prompt('normal'), /огрызается и смотрит, уйдут ли теперь/);
    await fresh(8900);
    next([{ who: 'Баки', by: 'Хеди', rival: 3, why: 'она весь вечер смеётся с другим' }]);
    next([{ who: 'Баки', by: 'Хеди', rival: 3, why: 'и уходит с ним танцевать' }]);
    assert.ok(brain.view(B).combo.includes('jealous'));
    assert.match(mod.prompt('normal'), /ревнует вслух и с издёвкой/);
    // цифры пары у каждого способа свои
    await fresh(9000);
    setStyle('fuse');
    const fuse = brain.view(B).dear;
    setStyle('armor');
    const armor = brain.view(B).dear;
    assert.ok(fuse.fuse > armor.fuse && fuse.haven > armor.haven, JSON.stringify([fuse, armor]));
    // тихая сцена: его манера быть рядом — раз в три ответа, не чаще
    setStyle('guard');
    await fresh(9100);
    const rows = three();
    assert.equal(count(rows, /привязанность выражает охраной и делом/), 1, rows.join('\n'));
    assert.equal(count(rows, /Баки — постоянное, не событие \(держи в поведении/), 1, 'в остальные два ответа модели ничего не уходит');
    assert.equal(count(rows, /что внутри сейчас/), 0);
    mechSet('style', false);
    assert.equal(count(three(), /охраной и делом/), 0);
    assert.equal(brain.view(B).attach, '');
    mechSet('style', true);
    setStyle('');
    st.md.brain.circle = [];
});

test('0.8: троп пары — сеется с кругом, виден в листе, под давлением показывает тёмную сторону', async () => {
    delete st.md.brain.circle;
    delete st.md.brain.pairs;
    st.pins = {};
    await fresh(9200);
    const html = st.shelf.tracker.html();
    assert.match(html, /<option value="hybrid" selected>Доктор и Клара<\/option>/);
    assert.match(html, /<option value="yes" selected>романтика<\/option>/);
    assert.match(html, /Под давлением: вдвоём безрассуднее/);
    assert.equal(st.md.brain.pairs.length, 9);
    assert.equal(brain.view(B).dear.trope, 'hybrid');
    const rows = three();
    assert.equal(count(rows, /с Хеди — равные, которые отражают друг друга[\s\S]*это любовь, и оба это знают/), 1, rows.join('\n'));
    assert.equal(count(rows, /под давлением/), 0);
    // у этих двоих своё задевает сильнее
    next([{ who: 'Баки', by: 'Хеди', fun: 2, why: 'подбила на глупость' }]);
    assert.ok(lastLog().tags.includes('trope'));
    next([{ who: 'Баки', threat: 3, why: 'засада на трассе' }]);
    assert.match(mod.prompt('normal'), /что внутри сейчас[\s\S]*с Хеди — равные[\s\S]*под давлением вылезает другое: вдвоём безрассуднее/);
    // правится в листе
    change({ bin: 'tr', who: B, to: 'Хеди Барлоу' }, 'kin', { tagName: 'SELECT' });
    change({ bin: 'rom', who: B, to: 'Хеди Барлоу' }, 'hint', { tagName: 'SELECT' });
    assert.deepEqual(st.md.brain.pairs.find(x => x.a === 'Хеди' && x.b === 'Баки'), { a: 'Хеди', b: 'Баки', id: 'kin', rom: 'hint' });
    assert.match(mod.prompt('normal'), /с Хеди — родные, которые навёрстывают[\s\S]*вслух этого нет/);
    change({ bin: 'tr', who: B, to: 'Хеди Барлоу' }, '', { tagName: 'SELECT' });
    assert.equal(st.md.brain.pairs.length, 8);
    assert.ok(!/с Хеди —/.test(mod.prompt('normal')));
    st.md.brain.circle = [];
    st.md.brain.pairs = [];
});

test('0.8: стержень — в тихой сцене чем живёт, на развилке «хочу» против «нужно»', async () => {
    const sp = (k, v) => change({ bin: 'sp', k, who: B }, v, { tagName: 'TEXTAREA' });
    sp('goal', 'искупить всё, что сделал Солдат');
    sp('need', 'поверить, что любить можно и такого');
    sp('view', 'за всё платят');
    sp('fear', 'снова стать оружием');
    await fresh(9300);
    const rows = three();
    assert.equal(count(rows, /чем живёт: искупить всё, что сделал Солдат/), 1, rows.join('\n'));
    assert.equal(count(rows, /нужно другое/), 0);
    const html = st.shelf.tracker.html();
    assert.match(html, /Стержень[\s\S]*Добивается[\s\S]*На деле нужно[\s\S]*поверить, что любить можно и такого/);
    assert.match(html, /главный страх: снова стать оружием/);
    assert.deepEqual(brain.view(B).spine.goal, 'искупить всё, что сделал Солдат');
    // сильное плохое: реакция → развилка (его ответ прошёл) — тут и видно, из чего он выбирает
    next([{ who: 'Баки', bound: 2, why: 'его отстранили от дела' }], N);
    assert.ok(!/решает из своего/.test(mod.prompt('normal')));
    await fresh(9400);
    next([{ who: 'Баки', wrong: 3, why: 'его подставили свои же' }], N);
    next();
    const p = mod.prompt('normal');
    assert.match(p, /развилка/);
    assert.match(p, /решает из своего «хочу»: искупить[\s\S]*на деле нужно другое: поверить[\s\S]*пока не видит[\s\S]*больше всего боится: снова стать оружием/);
    assert.ok(!/читает через своё/.test(p), 'мировоззрение — когда прижало, а не на развилке');
    // убеждение, из которого росло «хочу», сломалось — теперь может выбрать то, что нужно
    live().belBroke = { id: 'нет такого', mes: lastIndex() };
    assert.match(mod.prompt('normal'), /теперь видит это и впервые может выбрать второе, даже ценой первого/);
    live().belBroke = null;
    mechSet('spine', false);
    assert.ok(!/решает из своего/.test(mod.prompt('normal')));
    assert.equal(brain.view(B).spine, null);
    mechSet('spine', true);
    for (const k of ['goal', 'need', 'view', 'fear']) sp(k, '');
});

test('0.8: известным — способ по умолчанию; сбор приносит стержень; у собранных раньше дособирается только новое', async () => {
    const prof = () => st.ext.brain.prof[B];
    Object.assign(prof(), { attach: '', reject: 1, booze: 1, seeded: undefined, v: 0 });
    Object.assign(st.ext.brain.prof[N] || (st.ext.brain.prof[N] = {}), { attach: '', seeded: undefined });
    await brain.ensure();
    assert.equal(prof().attach, 'guard');
    assert.equal(prof().reject, 1.4);
    assert.equal(prof().booze, 2.5, 'суперсолдат: берёт хуже и отпускает быстрее, но берёт');
    assert.equal(st.ext.brain.prof[N].attach, 'armor');
    setStyle('fix');
    await brain.ensure();
    assert.equal(prof().attach, 'fix', 'поправленное руками по умолчанию не затирается');
    // полный сбор
    st.depth = { attach: 'сторож', reject: 1.7, booze: 2, spine: { goal: 'искупить', need: 'поверить, что его можно любить', view: 'за всё платят', fear: 'снова стать оружием', face: 'надёжным' }, drunk: 'почти не пьянеет: только взгляд теплеет и плечи опускаются' };
    Object.assign(prof(), { attach: '', seeded: undefined, v: 0, spine: {} });
    await click({ bact: 'collect', who: B });
    assert.equal(prof().attach, 'guard', 'название способа читается');
    assert.equal(prof().reject, 1.7);
    assert.equal(prof().spine.need, 'поверить, что его можно любить');
    assert.match(prof().cass.drunk, /почти не пьянеет/);
    assert.equal(prof().v, 8);
    assert.match(st.fill.length ? st.fill[st.fill.length - 1].messages[0].content : mod.chron().rule, /./);
    // собран до 0.8 и поправлен руками: дособрать только новое
    const shame = JSON.stringify(prof().cass.shame);
    Object.assign(prof(), { attach: '', v: 0, spine: {}, src: 'hand', react: 1.3 });
    delete prof().cass.drunk;
    st.ext.brain.auto = true;
    st.ext.brain.tried = {};
    await brain.ensure();
    assert.equal(prof().attach, 'guard');
    assert.equal(prof().spine.goal, 'искупить');
    assert.match(prof().cass.drunk, /почти не пьянеет/);
    assert.equal(prof().src, 'hand');
    assert.equal(prof().react, 1.3, 'остальное не тронуто');
    assert.equal(JSON.stringify(prof().cass.shame), shame);
    assert.equal(prof().v, 8);
    const asked = st.asked;
    await brain.ensure();
    assert.equal(st.asked, asked, 'второй раз не спрашивает');
    st.ext.brain.auto = false;
    st.depth = null;
});

// ───────────── 0.8.2: тихая минута; выпитое у персонажа игрока ─────────────

test('0.8.2: подначки — не всегда: в тихую минуту у пары тишина, в игривую — подколки, в обычную модели не диктуем', async () => {
    delete st.md.brain.circle;
    delete st.md.brain.pairs;
    st.pins = {};
    setStyle('guard');
    // день, ровно: ядро тропа и обычная манера быть рядом
    await fresh(9600);
    let rows = three();
    assert.equal(count(rows, /с Хеди — равные/), 1, rows.join('\n'));
    assert.equal(count(rows, /сейчас —/), 0);
    assert.equal(count(rows, /привязанность выражает охраной и делом/), 1);
    // поздний вечер: тишина вдвоём, без единой подколки
    await fresh(9613);
    rows = three();
    assert.equal(count(rows, /с Хеди — равные[\s\S]*сейчас — им хватает тишины вдвоём[\s\S]*нежность без единой подначки/), 1, rows.join('\n'));
    assert.equal(count(rows, /пост сдаёт: плечи опускаются/), 1);
    assert.equal(count(rows, /на риск|охраной и делом/), 0);
    // нежность днём — тоже тихая минута
    await fresh(9624);
    next([{ who: 'Баки', by: 'Хеди', warm: 3, why: 'сказала, что с ним она дома' }]);
    assert.equal(brain.view(B).emo.id, 'tender');
    rows = three();
    assert.equal(count(rows, /сейчас — им хватает тишины вдвоём/), 1, rows.join('\n'));
    // азарт — тогда и подначки
    await fresh(9648);
    next([{ who: 'Баки', by: 'Хеди', fun: 3, why: 'затеяла гонку по пустой трассе' }]);
    assert.equal(brain.view(B).emo.id, 'playful');
    rows = three();
    assert.equal(count(rows, /сейчас — подначивают друг друга на риск/), 1, rows.join('\n'));
    setStyle('');
    st.md.brain.circle = [];
    st.md.brain.pairs = [];
});

test('0.8.2: персонаж игрока — мозг считает только выпитое; ботам — что видно, игроку — подсказка', async () => {
    st.md.brain.circle = ['Хеди', 'Баки'];
    st.md.brain.pairs = [];
    delete st.md.brain.me;
    await fresh(9700);
    assert.deepEqual(brain.me(), { drunk: 0, hung: 0 });
    assert.ok(!/персонаж игрока/.test(mod.prompt('normal')));
    const i = next([{ who: 'Хеди', drink: 3 }]);
    assert.deepEqual(brain.me(), { drunk: 2, hung: 0 });
    assert.equal(st.md.brain.who['Хеди Барлоу'], undefined, 'психики у персонажа игрока нет');
    const p = mod.prompt('normal');
    assert.match(p, /\[Хеди, персонаж игрока, — под градусом; со стороны видно: движения шире[\s\S]*решает игрок, за игрока не пиши/);
    assert.match(p, /Хеди под градусом — присматривает по-своему: /, 'близкий присматривает своей кассетой');
    const html = st.shelf.tracker.html();
    assert.match(html, /🥃 Хеди: под градусом/);
    assert.match(html, /Подсказка\.[\s\S]*выветрится примерно за 6 ч истории; наутро — похмелье, на полдня/);
    assert.match(html, /Как Хеди себя ведёт — решаешь ты/);
    // свайп того же ответа выпитое не удваивает
    const bac = st.md.brain.me.bac;
    mod.afterPost(i, { psy: [{ who: 'Хеди', drink: 3 }] }, chat[i]);
    assert.equal(st.md.brain.me.bac, bac);
    // тот же бокал в следующем посте — не новая порция целиком
    next([{ who: 'Хеди', drink: 1 }]);
    assert.ok(st.md.brain.me.bac - bac < 8, `${st.md.brain.me.bac} − ${bac}`);
    // её нет в сцене — строки нет
    world.scene.characters_present = ['Баки Барнс', 'Наташа Романофф'];
    assert.ok(!/персонаж игрока/.test(mod.prompt('normal')));
    world.scene.characters_present = ['Баки Барнс', 'Хеди Барлоу'];
    // утро
    hour(9709);
    assert.deepEqual(brain.me(), { drunk: 0, hung: 1 });
    const m = mod.prompt('normal');
    assert.match(m, /\[Хеди, персонаж игрока, — с похмелья; со стороны видно: бледность/);
    assert.match(m, /Хеди с похмелья — присматривает по-своему: /);
    assert.match(st.shelf.tracker.html(), /🤕 Хеди: с похмелья[\s\S]*Похмелье ещё ~\d+ ч истории/);
    await click({ bact: 'me-sober' });
    assert.deepEqual(brain.me(), { drunk: 0, hung: 0 });
    assert.ok(!/персонаж игрока|присматривает по-своему/.test(mod.prompt('normal')));
    await click({ bact: 'me-drink' });
    assert.equal(brain.me().drunk, 1);
    await click({ bact: 'me-sober' });
    // «как берёт» — её ползунок в настройках мозга
    change({ bin: 'me', k: 'booze' }, '4');
    next([{ who: 'Хеди', drink: 3 }]);
    assert.equal(brain.me().drunk, 0);
    change({ bin: 'me', k: 'booze' }, '1');
    await click({ bact: 'me-sober' });
    // выключатель «Алкоголь» гасит и это
    next([{ who: 'Хеди', drink: 3 }]);
    assert.equal(brain.me().drunk, 2);
    mechSet('booze', false);
    assert.deepEqual(brain.me(), { drunk: 0, hung: 0 });
    assert.ok(!/персонаж игрока/.test(mod.prompt('normal')));
    mechSet('booze', true);
    delete st.md.brain.me;
    st.md.brain.circle = [];
});
