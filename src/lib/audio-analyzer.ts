// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

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

// Simple FFT implementation (Cooley-Tukey radix-2)
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  for (let i = 0, j = 0; i < n; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Cooley-Tukey FFT
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;

      for (let j = 0; j < halfLen; j++) {
        const uReal = real[i + j];
        const uImag = imag[i + j];
        const tReal = curReal * real[i + j + halfLen] - curImag * imag[i + j + halfLen];
        const tImag = curReal * imag[i + j + halfLen] + curImag * real[i + j + halfLen];

        real[i + j] = uReal + tReal;
        imag[i + j] = uImag + tImag;
        real[i + j + halfLen] = uReal - tReal;
        imag[i + j + halfLen] = uImag - tImag;

        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

function getMagnitudeSpectrum(samples: Float32Array, fftSize: number): Float32Array {
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Apply Hann window and copy
  for (let i = 0; i < fftSize; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    real[i] = (samples[i] || 0) * window;
    imag[i] = 0;
  }

  fft(real, imag);

  // Compute magnitude
  const magnitude = new Float32Array(fftSize / 2);
  for (let i = 0; i < fftSize / 2; i++) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  return magnitude;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;

  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return den === 0 ? 0 : num / den;
}

function detectKey(audioBuffer: AudioBuffer): KeyCandidate[] {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const fftSize = 8192;
  const hopSize = 4096;

  // Accumulate chroma over all frames
  const chroma = new Array(12).fill(0);

  for (let start = 0; start + fftSize < data.length; start += hopSize) {
    const segment = data.slice(start, start + fftSize);
    const magnitude = getMagnitudeSpectrum(segment, fftSize);

    // Map FFT bins to chroma
    for (let bin = 1; bin < magnitude.length; bin++) {
      const freq = (bin * sampleRate) / fftSize;
      if (freq < 60 || freq > 2000) continue; // Focus on mid frequencies

      // Convert frequency to pitch class
      const midiNote = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = Math.round(midiNote) % 12;
      const normalizedPitch = ((pitchClass % 12) + 12) % 12;

      chroma[normalizedPitch] += magnitude[bin] * magnitude[bin];
    }
  }

  // Normalize
  const maxChroma = Math.max(...chroma);
  if (maxChroma > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxChroma;
    }
  }

  // Collect all key correlations
  const candidates: { key: string; mode: "major" | "minor"; correlation: number }[] = [];

  for (let shift = 0; shift < 12; shift++) {
    const shiftedChroma: number[] = [];
    for (let i = 0; i < 12; i++) {
      shiftedChroma.push(chroma[(i + shift) % 12]);
    }

    const majorCorr = pearsonCorrelation(MAJOR_PROFILE, shiftedChroma);
    const minorCorr = pearsonCorrelation(MINOR_PROFILE, shiftedChroma);

    candidates.push({ key: KEY_NAMES[shift], mode: "major", correlation: majorCorr });
    candidates.push({ key: KEY_NAMES[shift], mode: "minor", correlation: minorCorr });
  }

  // Sort by correlation (descending)
  candidates.sort((a, b) => b.correlation - a.correlation);

  // Convert correlations to confidence scores (softmax-like normalization)
  const topCandidates = candidates.slice(0, 6);
  const maxCorr = topCandidates[0].correlation;
  const minCorr = topCandidates[topCandidates.length - 1].correlation;
  const range = maxCorr - minCorr || 1;

  return topCandidates.map((c) => ({
    key: c.key,
    mode: c.mode,
    confidence: (c.correlation - minCorr) / range,
  }));
}

interface BPMResult {
  bpm: number;
  confidence: number;
  alternatives: number[];
}

function detectBPM(audioBuffer: AudioBuffer): BPMResult {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);

  // Use larger FFT for better frequency resolution in onset detection
  const fftSize = 2048;
  const hopSize = 512;

  // Compute spectral flux (onset detection function)
  let prevMagnitude: Float32Array | null = null;
  const spectralFlux: number[] = [];

  for (let start = 0; start + fftSize < data.length; start += hopSize) {
    const segment = data.slice(start, start + fftSize);
    const magnitude = getMagnitudeSpectrum(segment, fftSize);

    if (prevMagnitude) {
      let flux = 0;
      for (let i = 0; i < magnitude.length; i++) {
        const diff = magnitude[i] - prevMagnitude[i];
        flux += diff > 0 ? diff : 0; // Half-wave rectification
      }
      spectralFlux.push(flux);
    }

    prevMagnitude = magnitude;
  }

  if (spectralFlux.length < 100) {
    return { bpm: 120, confidence: 0, alternatives: [] };
  }

  // Normalize spectral flux
  const maxFlux = Math.max(...spectralFlux);
  if (maxFlux > 0) {
    for (let i = 0; i < spectralFlux.length; i++) {
      spectralFlux[i] /= maxFlux;
    }
  }

  // Compute autocorrelation to find tempo
  const framesPerSecond = sampleRate / hopSize;
  const minBPM = 60;
  const maxBPM = 180;
  const minLag = Math.floor((60 / maxBPM) * framesPerSecond);
  const maxLag = Math.floor((60 / minBPM) * framesPerSecond);

  const correlations: number[] = [];
  for (let lag = minLag; lag <= maxLag && lag < spectralFlux.length / 2; lag++) {
    let sum = 0;
    for (let i = 0; i < spectralFlux.length - lag; i++) {
      sum += spectralFlux[i] * spectralFlux[i + lag];
    }
    correlations.push(sum / (spectralFlux.length - lag));
  }

  // Find peaks in autocorrelation
  const peaks: { lag: number; value: number; bpm: number }[] = [];
  for (let i = 1; i < correlations.length - 1; i++) {
    if (correlations[i] > correlations[i - 1] && correlations[i] > correlations[i + 1]) {
      const lag = minLag + i;
      const bpm = (60 * framesPerSecond) / lag;
      peaks.push({ lag, value: correlations[i], bpm: Math.round(bpm) });
    }
  }

  // Sort by correlation strength
  peaks.sort((a, b) => b.value - a.value);

  if (peaks.length === 0) {
    return { bpm: 120, confidence: 0, alternatives: [] };
  }

  // Calculate confidence based on how much stronger the best peak is
  const bestPeak = peaks[0];
  const maxCorr = Math.max(...correlations);
  const avgCorr = correlations.reduce((a, b) => a + b, 0) / correlations.length;
  const confidence = Math.min(1, Math.max(0, (bestPeak.value - avgCorr) / (maxCorr - avgCorr + 0.001)));

  // Get primary BPM
  let bpm = bestPeak.bpm;

  // Normalize to common range, prefer 80-140
  if (bpm > 140) {
    const halfBPM = Math.round(bpm / 2);
    if (halfBPM >= 60) bpm = halfBPM;
  } else if (bpm < 80) {
    const doubleBPM = bpm * 2;
    if (doubleBPM <= 180) bpm = doubleBPM;
  }

  // Collect alternatives (half/double time, other strong peaks)
  const alternatives = new Set<number>();

  // Add half and double time
  if (bpm * 2 <= 200) alternatives.add(bpm * 2);
  if (bpm / 2 >= 50) alternatives.add(Math.round(bpm / 2));

  // Add other strong peaks that are meaningfully different
  for (const peak of peaks.slice(1, 4)) {
    let altBpm = peak.bpm;
    if (altBpm > 140 && altBpm / 2 >= 60) altBpm = Math.round(altBpm / 2);
    else if (altBpm < 80 && altBpm * 2 <= 180) altBpm = altBpm * 2;

    if (Math.abs(altBpm - bpm) > 5) {
      alternatives.add(altBpm);
    }
  }

  // Remove the primary BPM from alternatives
  alternatives.delete(bpm);

  return {
    bpm,
    confidence,
    alternatives: Array.from(alternatives).slice(0, 3).sort((a, b) => a - b),
  };
}

export async function analyzeAudio(file: File): Promise<AnalysisResult> {
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const bpmResult = detectBPM(audioBuffer);
    const keyCandidates = detectKey(audioBuffer);

    return {
      bpm: bpmResult.bpm,
      bpmConfidence: bpmResult.confidence,
      bpmAlternatives: bpmResult.alternatives,
      keyCandidates,
    };
  } finally {
    await audioContext.close();
  }
}
