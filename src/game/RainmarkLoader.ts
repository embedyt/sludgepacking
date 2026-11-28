export interface RainmarkLoaderOptions {
  skipIntro?: boolean;
  onPhaseChange?: (phase: 'studio' | 'loading' | 'done') => void;
  loadTask: (setProgressText: (text: string) => void) => Promise<void>;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function runTween(
  durationMs: number,
  onStep: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      onStep(t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function mountRainmarkLoader(options: RainmarkLoaderOptions): () => void {
  let cancelled = false;

  const overlay = document.createElement('div');
  overlay.id = 'rainmark-loader';
  overlay.setAttribute('data-testid', 'rainmark-loader');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999';
  overlay.style.backgroundColor = '#07090c';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.pointerEvents = 'auto';
  overlay.style.opacity = '1';

  // Phase 1: Centered Rainmark studio wordmark (ONLY the Rainmark text)
  const wordmark = document.createElement('div');
  wordmark.textContent = 'Rainmark';
  wordmark.setAttribute('data-testid', 'rainmark-wordmark');
  wordmark.style.color = '#f3efe6';
  wordmark.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  wordmark.style.fontSize = 'clamp(2.2rem, 5vw, 3.8rem)';
  wordmark.style.fontWeight = '700';
  wordmark.style.letterSpacing = '0.28em';
  wordmark.style.textTransform = 'uppercase';
  wordmark.style.opacity = '0';
  wordmark.style.transform = 'scale(0.92)';
  wordmark.style.willChange = 'opacity, transform';
  overlay.appendChild(wordmark);

  // Phase 2: Bottom-left spinner container (hidden until wordmark disappears)
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes rainmark-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  overlay.appendChild(styleTag);

  const spinnerDock = document.createElement('div');
  spinnerDock.setAttribute('data-testid', 'rainmark-spinner');
  spinnerDock.style.position = 'fixed';
  spinnerDock.style.left = '28px';
  spinnerDock.style.bottom = '26px';
  spinnerDock.style.display = 'flex';
  spinnerDock.style.alignItems = 'center';
  spinnerDock.style.gap = '12px';
  spinnerDock.style.opacity = '0';
  spinnerDock.style.pointerEvents = 'none';

  const spinnerRing = document.createElement('div');
  spinnerRing.style.width = '20px';
  spinnerRing.style.height = '20px';
  spinnerRing.style.borderRadius = '9999px';
  spinnerRing.style.border = '2px solid rgba(255, 255, 255, 0.16)';
  spinnerRing.style.borderTopColor = '#4ade80';
  spinnerRing.style.animation = 'rainmark-spin 0.78s linear infinite';

  const progressLabel = document.createElement('span');
  progressLabel.textContent = 'Loading';
  progressLabel.style.color = '#a1a8b3';
  progressLabel.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  progressLabel.style.fontSize = '12px';
  progressLabel.style.fontWeight = '600';
  progressLabel.style.letterSpacing = '0.14em';
  progressLabel.style.textTransform = 'uppercase';

  spinnerDock.appendChild(spinnerRing);
  spinnerDock.appendChild(progressLabel);
  overlay.appendChild(spinnerDock);

  document.body.appendChild(overlay);

  const setProgressText = (text: string) => {
    progressLabel.textContent = text;
  };

  void (async () => {
    if (!options.skipIntro) {
      options.onPhaseChange?.('studio');
      // Tween Rainmark text IN
      await runTween(560, (t) => {
        if (cancelled) return;
        const e = easeOutCubic(t);
        wordmark.style.opacity = String(e);
        wordmark.style.transform = `scale(${0.92 + e * 0.08})`;
      });
      if (cancelled) return;

      await waitMs(480);
      if (cancelled) return;

      // Tween Rainmark text OUT
      await runTween(440, (t) => {
        if (cancelled) return;
        const e = easeInCubic(t);
        wordmark.style.opacity = String(1 - e);
        wordmark.style.transform = `scale(${1 + e * 0.05})`;
      });
      if (cancelled) return;
    }

    wordmark.style.display = 'none';

    // Show bottom-left spinner and execute game loading
    options.onPhaseChange?.('loading');
    spinnerDock.style.opacity = '1';

    const minSpinnerStart = performance.now();
    try {
      await options.loadTask(setProgressText);
    } catch {
      // Keep playable even if non-fatal shader warm-up warns
    }
    if (cancelled) return;

    const elapsedSpinner = performance.now() - minSpinnerStart;
    if (!options.skipIntro && elapsedSpinner < 380) {
      await waitMs(380 - elapsedSpinner);
    }
    if (cancelled) return;

    await runTween(280, (t) => {
      if (cancelled) return;
      overlay.style.opacity = String(1 - easeOutCubic(t));
    });
    if (cancelled) return;

    overlay.remove();
    options.onPhaseChange?.('done');
  })();

  return () => {
    cancelled = true;
    overlay.remove();
  };
}
