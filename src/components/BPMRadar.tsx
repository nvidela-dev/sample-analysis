"use client";

import { useState, useCallback, useMemo } from "react";

interface BPMRadarProps {
  bpm: number;
  confidence: number;
  alternatives: number[];
  onBPMSelect?: (bpm: number) => void;
  selectedBPM?: number;
}

export function BPMRadar({ bpm, confidence, alternatives, onBPMSelect, selectedBPM }: BPMRadarProps) {
  // Create array of all BPM options (main + alternatives), pad to 6
  const allBPMs = useMemo(() => {
    const bpms = [
      { value: bpm, confidence: 1, isMain: true },
      ...alternatives.map((alt, i) => ({
        value: alt,
        confidence: 0.7 - i * 0.15, // Decreasing confidence for alternatives
        isMain: false,
      })),
    ];

    // If we have fewer than 4, add half/double time variants
    if (bpms.length < 4) {
      if (bpm * 2 <= 200 && !bpms.some(b => b.value === bpm * 2)) {
        bpms.push({ value: bpm * 2, confidence: 0.4, isMain: false });
      }
      if (bpm / 2 >= 50 && !bpms.some(b => b.value === Math.round(bpm / 2))) {
        bpms.push({ value: Math.round(bpm / 2), confidence: 0.4, isMain: false });
      }
    }

    // Pad to exactly 6 with empty slots if needed, or trim
    while (bpms.length < 6) {
      bpms.push({ value: 0, confidence: 0, isMain: false });
    }

    return bpms.slice(0, 6);
  }, [bpm, alternatives]);

  const activeBPM = selectedBPM ?? bpm;

  // Radar chart configuration
  const size = 200;
  const center = size / 2;
  const maxRadius = 70;
  const minRadius = 25;

  // Calculate points for the radar shape
  const points = allBPMs.map((item, i) => {
    const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2; // Start from top
    const radius = item.value ? minRadius + (maxRadius - minRadius) * item.confidence : 0;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      labelX: center + (maxRadius + 24) * Math.cos(angle),
      labelY: center + (maxRadius + 24) * Math.sin(angle),
      item,
      angle,
    };
  });

  // Create the polygon path (only for non-empty points)
  const validPoints = points.filter(p => p.item.value > 0);
  const polygonPoints = validPoints.length >= 3
    ? validPoints.map(p => `${p.x},${p.y}`).join(" ")
    : "";

  // Grid lines (concentric hexagons)
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
        {polygonPoints && (
          <polygon
            points={polygonPoints}
            fill="url(#bpmRadarGradient)"
            stroke="currentColor"
            strokeWidth="2"
            className="text-orange"
          />
        )}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="bpmRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DDA15E" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#BC6C25" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Data points (clickable) */}
        {points.map((p, i) => {
          if (!p.item.value) return null;

          const isActive = activeBPM === p.item.value;
          const isMain = p.item.isMain;

          return (
            <g
              key={i}
              className="cursor-pointer"
              onClick={() => onBPMSelect?.(p.item.value)}
            >
              {/* Larger hit area */}
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              {/* Visible point */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 7 : 5}
                fill={isActive ? "#DDA15E" : "#BC6C25"}
                stroke={isMain ? "#DDA15E" : "#8B5A2B"}
                strokeWidth="2"
                className="transition-all duration-150"
              />
              {/* Pulse animation when active */}
              {isActive && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={11}
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
          if (!p.item.value) return null;

          const isActive = activeBPM === p.item.value;
          const isMain = p.item.isMain;

          return (
            <text
              key={`label-${i}`}
              x={p.labelX}
              y={p.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-sm font-medium cursor-pointer transition-colors ${
                isActive ? "fill-orange" : isMain ? "fill-orange/80" : "fill-brown/60"
              }`}
              onClick={() => onBPMSelect?.(p.item.value)}
            >
              {p.item.value}
            </text>
          );
        })}

        {/* Center BPM label */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-orange text-2xl font-display"
        >
          {activeBPM}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-brown/50 text-xs"
        >
          BPM
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-1 text-xs text-brown/50 text-center">
        Click to set metronome
      </div>
    </div>
  );
}
