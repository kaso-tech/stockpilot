/** Petit signal sonore (et vibration sur téléphone) pour les événements du circuit vendeur → caisse. */
let audioContext: AudioContext | null = null;

export function playAlert(kind: "info" | "success" | "warning" = "info") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(kind === "warning" ? [120, 60, 120] : 120);
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    audioContext ??= new Context();
    const notes = kind === "success" ? [660, 880] : kind === "warning" ? [520, 390] : [740];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const start = audioContext!.currentTime + index * 0.16;
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain).connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  } catch { /* son indisponible : la notification visuelle suffit */ }
}

/** Numéro court affiché : 001, 012. */
export function formatQueueNumber(value: number | null | undefined) {
  return value ? String(value).padStart(3, "0") : "—";
}
