/** Capture one compositor-stable canonical frame without changing match state or HUD state. */
export async function captureSettledCssoccerFrame(browser, path, {
  diagnosticSurfaces = [],
} = {}) {
  const frozen = await browser.evaluate("window.__cssoccerDebug.beginVisualCapture()");
  try {
    const readiness = await browser.evaluate(`(async () => {
      const deadline = performance.now() + 15_000;
      const imageReadiness = await decodeAllImages();
      if (document.fonts?.ready) await document.fonts.ready;
      const scene = document.getElementById("scene");
      scene.blur();
      let lastKey = "";
      let stableFrames = 0;
      let lastSample = null;
      while (performance.now() < deadline) {
        await nextAnimationFrame();
        const sample = captureSample();
        lastSample = sample;
        if (sample.ready && sample.key === lastKey) stableFrames += 1;
        else stableFrames = sample.ready ? 1 : 0;
        lastKey = sample.key;
        if (stableFrames >= 3) {
          // cssQuake deliberately gives the compositor a real-time settle window
          // after the logical scene is ready. CSS transforms can be stable for
          // several rAFs while Chrome is still rasterizing large PolyCSS layers.
          await new Promise((resolve) => setTimeout(resolve, 250));
          await nextAnimationFrame();
          await nextAnimationFrame();
          const settledSample = captureSample();
          if (settledSample.ready && settledSample.key === sample.key) {
            return {
              ...settledSample,
              stableFrames,
              paintSettleMs: 250,
              paintSettleFrames: 2,
              imageReadiness,
              fontStatus: document.fonts?.status ?? "unsupported",
            };
          }
          lastKey = settledSample.key;
          stableFrames = settledSample.ready ? 1 : 0;
          lastSample = settledSample;
        }
      }
      throw new Error("css.soccer visual capture readiness timed out: "
        + JSON.stringify(lastSample));

      function captureSample() {
        const inspected = window.__cssoccerDebug.inspect();
        const capture = window.__cssoccerDebug.visualCaptureState();
        const roots = [...document.querySelectorAll("[data-cssoccer-root-id]")];
        const interpolated = [
          ...document.querySelectorAll('#scene [style*="transition-property: transform"]'),
        ];
        const runningTransformAnimations = document.getAnimations().filter((animation) => (
          animation.playState === "running"
          && String(animation.transitionProperty ?? animation.animationName ?? "").includes("transform")
        )).length;
        const transforms = interpolated.map((element) => getComputedStyle(element).transform);
        const key = JSON.stringify({
          tick: inspected.live?.tick,
          lastLiveRenderTick: inspected.mount?.lastLiveRenderTick,
          transforms,
        });
        const ready = inspected.ready === true
          && inspected.status === "ready"
          && capture.frozen === true
          && capture.tick === inspected.live?.tick
          && inspected.mount?.lastLiveRenderTick === inspected.live?.tick
          && inspected.mount?.rootCount === 37
          && inspected.mount?.connectedRootCount === 37
          && inspected.mount?.officialRootCount === 3
          && inspected.mount?.exactOfficialRootCount === 3
          && inspected.mount?.detachedLeafCount === 0
          && roots.length === 37
          && roots.every((root) => root.isConnected)
          && runningTransformAnimations === 0
          && !scene.matches(":focus-visible");
        return {
          ready,
          key,
          tick: inspected.live?.tick ?? null,
          phase: inspected.live?.phase ?? null,
          matchHalf: inspected.live?.matchHalf ?? null,
          score: inspected.live?.score ?? null,
          rootCount: roots.length,
          connectedRootCount: inspected.mount?.connectedRootCount ?? null,
          detachedLeafCount: inspected.mount?.detachedLeafCount ?? null,
          interpolatedElementCount: interpolated.length,
          runningTransformAnimations,
          focusVisible: scene.matches(":focus-visible"),
        };
      }

      async function decodeAllImages() {
        const failures = [];
        const documentImages = [...document.images];
        await Promise.all(documentImages.map(async (image) => {
          try {
            if (typeof image.decode === "function") await image.decode();
          } catch (error) {
            failures.push(image.currentSrc || image.src || String(error));
          }
        }));
        const cssUrls = new Set();
        const urlPattern = /url\\((?:"([^"]+)"|'([^']+)'|([^"')\\s]+))\\)/gu;
        for (const element of document.querySelectorAll("*")) {
          const style = getComputedStyle(element);
          for (const property of [
            "backgroundImage",
            "borderImageSource",
            "maskImage",
            "webkitMaskImage",
          ]) {
            let match = urlPattern.exec(String(style[property] ?? ""));
            while (match) {
              cssUrls.add(new URL(match[1] ?? match[2] ?? match[3], document.baseURI).href);
              match = urlPattern.exec(String(style[property] ?? ""));
            }
            urlPattern.lastIndex = 0;
          }
        }
        await Promise.all([...cssUrls].map(async (url) => {
          const image = new Image();
          image.src = url;
          try {
            if (typeof image.decode === "function") await image.decode();
            else await new Promise((resolve, reject) => {
              image.onload = resolve;
              image.onerror = reject;
            });
          } catch (error) {
            failures.push(url);
          }
        }));
        if (failures.length > 0) {
          throw new Error("css.soccer visual capture image decode failed: "
            + JSON.stringify(failures));
        }
        return {
          documentImageCount: documentImages.length,
          cssImageUrlCount: cssUrls.size,
          failureCount: failures.length,
        };
      }

      function nextAnimationFrame() {
        return new Promise((resolve) => requestAnimationFrame(resolve));
      }
    })()`, { awaitPromise: true });
    const result = await browser.screenshot(path);
    const surfaces = [];
    for (const surface of diagnosticSurfaces) {
      surfaces.push(await browser.screenshot(surface.path, surface.options));
    }
    return Object.freeze({ ...result, frozen, readiness, surfaces });
  } finally {
    await browser.evaluate(`(() => {
      const scene = document.getElementById("scene");
      scene.focus({ preventScroll: true });
      return window.__cssoccerDebug.endVisualCapture();
    })()`);
  }
}
