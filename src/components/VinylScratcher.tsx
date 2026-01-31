"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface VinylScratcherProps {
  isSpinning?: boolean;
}

export function VinylScratcher({ isSpinning = false }: VinylScratcherProps) {
  const [rotation, setRotation] = useState(0);
  const [isScratching, setIsScratching] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const spinAnimationRef = useRef<number | null>(null);
  const lastSpinTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const lastAngleRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const returnAnimationRef = useRef<number | null>(null);

  // Initialize audio context and noise buffer
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (returnAnimationRef.current) {
        cancelAnimationFrame(returnAnimationRef.current);
      }
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
      }
    };
  }, []);

  // Spinning animation when playing
  useEffect(() => {
    if (isSpinning && !isScratching) {
      lastSpinTimeRef.current = performance.now();

      const spin = () => {
        const now = performance.now();
        const delta = now - lastSpinTimeRef.current;
        lastSpinTimeRef.current = now;

        // 33 1/3 RPM = 0.556 rotations per second = 200 degrees per second
        const degreesPerMs = 200 / 1000;
        setRotation(prev => prev + delta * degreesPerMs);

        spinAnimationRef.current = requestAnimationFrame(spin);
      };

      spinAnimationRef.current = requestAnimationFrame(spin);
    } else {
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
        spinAnimationRef.current = null;
      }
    }

    return () => {
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
      }
    };
  }, [isSpinning, isScratching]);

  const initAudio = useCallback(() => {
    if (audioContextRef.current) return;

    audioContextRef.current = new AudioContext();
    const ctx = audioContextRef.current;

    // Create noise buffer for scratch sound
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate pink-ish noise (more vinyl-like)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    noiseBufferRef.current = buffer;

    // Create gain node
    gainRef.current = ctx.createGain();
    gainRef.current.gain.value = 0;
    gainRef.current.connect(ctx.destination);
  }, []);

  const startScratchSound = useCallback(() => {
    if (!audioContextRef.current || !noiseBufferRef.current || !gainRef.current) return;

    // Stop any existing source
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
    }

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = noiseBufferRef.current;
    source.loop = true;

    // Add filter - higher pitched
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2500;
    filter.Q.value = 0.8;
    filterRef.current = filter;

    source.connect(filter);
    filter.connect(gainRef.current);
    source.start();
    sourceRef.current = source;
  }, []);

  const stopScratchSound = useCallback(() => {
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.linearRampToValueAtTime(
        0,
        audioContextRef.current.currentTime + 0.3
      );
    }
  }, []);

  const playReturnSound = useCallback(() => {
    if (!audioContextRef.current || !noiseBufferRef.current || !gainRef.current) return;

    // Stop any existing source
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
    }

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = noiseBufferRef.current;
    source.loop = true;
    source.playbackRate.value = 0.5;

    // Lower pitched filter for return
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 1;
    filterRef.current = filter;

    source.connect(filter);
    filter.connect(gainRef.current);

    gainRef.current.gain.setValueAtTime(0.25, ctx.currentTime);
    gainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

    source.start();
    sourceRef.current = source;

    // Stop after fade
    setTimeout(() => {
      try { source.stop(); } catch {}
    }, 600);
  }, []);

  const updateScratchSound = useCallback((velocity: number) => {
    if (!gainRef.current || !audioContextRef.current || !sourceRef.current) return;

    const absVelocity = Math.abs(velocity);
    const volume = Math.min(absVelocity / 400, 0.5);

    gainRef.current.gain.linearRampToValueAtTime(
      volume,
      audioContextRef.current.currentTime + 0.05
    );

    // Higher pitched - adjust playback rate based on velocity
    const rate = 1.5 + absVelocity / 200;
    sourceRef.current.playbackRate.value = velocity < 0 ? rate : rate;

    // Also adjust filter frequency based on speed
    if (filterRef.current) {
      const freq = 2000 + absVelocity * 10;
      filterRef.current.frequency.linearRampToValueAtTime(
        Math.min(freq, 6000),
        audioContextRef.current.currentTime + 0.05
      );
    }
  }, []);

  const getAngle = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    // Cancel any return animation
    if (returnAnimationRef.current) {
      cancelAnimationFrame(returnAnimationRef.current);
      returnAnimationRef.current = null;
    }
    setIsReturning(false);

    initAudio();
    setIsScratching(true);
    lastAngleRef.current = getAngle(clientX, clientY);
    lastTimeRef.current = performance.now();
    startScratchSound();
  }, [initAudio, getAngle, startScratchSound]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isScratching) return;

    const currentAngle = getAngle(clientX, clientY);
    const currentTime = performance.now();

    let deltaAngle = currentAngle - lastAngleRef.current;

    // Handle angle wrap-around
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    const deltaTime = currentTime - lastTimeRef.current;
    const velocity = deltaTime > 0 ? deltaAngle / deltaTime * 100 : 0;

    velocityRef.current = velocity;
    setRotation(prev => prev + deltaAngle);
    updateScratchSound(velocity);

    lastAngleRef.current = currentAngle;
    lastTimeRef.current = currentTime;
  }, [isScratching, getAngle, updateScratchSound]);

  const handleEnd = useCallback(() => {
    setIsScratching(false);
    stopScratchSound();

    // Animate return to base (0 degrees, normalized)
    const normalizedRotation = rotation % 360;
    if (Math.abs(normalizedRotation) > 5) {
      setIsReturning(true);
      playReturnSound();

      const startRotation = normalizedRotation;
      const startTime = performance.now();
      const duration = 400;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentRotation = startRotation * (1 - eased);

        setRotation(currentRotation);

        if (progress < 1) {
          returnAnimationRef.current = requestAnimationFrame(animate);
        } else {
          setRotation(0);
          setIsReturning(false);
        }
      };

      returnAnimationRef.current = requestAnimationFrame(animate);
    }
  }, [stopScratchSound, playReturnSound, rotation]);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleEnd();

    if (isScratching) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isScratching, handleMove, handleEnd]);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  return (
    <div className="mb-3 z-10 select-none relative group">
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`
          w-28 h-28 rounded-full overflow-hidden
          ring-4 ring-brown/40 shadow-lg shadow-brown/20 border-4 border-cream
          cursor-grab active:cursor-grabbing
          transition-shadow duration-150
          ${isScratching ? "ring-olive shadow-xl" : "hover:ring-olive/60"}
        `}
        style={{ transform: `rotate(${rotation - 7}deg)` }}
      >
        <img
          src="/logo.png"
          alt="Scratch me!"
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Speech bubble */}
      <div className={`
        absolute -right-20 top-1/2 -translate-y-1/2
        bg-cream border-2 border-brown/30 rounded-lg px-3 py-1.5
        text-xs text-brown font-medium whitespace-nowrap
        opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100
        transition-all duration-200 ease-out
        pointer-events-none
        ${isScratching ? "!opacity-0 !scale-75" : ""}
      `}>
        scratch me
        {/* Bubble tail */}
        <div className="absolute left-0 top-1/2 -translate-x-[6px] -translate-y-1/2
          w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent
          border-r-[6px] border-r-brown/30" />
        <div className="absolute left-0 top-1/2 -translate-x-[4px] -translate-y-1/2
          w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent
          border-r-[5px] border-r-cream" />
      </div>
    </div>
  );
}
