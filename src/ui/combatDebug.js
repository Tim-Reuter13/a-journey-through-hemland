import * as THREE from 'three';
import { injuryEffects } from '../systems/damageModel.js';
import { readMemory } from '../systems/ai/combatMemory.js';

// Combat 2.0 debug view (F7): per fighter what they want, what they are doing and why, their body (stamina,
// posture, injuries, fear), the last combat events with their reasons — and in the world the simulated blades
// (red: active, amber: wind-up/recovery) with a short trail, so a hit or a miss can be checked by eye.
const MAX = 900;
export function createCombatDebug({ scene, melee, enemies, player }) {
  const panel = Object.assign(document.createElement('div'), { id: 'combat-debug', hidden: true });
  document.body.append(panel);
  const geometry = new THREE.BufferGeometry(), positions = new Float32Array(MAX * 3), colors = new Float32Array(MAX * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
  lines.frustumCulled = false; lines.renderOrder = 999; lines.visible = false; scene.add(lines);
  const trail = [];
  let on = false, textAt = 0;
  const RED = new THREE.Color(0xff3030), AMBER = new THREE.Color(0xffb020), CYAN = new THREE.Color(0x40e0ff);
  function toggle() { on = !on; panel.hidden = !on; lines.visible = on; return on; }
  const pct = v => `${Math.round(v * 100)}%`;
  const injuries = inj => inj ? Object.entries(inj).filter(([, v]) => v > .05).map(([k, v]) => `${k.replace('_', ' ')} ${pct(v)}`).join(', ') || '—' : '—';
  function fighterLine(name, f, extra) {
    const a = f?.attack;
    return `${name}${extra}\n   Angriff ${a ? `${a.key} · ${a.phase} ${a.u !== undefined ? pct(a.u) : ''}${a.charge ? ` · Kraft ${pct(Math.min(1, a.charge / .45))}` : ''}` : '—'}`
      + ` · Haltung ${pct(f?.posture ?? 1)}${f?.broken > 0 ? ' GEBROCHEN' : ''}${f?.stagger > 0 ? ` · taumelt ${f.stagger.toFixed(1)} s` : ''}`
      + (f?.last ? `\n   zuletzt: ${f.last.key} → ${f.last.reason}` : '') + (f?.log?.length ? `\n   ${f.log.slice(-3).join('\n   ')}` : '');
  }
  function update(dt, time) {
    if (!on) return;
    // Blades now, and where they were a moment ago.
    for (const who of ['player', ...enemies.filter(e => !e.dead && e.fight?.attack && e.model.position.distanceTo(player.position) < 30)]) {
      const b = melee.bladeOf(who); if (!b) continue;
      trail.push({ a: b.hilt, b: b.tip, color: b.attack.phase === 'active' ? RED : AMBER, at: time });
    }
    while (trail.length && (time - trail[0].at > .7 || trail.length > MAX / 2 - 40)) trail.shift();
    let n = 0;
    const put = (p, c, k = 1) => { positions[n * 3] = p.x; positions[n * 3 + 1] = p.y; positions[n * 3 + 2] = p.z; colors[n * 3] = c.r * k; colors[n * 3 + 1] = c.g * k; colors[n * 3 + 2] = c.b * k; n++; };
    for (const s of trail) { const k = .25 + .75 * Math.max(0, 1 - (time - s.at) / .7); put(s.a, s.color, k); put(s.b, s.color, k); }
    // Facing of each fighter (cyan): which way a guard covers.
    for (const e of enemies) {
      if (e.dead || n > MAX - 4 || e.model.position.distanceTo(player.position) > 20) continue;
      const p = e.model.position, y = e.model.rotation.y;
      put(new THREE.Vector3(p.x, p.y + .1, p.z), CYAN, .7); put(new THREE.Vector3(p.x - Math.sin(y) * 1.2, p.y + .1, p.z - Math.cos(y) * 1.2), CYAN, .7);
    }
    geometry.setDrawRange(0, n); geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
    if ((textAt -= dt) > 0) return; textAt = .25;
    const out = [`COMBAT 2.0 · F7 · Zeit ${time.toFixed(1)} s`];
    const pf = melee.player;
    out.push(fighterLine('WANDERER', pf, ` · Ausdauer ${Math.round(player.stamina)} · Deckung ${pf.guard ? `oben seit ${(time - pf.guardAt).toFixed(2)} s` : 'unten'} · Wunden ${injuries(melee.injuryOf?.('player'))}`));
    for (const e of enemies) {
      if (e.dead || e.gone || !e.ai || e.model.position.distanceTo(player.position) > 22) continue;
      const b = e.ai, inj = melee.injuryOf?.(e), fx = injuryEffects(inj || {}), mem = b.combat ? readMemory(b.combat, time) : null, t = e.tactic;
      out.push(fighterLine(`${b.id} (${b.personality.label}, Können ${pct(b.personality.skill)})`, e.fight,
        ` · ${b.hostility} · Handlung ${b.action.id} (${b.action.reason})`
        + `\n   Motivation: Angst ${pct(b.emotion.fear)} · Mut ${pct(b.emotion.confidence)} · Zorn ${pct(b.emotion.anger)} · Schmerz ${pct(b.emotion.pain)} · HP ${Math.round(e.hp)}/${e.maxHp}`
        + `\n   Taktik: ${t ? `${t.id} (${t.reason}) noch ${Math.max(0, t.until - time).toFixed(1)} s${t.aborted ? ` · abgebrochen: ${t.aborted}` : ''}` : '—'} · Ziel ${b.intent.goal ? `${b.intent.goal.distanceTo?.(e.model.position)?.toFixed(1)} m` : '—'}`
        + ` · Ausdauer ${Math.round(b.stamina)} · Deckung ${e.blocking > 0 ? 'oben' : 'unten'}`
        + `\n   Körper: Wunden ${injuries(inj)} · Tempo ${pct(fx.move)} · Schlag ${pct(fx.attack)}`
        + (mem ? `\n   Gedächtnis (Sicherheit ${pct(mem.certainty)}): Angriffe/10s ${mem.rate.toFixed(1)} · pariert ${pct(mem.parry)} · blockt ${pct(mem.block)} · verfehlt ${pct(mem.whiff)} · schwer ${pct(mem.heavy)} · Deckung ${pct(mem.guarding)}` : '')));
    }
    out.push('— Ereignisse —', ...melee.events.recent(10).map(v => `${v.at?.toFixed?.(1) ?? ''} ${v.type} ${v.by ?? ''}${v.on ? '→' + v.on : ''}${v.of ? ' (' + v.of + ')' : ''}${v.key ? ' ' + v.key : ''}${v.outcome ? ' ' + v.outcome : ''}${v.region ? ' @' + v.region : ''}${v.why ? ' · ' + v.why : ''}${v.damage !== undefined ? ' · ' + v.damage + ' Schaden' : ''}`));
    panel.textContent = out.join('\n');
  }
  return { toggle, update, get on() { return on; } };
}
