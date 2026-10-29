// Callers supply their seeded random source.
import { BARKS } from './hemland/story.js';

// Ambient lines per job from the Hemland story; lines tied to story flags are left out of the
// always-available pool (they would spoil events that have not happened yet).
export const JOB_BARKS = Object.fromEntries(Object.entries(BARKS).map(([job, lines]) => [job, lines.filter(line => !line.if).map(line => line.text)]));

export const GENERIC_BARKS = {
  greeting: ['Sei gegrüßt.', 'Ah, du bist es.', 'Guten Weg.', 'Grüß dich.'],
  farewell: ['Geh behutsam.', 'Bis später.', 'Ich muss weiter.', 'Wir reden noch.'],
  gossip: ['Die Banditen rücken näher.', 'Am Schrein brennt nachts noch Licht.', 'Die Asche liegt sogar in den Brunnenritzen.', 'Auf der Nordstraße fehlt wieder ein Wagen.', 'Manche beten. Andere verriegeln die Tür.', 'Hast du vom alten Schrein gehört?'],
  morning: ['Schon wieder ein neuer Tag.', 'Erst ein Stück Brot.', 'Das Dorf erwacht.'],
  noon: ['Zeit für eine Pause.', 'Der halbe Tag ist um.', 'Ein Schluck täte gut.'],
  evening: ['Bald werden die Türen verriegelt.', 'Daheim wartet das Essen.', 'Genug geschafft für heute.'],
  night: ['Ich gehöre längst ins Bett.', 'Leiser. Die anderen schlafen.', 'Die Gassen sind still.'],
  weapon: ['Steck die Waffe weg.', 'Hier wird nicht gekämpft.', 'Muss die Klinge wirklich draußen sein?'],
  corpse: ['Bei der Asche ... ein Toter.', 'Bring ihn zum Priester.', 'Was ist hier geschehen?'],
  flee: ['In die Häuser!', 'Wachen! Zu Hilfe!', 'Weg hier!'],
};

export const ACTIVITY_BARKS = {
  idle: ['Einen Moment verschnaufen.', 'Was der Tag noch bringt?'],
  walk: ['Ich muss weiter.', 'Immer denselben Weg.'],
  sit: ['Die Beine werden schwer.', 'Hier sitzt man gut.'],
  eat: ['Endlich etwas Warmes.', 'Mehr brauche ich nicht.'],
  drink: ['Das tut gut.', 'Auf einen ruhigen Abend.'],
  talk: GENERIC_BARKS.gossip,
  work_hammer: ['Noch ein Schlag.', 'Das Eisen muss heiß bleiben.'],
  work_chop: ['Zurücktreten.', 'Sauber gespalten.'],
  work_sweep: ['Der Staub kommt immer wieder.', 'Wenigstens die Schwelle bleibt sauber.'],
  work_farm: ['Noch diese Furche.', 'Wachsen müsst ihr selbst.'],
  work_read: ['Wo war ich stehen geblieben?', 'Das muss ich noch einmal lesen.'],
  work_cook: ['Ein wenig Salz fehlt.', 'Der Topf braucht Zeit.'],
  draw_water: ['Der Eimer wird nicht leichter.', 'Noch ist genug da.'],
  pray: ['Behüte dieses Dorf.', 'Für jene, die nicht heimkehren.'],
  patrol: ['Wieder eine Runde.', 'Ich halte die Augen offen.'],
  lean: ['Nur eine kurze Pause.', 'Der Rücken dankt es mir.'],
};

export function barkLines({ job, activity, hour = 12, kind } = {}) {
  if (kind && GENERIC_BARKS[kind]) return GENERIC_BARKS[kind];
  if (activity === 'sleep') return [];
  const time = hour < 5 || hour >= 22 ? 'night' : hour < 11 ? 'morning' : hour < 17 ? 'noon' : 'evening';
  return [...(JOB_BARKS[job] || []), ...(ACTIVITY_BARKS[activity] || []), ...GENERIC_BARKS[time]];
}

export function pickBark(context, random = Math.random) {
  const lines = barkLines(context);
  return lines[Math.min(lines.length - 1, Math.max(0, Math.floor(random() * lines.length)))] || null;
}
