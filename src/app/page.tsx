"use client";

import { useState, useCallback } from "react";
import { analyzeAudio, AnalysisResult } from "@/lib/audio-analyzer";
import { VinylScratcher } from "@/components/VinylScratcher";
import { AudioPlayer } from "@/components/AudioPlayer";
import { KeyRadar } from "@/components/KeyRadar";
import { BPMRadar } from "@/components/BPMRadar";

type Status = "idle" | "analyzing" | "done" | "error";

function LeafDecoration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main stem */}
      <path
        d="M60 155 Q60 80 60 10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.6"
      />
      {/* Left leaves */}
      <path
        d="M60 130 Q30 120 20 100 Q35 105 60 115"
        fill="currentColor"
        opacity="0.4"
      />
      <path
        d="M60 100 Q25 85 15 60 Q35 70 60 85"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M60 70 Q30 50 25 25 Q40 40 60 55"
        fill="currentColor"
        opacity="0.6"
      />
      {/* Right leaves */}
      <path
        d="M60 120 Q90 110 100 90 Q85 95 60 105"
        fill="currentColor"
        opacity="0.4"
      />
      <path
        d="M60 90 Q95 75 105 50 Q85 60 60 75"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M60 55 Q85 35 90 15 Q75 30 60 45"
        fill="currentColor"
        opacity="0.6"
      />
      {/* Leaf veins */}
      <path
        d="M60 130 Q40 118 25 105"
        stroke="currentColor"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M60 100 Q38 82 22 65"
        stroke="currentColor"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M60 120 Q80 108 95 95"
        stroke="currentColor"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M60 90 Q82 75 98 58"
        stroke="currentColor"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}


export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedBPM, setSelectedBPM] = useState<number | null>(null);
  const [restartTrigger, setRestartTrigger] = useState(0);
  const [stopTrigger, setStopTrigger] = useState(0);
  const [volume, setVolume] = useState(1);
  const [bpmOffset, setBpmOffset] = useState(0);
  const [useFlats, setUseFlats] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      setError("Please drop an audio file");
      setStatus("error");
      return;
    }

    setFileName(file.name);
    setAudioFile(file);
    setStatus("analyzing");
    setError(null);
    setResult(null);

    try {
      const analysis = await analyzeAudio(file);
      setResult(analysis);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze audio");
      setStatus("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setFileName(null);
    setAudioFile(null);
    setIsPlaying(false);
    setSelectedBPM(null);
    setRestartTrigger(0);
    setStopTrigger(0);
    setVolume(1);
    setBpmOffset(0);
    setUseFlats(false);
  }, []);

  const handleStop = useCallback(() => {
    setStopTrigger(prev => prev + 1);
  }, []);

  const handleBPMSelect = useCallback((bpm: number) => {
    setSelectedBPM(bpm);
    setRestartTrigger(prev => prev + 1);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
  }, []);

  const handleBPMOffsetChange = useCallback((offset: number) => {
    setBpmOffset(offset);
  }, []);

  const handleBPMOffsetRelease = useCallback(() => {
    // Restart with metronome at the current tempo (keeps offset)
    setRestartTrigger(prev => prev + 1);
  }, []);

  const toggleNotation = useCallback(() => {
    setUseFlats(prev => !prev);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center pt-16 pb-24 p-8 relative overflow-hidden">
      {/* Decorative leaves */}
      <LeafDecoration className="absolute -top-8 -right-8 w-72 h-96 text-olive rotate-[25deg] opacity-50" />
      <LeafDecoration className="absolute -bottom-12 -left-8 w-64 h-88 text-forest rotate-[-160deg] opacity-40" />

      {/* Fixed header section */}
      <div className="flex flex-col items-center relative z-10">
        {/* Interactive vinyl scratcher logo */}
        <VinylScratcher isSpinning={isPlaying} />

        {/* Title */}
        <h1 className="font-display text-5xl text-brown mb-3 tracking-wide">
          Sample Analyzer
        </h1>
        <p className="text-lg text-brown/60 mb-3 max-w-md truncate text-center">
          {fileName || "Drop an audio file to detect key & BPM"}
        </p>
      </div>

      {/* Drop Zone wrapper - fixed height container */}
      <div className="relative w-full max-w-xl">
        {/* Collage images - positioned relative to drop zone */}
        <img
          src="/mpc.jpg"
          alt=""
          className="absolute -left-96 top-0 w-[1400px] opacity-20 -rotate-6 pointer-events-none z-0"
        />
        <img
          src="/piano.jpg"
          alt=""
          className="absolute -right-96 -top-20 w-[1400px] opacity-20 rotate-3 pointer-events-none z-0"
        />

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            w-full rounded-2xl border-3 border-dashed p-8
            flex flex-col items-center justify-center gap-4 transition-all cursor-pointer
            bg-cream/80 backdrop-blur-sm z-10 relative
            ${status === "done" ? "min-h-0" : "min-h-72"}
            ${isDragging
              ? "border-olive bg-olive/10 scale-[1.02]"
              : "border-tan hover:border-olive hover:bg-cream"}
            ${status === "analyzing" ? "pointer-events-none" : ""}
          `}
        onClick={() => {
          if (status !== "analyzing") {
            document.getElementById("file-input")?.click();
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          accept="audio/*"
          onChange={handleInputChange}
          className="hidden"
        />

        {status === "idle" && (
          <>
            <svg
              className="w-16 h-16 text-tan"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <span className="text-xl text-brown/70">Drop audio file or click to browse</span>
          </>
        )}

        {status === "analyzing" && (
          <>
            <div className="w-12 h-12 border-4 border-olive border-t-transparent rounded-full animate-spin" />
            <span className="text-xl text-brown/70">Analyzing {fileName}...</span>
          </>
        )}

        {status === "done" && result && (
          <div className="w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2 mb-6">
              <BPMRadar
                bpm={result.bpm}
                confidence={result.bpmConfidence}
                alternatives={result.bpmAlternatives}
                selectedBPM={selectedBPM ?? result.bpm}
                onBPMSelect={handleBPMSelect}
                onVolumeChange={handleVolumeChange}
                onBPMOffsetChange={handleBPMOffsetChange}
                onBPMOffsetRelease={handleBPMOffsetRelease}
              />
              <KeyRadar
                candidates={result.keyCandidates}
                stopTrigger={stopTrigger}
                useFlats={useFlats}
                onToggleNotation={toggleNotation}
              />
            </div>

            {audioFile && (
              <AudioPlayer
                file={audioFile}
                bpm={(selectedBPM ?? result.bpm) + bpmOffset}
                volume={volume}
                onPlayingChange={setIsPlaying}
                onStop={handleStop}
                restartTrigger={restartTrigger}
              />
            )}

            <button
              onClick={reset}
              className="w-full text-xs text-forest hover:text-cream py-1.5 border border-olive rounded-lg hover:bg-olive transition-all mt-4"
            >
              Analyze another
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="text-lg text-orange mb-6">{error}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="text-base text-brown/70 hover:text-brown underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
      </div>{/* End drop zone wrapper */}

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-brown flex items-center justify-end px-6">
        <a
          href="https://nvidela.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cream/50 hover:text-cream text-sm transition-colors"
        >
          nvidela.dev
        </a>
      </div>
    </main>
  );
}
