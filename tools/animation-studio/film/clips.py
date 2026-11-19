"""Mocap clips for the Hemland short film "Die letzte Wacht". Runs animate.py for each missing clip."""
import subprocess
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
CLIPS = [
    ("f_sit_fire", "sits on the floor with his legs crossed, leaning forward and warming his hands over a small fire in front of him, then slowly lifts his head and looks up.", 11),
    ("f_walk_toward", "walks slowly and determinedly straight towards the camera, holding a long sword low in his right hand, the blade pointing at the floor.", 3),
    ("f_standup_draw", "sits on the floor, then quickly gets up onto his feet, grabs a sword lying next to him and takes a wide fighting stance facing the camera.", 5),
    ("f_draw_guard", "stands still facing the camera, slowly draws a long sword from a scabbard at his left hip with his right hand and raises it with both hands into a high guard stance.", 8),
    ("f_circle_guard", "holds a long sword with both hands in a low guard stance, knees bent, and slowly sidesteps to his left in a half circle, watching an opponent in front of him.", 12),
    ("f_block_high", "holds a long sword with both hands and quickly raises it horizontally above his head to block a heavy blow, the impact pushes him back one step, then he lowers the sword again.", 21),
    ("f_slash_side", "steps forward and swings a long sword with both hands in a fast wide horizontal slash from right to left at chest height, then recovers into a guard stance.", 4),
    ("f_dodge_back", "holds a sword and quickly leans and hops backwards to dodge a slash aimed at his chest, then regains his balance in a crouched guard stance.", 6),
    ("f_thrust_lunge", "lunges far forward and thrusts a long sword straight ahead with both hands, then pulls back to his guard stance.", 9),
    ("f_hit_stagger", "is struck hard in the chest, staggers backwards two steps clutching his side, almost falls down on one knee, then pushes himself up again.", 14),
    ("f_death_fall", "is mortally wounded in the stomach, drops his sword, sinks slowly to his knees, sways, then collapses forward onto the floor and lies still.", 17),
    ("f_kneel_mourn", "takes two slow steps forward, then slowly kneels down on one knee and bows his head deeply, resting both hands on the hilt of a sword planted in the floor in front of him.", 2),
    ("f_breathe_guard", "stands exhausted after a fight, breathing heavily with his shoulders rising and falling, a sword hanging from his right hand, then straightens up proudly.", 13),
]

only = set(sys.argv[1:])
for name, action, seed in CLIPS:
    if only and name not in only:
        continue
    if (STUDIO / "library" / name / f"{name}.fbx").exists():
        print("skip", name, flush=True)
        continue
    print("=== clip", name, flush=True)
    r = subprocess.run([sys.executable, "-u", str(STUDIO / "studio/animate.py"), action, "--name", name,
                        "--seed", str(seed), "--no-preview"], cwd=STUDIO)
    print("=== done", name, "exit", r.returncode, flush=True)
