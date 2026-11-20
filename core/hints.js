// Код-мозг — подсказки игроку. Не для модели: это шпаргалка тебе, как с человеком сейчас обращаться —
// что сработает, что добьёт и чего ждать. Собирается из того же состояния, что и заметка модели.
// Чистая функция: без Таверны, Life и DOM. Тексты без рода — подходят любому персонажу.

import { willBand, beliefHp, rawNerves, nightChance } from './psyche.js';
import { hungriest } from './drives.js';

const BY_EMO = {
    fear: 'страх: верни контроль — дай выбор или простую задачу, говори ровно и коротко',
    anger: 'злость: не дожимай — дай уйти и вернуться; спорь по делу, не по личности',
    shame: 'стыд: слова отскакивают — показывай делом; похвала сейчас оседает вполсилы',
    low: 'тоска: просто будь рядом, без вопросов и «взбодрись»',
};
const BY_DRIVE = {
    bond: 'не хватает близости: касание, сесть рядом, остаться ещё на минуту',
    safe: 'не хватает безопасности: тише, без резкого, замки проверены, никто не подойдёт со спины',
    free: 'тесно: предложи выбор вместо готового решения, спроси, а не скажи',
    need: 'хочется быть нужным: попроси о помощи, дай дело для рук',
    quiet: 'людей слишком много: уведи туда, где тихо',
    novel: 'рутина давит: позови куда-нибудь, затей что-то новое',
};
const SORE = { warm: '', threat: 'угроза', blow: 'удары по самооценке', bound: 'потеря контроля', wrong: 'несправедливость и ложь', loss: 'разлука и отвержение' };

/**
 * v: { s, t, dom, leak, fore: { breakIn, rawIn, calmIn }, apart } → { help: [], hurt: [], expect: [] }
 * apart — он сейчас не рядом с героиней игрока.
 */
export function hints(v) {
    const { s, t, dom } = v;
    const help = [], hurt = [], expect = [];
    const neg = ['fear', 'anger', 'shame', 'low'].includes(dom?.id);
    const band = willBand(s.will);

    if (s.brk) expect.push('срыв в следующем ответе — словами его не остановить, нужны время и безопасность');
    if (neg && BY_EMO[dom.id]) help.push(BY_EMO[dom.id]);
    if (neg && t.fix?.length) help.push(`возвращает в себя: ${t.fix.slice(0, 4).join(', ')}`);
    if (v.leak >= 1) help.push('носит в себе несказанное: спроси прямо — сейчас может ответить');
    const hungry = hungriest(s);
    if (hungry && hungry.band <= 2 && hungry.v < 45) help.push(BY_DRIVE[hungry.id]);
    if (band <= 1) help.push('сил мало: не требуй решений и разговоров «о главном» прямо сейчас');
    const shaky = (t.beliefs || []).map(b => [b, beliefHp(s, b.id)]).filter(([, hp]) => hp > 0 && hp <= 40).sort((a, b) => a[1] - b[1])[0];
    if (shaky) help.push(`убеждение «${shaky[0].t}» шатается: ещё несколько поступков — и рухнет`);

    const sore = Object.entries(t.sens || {}).filter(([k, x]) => x >= 1.2 && SORE[k]).sort((a, b) => b[1] - a[1]).map(([k]) => SORE[k]);
    if (sore.length) hurt.push(`больные места: ${sore.slice(0, 3).join(', ')}`);
    if (rawNerves(s)) hurt.push('нервы сырые: любое плохое бьёт сильнее, триггеры — на ступень выше');
    if (s.hang) hurt.push('после срыва: ещё один удар — и сорвётся снова');
    if (neg && s.mood[{ fear: 'ctl', anger: 'val', shame: 'wor', low: 'val' }[dom.id]] <= -16) hurt.push('настроение тяжёлое: от одной хорошей фразы не отпустит — тепло нужно несколько раз подряд');

    const f = v.fore || {};
    const hrs = (h) => (h >= 48 ? `~${Math.round(h / 24)} дн.` : `~${h} ч`);
    if (f.breakIn != null) expect.push(`если ничего не изменится — срыв через ${hrs(f.breakIn)} истории`);
    else if (f.rawIn != null) expect.push(`если ничего не изменится — через ${hrs(f.rawIn)} истории нервы станут сырыми`);
    if (f.calmIn != null && !s.brk) expect.push(`если не подливать — отпустит через ${hrs(f.calmIn)} истории`);
    if (nightChance(s, { trig: false }) >= 0.4) expect.push('ночь, скорее всего, будет плохой');
    if (v.apart && s.dr && s.dr.bond <= 35 && band >= 1) expect.push('скучает: скоро выйдет на связь первым');
    return { help, hurt, expect };
}
