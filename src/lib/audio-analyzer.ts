export interface KeyCandidate {
  key: string;
  mode: "major" | "minor";
  confidence: number;
}

export interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  bpmAlternatives: number[];
  keyCandidates: KeyCandidate[];
}

// Key name mapping
const KEY_MAP: Record<string, string> = {
  "C": "C", "C#": "C#", "Db": "C#",
  "D": "D", "D#": "D#", "Eb": "D#",
  "E": "E", "Fb": "E",
  "F": "F", "F#": "F#", "Gb": "F#",
  "G": "G", "G#": "G#", "Ab": "G#",
  "A": "A", "A#": "A#", "Bb": "A#",
  "B": "B", "Cb": "B"
};

const ALL_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let essentiaInstance: any = null;
let EssentiaWASM: any = null;

async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;

  // Dynamic import for Essentia.js
  const EssentiaModule = await import("essentia.js");
  const Essentia = EssentiaModule.Essentia;
  EssentiaWASM = EssentiaModule.EssentiaWASM;

  // Initialize WASM
  const wasmModule = await EssentiaWASM();
  essentiaInstance = new Essentia(wasmModule);

  return essentiaInstance;
}

export async function analyzeAudio(file: File): Promise<AnalysisResult> {
  const essentia = await getEssentia();

  // Decode audio
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get mono audio data
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Convert to Essentia vector
  const audioVector = essentia.arrayToVector(channelData);

  // Resample to 44100 if needed (Essentia algorithms expect this)
  let processedAudio = audioVector;
  if (sampleRate !== 44100) {
    const resampled = essentia.Resample(audioVector, sampleRate, 44100);
    processedAudio = resampled.signal;
  }

  // BPM Detection using RhythmExtractor2013
  let bpm = 120;
  let bpmConfidence = 0.5;
  let bpmAlternatives: number[] = [];

  try {
    const rhythm = essentia.RhythmExtractor2013(processedAudio);
    bpm = Math.round(rhythm.bpm);
    bpmConfidence = rhythm.confidence || 0.5;

    // Get BPM estimates for alternatives
    if (rhythm.bpmIntervals && rhythm.bpmIntervals.length > 0) {
      const estimates = Array.from(rhythm.bpmIntervals as Float32Array);
      const uniqueBpms = [...new Set(estimates.map((b: number) => Math.round(b)))];
      bpmAlternatives = uniqueBpms
        .filter((b: number) => Math.abs(b - bpm) > 5 && b >= 60 && b <= 200)
        .slice(0, 3);
    }

    // Add half/double time as alternatives
    if (bpm * 2 <= 200 && !bpmAlternatives.includes(bpm * 2)) {
      bpmAlternatives.push(bpm * 2);
    }
    if (bpm / 2 >= 60 && !bpmAlternatives.includes(Math.round(bpm / 2))) {
      bpmAlternatives.push(Math.round(bpm / 2));
    }
    bpmAlternatives = bpmAlternatives.slice(0, 3).sort((a, b) => a - b);
  } catch (e) {
    console.warn("BPM detection failed, using fallback", e);
  }

  // Key Detection using KeyExtractor
  let keyCandidates: KeyCandidate[] = [];

  try {
    const keyResult = essentia.KeyExtractor(processedAudio);
    const detectedKey = KEY_MAP[keyResult.key] || keyResult.key;
    const detectedMode = keyResult.scale.toLowerCase() as "major" | "minor";
    const strength = keyResult.strength || 0.8;

    // Create candidates list with the detected key first
    keyCandidates.push({
      key: detectedKey,
      mode: detectedMode,
      confidence: strength
    });

    // Add other keys with decreasing confidence
    // The algorithm sometimes confuses relative major/minor and nearby keys
    const keyIndex = ALL_KEYS.indexOf(detectedKey);
    const relativeKey = detectedMode === "minor"
      ? ALL_KEYS[(keyIndex + 3) % 12]  // Relative major
      : ALL_KEYS[(keyIndex + 9) % 12]; // Relative minor

    // Add relative key
    keyCandidates.push({
      key: relativeKey,
      mode: detectedMode === "minor" ? "major" : "minor",
      confidence: strength * 0.7
    });

    // Add parallel key
    keyCandidates.push({
      key: detectedKey,
      mode: detectedMode === "minor" ? "major" : "minor",
      confidence: strength * 0.5
    });

    // Add neighboring keys (half step up/down)
    const halfStepUp = ALL_KEYS[(keyIndex + 1) % 12];
    const halfStepDown = ALL_KEYS[(keyIndex + 11) % 12];

    keyCandidates.push({
      key: halfStepDown,
      mode: detectedMode,
      confidence: strength * 0.4
    });

    keyCandidates.push({
      key: halfStepUp,
      mode: detectedMode,
      confidence: strength * 0.35
    });

  } catch (e) {
    console.warn("Key detection failed, using fallback", e);
    // Fallback
    keyCandidates = ALL_KEYS.slice(0, 5).map((key, i) => ({
      key,
      mode: "major" as const,
      confidence: 1 - i * 0.15
    }));
  }

  await audioContext.close();

  return {
    bpm,
    bpmConfidence,
    bpmAlternatives,
    keyCandidates
  };
}
