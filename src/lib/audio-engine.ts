import { logger } from "@/lib/logger";

export type AudioMode = "TALKING" | "PLAYING";

/**
 * Web Audio API real-time RMS and Peak Level Analyser for VU Metering.
 *
 * Allows musician to see their instrument's raw input levels, check for dead mics,
 * and ensure instrument attacks do not digitally clip.
 */
export function createAudioLevelMeter(
  stream: MediaStream,
  onLevelChange: (rms: number, peak: number) => void,
): () => void {
  let isRunning = true;
  let animId: number | null = null;
  let audioContext: AudioContext | null = null;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioContext = new AudioContextClass();

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!isRunning) return;

      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      let peak = 0;

      for (let i = 0; i < dataArray.length; i++) {
        // Center around 0 (-1.0 to 1.0)
        const normalized = (dataArray[i] - 128) / 128;
        const absVal = Math.abs(normalized);
        if (absVal > peak) peak = absVal;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Pass normalized values (0.0 to 1.0)
      onLevelChange(Math.min(1, rms * 2.5), Math.min(1, peak));

      animId = requestAnimationFrame(tick);
    };

    tick();
  } catch (err) {
    logger.warn({ err }, "Could not initialize Web Audio Analyser");
  }

  return () => {
    isRunning = false;
    if (animId !== null) cancelAnimationFrame(animId);
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  };
}
