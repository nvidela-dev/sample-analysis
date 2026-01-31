"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { KeyCandidate } from "@/lib/audio-analyzer";

interface KeyRadarProps {
  candidates: KeyCandidate[];
  stopTrigger?: number;
  useFlats?: boolean;
  onToggleNotation?: () => void;
}

const SHARP_TO_FLAT: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

const NOTE_FREQUENCIES: Record<string, number> = {
  "C": 261.63,
  "C#": 277.18,
  "D": 293.66,
  "D#": 311.13,
  "E": 329.63,
  "F": 349.23,
  "F#": 369.99,
  "G": 392.00,
  "G#": 415.30,
  "A": 440.00,
  "A#": 466.16,
  "B": 493.88,
};

export function KeyRadar({ candidates, stopTrigger, useFlats = false, onToggleNotation }: KeyRadarProps) {
  const formatKey = (key: string) => {
    if (useFlats && SHARP_TO_FLAT[key]) {
      return SHARP_TO_FLAT[key];
    }
    return key;
  };
  const top6 = candidates.slice(0, 6);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [volume, setVolume] = useState(100);
  const [detune, setDetune] = useState(0); // cents (-50 to +50)
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  // Stop all tones when stopTrigger changes
  useEffect(() => {
    if (stopTrigger && stopTrigger > 0 && oscillatorRef.current) {
      const { gain, osc } = oscillatorRef.current;
      gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current!.currentTime + 0.1);
      setTimeout(() => {
        try { osc.stop(); } catch {}
      }, 100);
      oscillatorRef.current = null;
      setActiveNote(null);
    }
  }, [stopTrigger]);

  // Update detune on active oscillator
  useEffect(() => {
    if (oscillatorRef.current) {
      oscillatorRef.current.osc.detune.value = detune;
    }
  }, [detune]);

  // Update volume on active oscillator
  useEffect(() => {
    if (oscillatorRef.current && audioContextRef.current) {
      oscillatorRef.current.gain.gain.setValueAtTime(
        (volume / 100) * 0.2,
        audioContextRef.current.currentTime
      );
    }
  }, [volume]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        try { oscillatorRef.current.osc.stop(); } catch {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const toggleNote = useCallback((key: string, mode: "major" | "minor") => {
    const noteId = `${key}-${mode}`;

    if (activeNote === noteId) {
      if (oscillatorRef.current) {
        const { gain, osc } = oscillatorRef.current;
        gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current!.currentTime + 0.1);
        setTimeout(() => {
          try { osc.stop(); } catch {}
        }, 100);
        oscillatorRef.current = null;
      }
      setActiveNote(null);
      return;
    }

    if (oscillatorRef.current) {
      const { gain, osc } = oscillatorRef.current;
      gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current!.currentTime + 0.05);
      setTimeout(() => {
        try { osc.stop(); } catch {}
      }, 50);
    }

    const ctx = getAudioContext();
    const baseFreq = NOTE_FREQUENCIES[key];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = baseFreq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime((volume / 100) * 0.2, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    oscillatorRef.current = { osc, gain };
    setActiveNote(noteId);
  }, [activeNote, getAudioContext, detune, volume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  }, []);

  const handleDetuneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDetune(Number(e.target.value));
  }, []);

  // Radar chart configuration
  const size = 180;
  const center = size / 2;
  const maxRadius = 65;
  const minRadius = 22;

  const points = top6.map((candidate, i) => {
    const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
    const radius = minRadius + (maxRadius - minRadius) * candidate.confidence;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      labelX: center + (maxRadius + 22) * Math.cos(angle),
      labelY: center + (maxRadius + 22) * Math.sin(angle),
      candidate,
      angle,
    };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  const gridLevels = [0.33, 0.66, 1];
  const createHexagonPath = (radius: number) => {
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
      hexPoints.push(`${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`);
    }
    return hexPoints.join(" ");
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        {/* Radar */}
        <svg width={size} height={size} className="overflow-visible">
          {gridLevels.map((level, i) => (
            <polygon
              key={i}
              points={createHexagonPath(minRadius + (maxRadius - minRadius) * level)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-brown/15"
            />
          ))}

          {points.map((p, i) => (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + maxRadius * Math.cos(p.angle)}
              y2={center + maxRadius * Math.sin(p.angle)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-brown/15"
            />
          ))}

          <polygon
            points={polygonPoints}
            fill="url(#radarGradient)"
            stroke="currentColor"
            strokeWidth="2"
            className="text-forest"
          />

          <defs>
            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#606C38" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#283618" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {points.map((p, i) => {
            const noteId = `${p.candidate.key}-${p.candidate.mode}`;
            const isActive = activeNote === noteId;

            return (
              <g
                key={i}
                className="cursor-pointer group"
                onClick={() => toggleNote(p.candidate.key, p.candidate.mode)}
              >
                <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 6 : 4}
                  fill={isActive ? "#DDA15E" : "#606C38"}
                  stroke={isActive ? "#BC6C25" : "#283618"}
                  strokeWidth="2"
                  className="transition-all duration-150 group-hover:scale-150 group-hover:drop-shadow-lg"
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
              </g>
            );
          })}

          {points.map((p, i) => {
            const noteId = `${p.candidate.key}-${p.candidate.mode}`;
            const isActive = activeNote === noteId;
            const isTop = i === 0;

            return (
              <g key={`label-${i}`} className="cursor-pointer" onClick={() => toggleNote(p.candidate.key, p.candidate.mode)}>
                <text
                  x={p.labelX}
                  y={p.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`text-xs font-medium transition-colors ${
                    isActive ? "fill-orange" : isTop ? "fill-forest" : "fill-brown/70"
                  }`}
                >
                  {formatKey(p.candidate.key)}
                </text>
                <text
                  x={p.labelX}
                  y={p.labelY + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`text-[9px] transition-colors ${
                    isActive ? "fill-orange/80" : "fill-brown/50"
                  }`}
                >
                  {p.candidate.mode}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Volume slider (inner right) */}
        <div className="flex flex-col items-center h-[180px]">
          <span className="text-[10px] text-brown/50 mb-1">Vol</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="slider-vertical h-[140px] w-2 accent-olive cursor-pointer"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <span className="text-[10px] text-brown/50 mt-1">{volume}%</span>
        </div>

        {/* Detune slider (outer right) */}
        <div className="flex flex-col items-center h-[180px]">
          <span className="text-[10px] text-forest/60 mb-1">Pitch</span>
          <input
            type="range"
            min="-50"
            max="50"
            value={detune}
            onChange={handleDetuneChange}
            className="slider-vertical h-[140px] w-2 accent-forest cursor-pointer"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <span className="text-[10px] text-forest/80 mt-1">{detune > 0 ? `+${detune}` : detune}¢</span>
        </div>
      </div>

      {/* Sharp/Flat toggle */}
      <button
        onClick={onToggleNotation}
        className="mt-2 px-2 py-0.5 text-[10px] text-brown/60 hover:text-forest border border-brown/20 hover:border-forest rounded transition-colors"
      >
        {useFlats ? "♭ → ♯" : "♯ → ♭"}
      </button>
    </div>
  );
}
