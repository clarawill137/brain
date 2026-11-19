// Проверка стыковки с Life на макете моста: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';

const first = (n) => String(n || '').trim().split(/\s+/)[0].toLowerCase();
const world = { timestamp: { story_date: '2024-12-01', story_time: '10:00' }, scene: { characters_present: ['Баки Барнс', 'Хеди Барлоу'] } };
const chat = [];
const post = (name, user = false) => { chat.push({ name, is_user: user, is_system: false, mes: '…', horae_meta: { timestamp: { ...world.timestamp } } }); return chat.length - 1; };
const handlers = {};
const st = { ext: { brain: { auto: false } }, md: {}, toasts: [], inner: {}, hurt: {}, sleep: {}, stones: null, trig: {}, shelf: {}, asked: 0 };

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
    relOf: () => ({ closeness: 90 }),
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
        return { note: 'Держится ровно, вину носит молча.', base: { val: -5, aro: 5, ctl: 28, wor: -18 }, react: 0.9, recover: 0.7, grit: 1.5, sens: { blow: 1.4, bound: 1.5, threat: 0.7, warm: 0.8, wrong: 1, loss: 1.2 },
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
    },
    lore: { about: async () => 'Лор о нём.', card: () => 'Карточка.', core: () => '• говорит коротко', key: (w) => String(w).trim() },
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
    assert.ok(!/Хеди|Рассказчик/.test(c.input));
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
