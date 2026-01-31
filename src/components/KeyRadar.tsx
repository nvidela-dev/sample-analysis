"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { KeyCandidate } from "@/lib/audio-analyzer";

interface KeyRadarProps {
  candidates: KeyCandidate[];
  stopTrigger?: number; // Increment to stop all tones
}

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

export function KeyRadar({ candidates, stopTrigger }: KeyRadarProps) {
  const top6 = candidates.slice(0, 6);
  const [activeNote, setActiveNote] = useState<string | null>(null);
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

  // Initialize audio context on first interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Cleanup on unmount
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

    // If same note is active, stop it
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

    // Stop any currently playing note
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
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    oscillatorRef.current = { osc, gain };
    setActiveNote(noteId);
  }, [activeNote, getAudioContext]);

  // Radar chart configuration
  const size = 240;
  const center = size / 2;
  const maxRadius = 90;
  const minRadius = 30;

  // Calculate points for the radar shape
  const points = top6.map((candidate, i) => {
    const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2; // Start from top
    const radius = minRadius + (maxRadius - minRadius) * candidate.confidence;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      labelX: center + (maxRadius + 28) * Math.cos(angle),
      labelY: center + (maxRadius + 28) * Math.sin(angle),
      candidate,
      angle,
    };
  });

  // Create the polygon path
  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  // Grid lines (concentric hexagons)
  const gridLevels = [0.25, 0.5, 0.75, 1];
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
      <svg width={size} height={size} className="overflow-visible">
        {/* Background grid hexagons */}
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

        {/* Axis lines */}
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

        {/* Filled radar shape */}
        <polygon
          points={polygonPoints}
          fill="url(#radarGradient)"
          stroke="currentColor"
          strokeWidth="2"
          className="text-forest"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#606C38" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#283618" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Data points (clickable) */}
        {points.map((p, i) => {
          const noteId = `${p.candidate.key}-${p.candidate.mode}`;
          const isActive = activeNote === noteId;

          return (
            <g key={i} className="cursor-pointer" onClick={() => toggleNote(p.candidate.key, p.candidate.mode)}>
              {/* Larger hit area */}
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
              />
              {/* Visible point */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 8 : 6}
                fill={isActive ? "#DDA15E" : "#606C38"}
                stroke={isActive ? "#BC6C25" : "#283618"}
                strokeWidth="2"
                className="transition-all duration-150"
              />
              {/* Pulse animation when active */}
              {isActive && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={12}
                  fill="none"
                  stroke="#DDA15E"
                  strokeWidth="2"
                  className="animate-ping opacity-75"
                />
              )}
            </g>
          );
        })}

        {/* Labels */}
        {points.map((p, i) => {
          const noteId = `${p.candidate.key}-${p.candidate.mode}`;
          const isActive = activeNote === noteId;
          const isTop = i === 0;

          return (
            <g
              key={`label-${i}`}
              className="cursor-pointer"
              onClick={() => toggleNote(p.candidate.key, p.candidate.mode)}
            >
              <text
                x={p.labelX}
                y={p.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-sm font-medium transition-colors ${
                  isActive ? "fill-orange" : isTop ? "fill-forest" : "fill-brown/70"
                }`}
              >
                {p.candidate.key}
              </text>
              <text
                x={p.labelX}
                y={p.labelY + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-[10px] transition-colors ${
                  isActive ? "fill-orange/80" : "fill-brown/50"
                }`}
              >
                {p.candidate.mode}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 text-xs text-brown/50 text-center">
        Click a key to hear its tone
      </div>
    </div>
  );
}
