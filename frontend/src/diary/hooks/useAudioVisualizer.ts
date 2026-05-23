import { useEffect } from "react";

export const useAudioVisualizer = (audioRef: React.RefObject<HTMLAudioElement>, canvasRef: React.RefObject<HTMLCanvasElement>) => {
  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) {
      return;
    }

    let raf = 0;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let ctx: AudioContext | null = null;

    const setup = () => {
      if (ctx) {
        return;
      }
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
    };

    const render = () => {
      if (!analyser) {
        return;
      }
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) {
        return;
      }
      const width = canvas.width;
      const height = canvas.height;
      ctx2d.clearRect(0, 0, width, height);

      const barWidth = width / bufferLength;
      for (let i = 0; i < bufferLength; i += 1) {
        const value = dataArray[i] / 255;
        const barHeight = height * value;
        ctx2d.fillStyle = "rgba(255,255,255,0.65)";
        ctx2d.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
      }

      raf = requestAnimationFrame(render);
    };

    const onPlay = () => {
      setup();
      if (ctx?.state === "suspended") {
        void ctx.resume();
      }
      render();
    };

    const onPause = () => {
      cancelAnimationFrame(raf);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      cancelAnimationFrame(raf);
      source?.disconnect();
      analyser?.disconnect();
      ctx?.close();
    };
  }, [audioRef, canvasRef]);
};
