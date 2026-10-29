import dialogueCatalog from '../../scripts/dialogue_catalog.json';

// Spoken dialogue uses validated local Qwen3-TTS files when present.
// Missing files or blocked playback fall back to the browser's German voice.
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const catalogByText = new Map(dialogueCatalog.lines.map((line) => [normalize(line.text), line]));
let assets = new Map();
let manifestLoaded = false;
let currentAudio = null;
let playbackVersion = 0;
let activeSpeaker=null, speechStarted=0;
// Mouths follow the real loudness of the voice file (a WebAudio meter on the playing element).
let audioContext = null, analyser = null, samples = null, mouthLevel = 0;
function meter(audio) {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const source = audioContext.createMediaElementSource(audio);
    analyser = audioContext.createAnalyser(); analyser.fftSize = 512; samples = new Float32Array(analyser.fftSize);
    source.connect(analyser); analyser.connect(audioContext.destination);
  } catch { analyser = null; }
}
function loudness() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(samples);
  let sum = 0; for (const v of samples) sum += v * v;
  return Math.sqrt(sum / samples.length);
}

const manifestReady = fetch(`${import.meta.env.BASE_URL}audio/manifest.json`, { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`Audio manifest HTTP ${response.status}`);
    return response.json();
  })
  .then((manifest) => {
    if (manifest.schema_version !== 1 || !Array.isArray(manifest.assets)) {
      throw new Error('Unsupported audio manifest');
    }
    assets = new Map(manifest.assets.filter((asset) => asset?.id && asset?.url).map((asset) => [asset.id, asset]));
    manifestLoaded = true;
  })
  .catch((error) => {
    console.warn('Qwen3-TTS audio unavailable; browser voice fallback enabled:', error);
    manifestLoaded = true;
  });

function browserSpeech(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.87;
  utterance.pitch = 0.87;
  utterance.volume = 0.85;
  utterance.onstart=()=>{speechStarted=performance.now();};
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((candidate) => candidate.lang.toLowerCase().startsWith('de') && /natural|online/i.test(candidate.name))
    ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith('de'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function stopVoice() {
  activeSpeaker=null;
  playbackVersion++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

export async function speakLine(text, speaker = null) {
  stopVoice();
  const version = playbackVersion;
  activeSpeaker=speaker;speechStarted=performance.now();
  const line = catalogByText.get(normalize(text));

  await manifestReady;
  if (version !== playbackVersion) return;

  const asset = line ? assets.get(line.id) : null;
  if (!asset) {
    browserSpeech(text);
    return;
  }

  const audio = new Audio(asset.url);
  audio.preload = 'auto';
  currentAudio = audio;
  meter(audio);
  const fallback = () => {
    if (version !== playbackVersion || currentAudio !== audio) return;
    currentAudio = null;
    browserSpeech(text);
  };
  audio.addEventListener('error', fallback, { once: true });
  audio.addEventListener('ended', () => {
    if (currentAudio === audio) currentAudio = null;
  }, { once: true });
  try {
    await audio.play();
  } catch (error) {
    if (version === playbackVersion) {
      console.warn(`Unable to play ${line.id}; using browser voice:`, error);
      fallback();
    }
  }
}

// 0..1, smoothed. Without a file (browser voice) a calm syllable rhythm stands in for loudness.
function mouthOpen(playing, t) {
  const local = !!currentAudio && !currentAudio.paused;
  const target = !playing ? 0 : local && analyser ? Math.min(1, loudness() * 7) : Math.max(0, Math.sin(t * 10.5)) ** .7 * .6;
  mouthLevel += (target - mouthLevel) * (target > mouthLevel ? .55 : .3);
  return mouthLevel;
}
export function voiceStatus() {
  const playing=(!!currentAudio&&!currentAudio.paused)||!!window.speechSynthesis?.speaking;
  const t=currentAudio?.currentTime??(performance.now()-speechStarted)/1000;
  return {
    manifestLoaded,
    availableFiles: assets.size,
    playingLocalAudio: !!currentAudio && !currentAudio.paused,
    speaker:activeSpeaker, playing,
    mouth:mouthOpen(playing, t),
  };
}
