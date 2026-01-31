"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface AudioPlayerProps {
  file: File;
  bpm: number;
  onPlayingChange?: (isPlaying: boolean) => void;
}

export function AudioPlayer({ file, bpm, onPlayingChange }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [progress, setProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Notify parent of playing state changes
  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  // Initialize audio context and decode file
  useEffect(() => {
    const init = async () => {
      audioContextRef.current = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer);

      gainRef.current = audioContextRef.current.createGain();
      gainRef.current.connect(audioContextRef.current.destination);

      // Draw waveform
      drawWaveform();
    };

    init();

    return () => {
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [file]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const buffer = audioBufferRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const data = buffer.getChannelData(0);
    const width = canvas.width;
    const height = canvas.height;
    const step = Math.ceil(data.length / width);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#C4A77D40";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const yMin = ((1 + min) / 2) * height;
      const yMax = ((1 + max) / 2) * height;

      ctx.lineTo(i, yMin);
    }

    for (let i = width - 1; i >= 0; i--) {
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum > max) max = datum;
      }

      const yMax = ((1 + max) / 2) * height;
      ctx.lineTo(i, yMax);
    }

    ctx.closePath();
    ctx.fill();
  }, []);

  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current || !isPlaying) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    const duration = audioBufferRef.current.duration;
    const prog = (elapsed % duration) / duration;
    setProgress(prog);

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isPlaying, updateProgress]);

  const playSample = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current || !gainRef.current) return;

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.loop = true;
    source.connect(gainRef.current);
    source.start();

    startTimeRef.current = audioContextRef.current.currentTime;
    sourceRef.current = source;
    setIsPlaying(true);
  }, []);

  const stopSample = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopSample();
    } else {
      playSample();
    }
  }, [isPlaying, playSample, stopSample]);

  const playClick = useCallback(() => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 1000;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }, []);

  const toggleMetronome = useCallback(() => {
    if (metronomeOn) {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
      setMetronomeOn(false);
    } else {
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }

      // Restart the sample to sync with metronome
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
      }

      if (audioBufferRef.current && gainRef.current && audioContextRef.current) {
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.loop = true;
        source.connect(gainRef.current);
        source.start();
        startTimeRef.current = audioContextRef.current.currentTime;
        sourceRef.current = source;
        setIsPlaying(true);
      }

      const intervalMs = (60 / bpm) * 1000;
      playClick();
      metronomeIntervalRef.current = setInterval(playClick, intervalMs);
      setMetronomeOn(true);
    }
  }, [metronomeOn, bpm, playClick]);

  return (
    <div className="w-full mt-6">
      {/* Waveform with play/metronome buttons */}
      <div className="flex items-center gap-3 mb-4">
        {/* Play & Metronome buttons */}
        <div className="flex gap-2 flex-shrink-0">
          {/* Play button */}
          <button
            onClick={togglePlay}
            className={`
              w-11 h-11 rounded-full border-2 flex items-center justify-center
              transition-all duration-150
              ${isPlaying
                ? "bg-orange/20 border-orange text-orange"
                : "bg-cream/50 border-tan text-brown hover:border-olive hover:bg-cream hover:text-forest"}
            `}
            title={isPlaying ? "Stop" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Metronome button */}
          <button
            onClick={toggleMetronome}
            className={`
              w-11 h-11 rounded-full border-2 flex items-center justify-center
              transition-all duration-150
              ${metronomeOn
                ? "bg-olive/20 border-olive text-forest"
                : "bg-cream/50 border-tan text-brown hover:border-olive hover:bg-cream hover:text-forest"}
            `}
            title={`Metronome (${bpm} BPM)`}
          >
            {/* Metronome icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L8 10h8l-4-8z" />
              <path d="M8 10l-2 10h12l-2-10H8z" />
              <rect x="11" y="6" width="2" height="8" rx="0.5" transform="rotate(-15 12 10)" />
            </svg>
          </button>
        </div>

        {/* Waveform */}
        <div className="relative flex-1 h-11 rounded-lg overflow-hidden bg-brown/10">
          <canvas
            ref={canvasRef}
            width={600}
            height={44}
            className="w-full h-full"
          />
          {/* Progress overlay */}
          <div
            className="absolute top-0 left-0 h-full bg-olive/30 pointer-events-none"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Playhead */}
          <div
            className="absolute top-0 h-full w-0.5 bg-orange pointer-events-none"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

    </div>
  );
}
