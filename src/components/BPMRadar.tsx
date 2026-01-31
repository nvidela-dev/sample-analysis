"use client";

import { useState, useCallback, useMemo } from "react";

interface BPMRadarProps {
  bpm: number;
  confidence: number;
  alternatives: number[];
  onBPMSelect?: (bpm: number) => void;
  selectedBPM?: number;
  onVolumeChange?: (volume: number) => void;
  onBPMOffsetChange?: (offset: number) => void;
  onBPMOffsetRelease?: () => void;
}

export function BPMRadar({
  bpm,
  confidence,
  alternatives,
  onBPMSelect,
  selectedBPM,
  onVolumeChange,
  onBPMOffsetChange,
  onBPMOffsetRelease,
}: BPMRadarProps) {
  const [volume, setVolume] = useState(100);
  const [bpmOffset, setBpmOffset] = useState(0);

  // Create array of all BPM options (main + alternatives), pad to 6
  const allBPMs = useMemo(() => {
    const bpms = [
      { value: bpm, confidence: 1, isMain: true },
      ...alternatives.map((alt, i) => ({
        value: alt,
        confidence: 0.7 - i * 0.15,
        isMain: false,
      })),
    ];

    if (bpms.length < 4) {
      if (bpm * 2 <= 200 && !bpms.some(b => b.value === bpm * 2)) {
        bpms.push({ value: bpm * 2, confidence: 0.4, isMain: false });
      }
      if (bpm / 2 >= 50 && !bpms.some(b => b.value === Math.round(bpm / 2))) {
        bpms.push({ value: Math.round(bpm / 2), confidence: 0.4, isMain: false });
      }
    }

    while (bpms.length < 6) {
      bpms.push({ value: 0, confidence: 0, isMain: false });
    }

    return bpms.slice(0, 6);
  }, [bpm, alternatives]);

  const activeBPM = (selectedBPM ?? bpm) + bpmOffset;

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    onVolumeChange?.(val / 100);
  }, [onVolumeChange]);

  const handleBpmOffsetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setBpmOffset(val);
    onBPMOffsetChange?.(val);
  }, [onBPMOffsetChange]);

  const handleBpmOffsetRelease = useCallback(() => {
    setBpmOffset(0);
    onBPMOffsetRelease?.();
  }, [onBPMOffsetRelease]);

  // Radar chart configuration
  const size = 180;
  const center = size / 2;
  const maxRadius = 65;
  const minRadius = 22;

  const points = allBPMs.map((item, i) => {
    const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
    const radius = item.value ? minRadius + (maxRadius - minRadius) * item.confidence : 0;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      labelX: center + (maxRadius + 22) * Math.cos(angle),
      labelY: center + (maxRadius + 22) * Math.sin(angle),
      item,
      angle,
    };
  });

  const validPoints = points.filter(p => p.item.value > 0);
  const polygonPoints = validPoints.length >= 3
    ? validPoints.map(p => `${p.x},${p.y}`).join(" ")
    : "";

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
      <div className="text-xs text-brown/50 text-center mb-2">
        Click to set metronome
      </div>

      <div className="flex items-center gap-2">
        {/* BPM Offset slider (outer left) */}
        <div className="flex flex-col items-center h-[180px]">
          <span className="text-[10px] text-orange/60 mb-1">±BPM</span>
          <input
            type="range"
            min="-10"
            max="10"
            value={bpmOffset}
            onChange={handleBpmOffsetChange}
            onMouseUp={handleBpmOffsetRelease}
            onTouchEnd={handleBpmOffsetRelease}
            className="slider-vertical h-[140px] w-2 accent-orange cursor-pointer"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <span className="text-[10px] text-orange/80 mt-1">{bpmOffset > 0 ? `+${bpmOffset}` : bpmOffset}</span>
        </div>

        {/* Volume slider (inner left) */}
        <div className="flex flex-col items-center h-[180px]">
          <span className="text-[10px] text-brown/50 mb-1">Vol</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="slider-vertical h-[140px] w-2 accent-tan cursor-pointer"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <span className="text-[10px] text-brown/50 mt-1">{volume}%</span>
        </div>

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

          {polygonPoints && (
            <polygon
              points={polygonPoints}
              fill="url(#bpmRadarGradient)"
              stroke="currentColor"
              strokeWidth="2"
              className="text-orange"
            />
          )}

          <defs>
            <linearGradient id="bpmRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DDA15E" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#BC6C25" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {points.map((p, i) => {
            if (!p.item.value) return null;
            const isActive = (selectedBPM ?? bpm) === p.item.value;
            const isMain = p.item.isMain;

            return (
              <g
                key={i}
                className="cursor-pointer group"
                onClick={() => onBPMSelect?.(p.item.value)}
              >
                <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 6 : 4}
                  fill={isActive ? "#DDA15E" : "#BC6C25"}
                  stroke={isMain ? "#DDA15E" : "#8B5A2B"}
                  strokeWidth="2"
                  className="transition-all duration-150 group-hover:scale-150 group-hover:drop-shadow-lg"
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
              </g>
            );
          })}

          {points.map((p, i) => {
            if (!p.item.value) return null;
            const isActive = (selectedBPM ?? bpm) === p.item.value;
            const isMain = p.item.isMain;

            return (
              <text
                key={`label-${i}`}
                x={p.labelX}
                y={p.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-xs font-medium cursor-pointer transition-colors ${
                  isActive ? "fill-orange" : isMain ? "fill-orange/80" : "fill-brown/60"
                }`}
                onClick={() => onBPMSelect?.(p.item.value)}
              >
                {p.item.value}
              </text>
            );
          })}

          <text
            x={center}
            y={center - 5}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-orange text-xl font-display"
          >
            {activeBPM}
          </text>
          <text
            x={center}
            y={center + 12}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-brown/50 text-[10px]"
          >
            BPM
          </text>
        </svg>
      </div>
    </div>
  );
}
