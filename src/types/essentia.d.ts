declare module "essentia.js" {
  export class Essentia {
    constructor(wasmModule: any);
    arrayToVector(array: Float32Array): any;
    Resample(signal: any, inputSampleRate: number, outputSampleRate: number): { signal: any };
    RhythmExtractor2013(signal: any): {
      bpm: number;
      confidence: number;
      bpmIntervals: Float32Array;
    };
    KeyExtractor(signal: any): {
      key: string;
      scale: string;
      strength: number;
    };
  }

  export function EssentiaWASM(): Promise<any>;
}
