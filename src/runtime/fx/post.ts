import { CameraFrame, PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, TONEMAP_ACES2 } from 'playcanvas';
import type { AppBase, CameraComponent } from 'playcanvas';

/**
 * Bloom in 2.21.4 has NO `enabled` and NO `threshold`: the engine's own check is
 * `options.bloomEnabled = bloom.intensity > 0`. It also REQUIRES an HDR render
 * format — with PIXELFORMAT_RGBA8 it silently self-disables. Engine examples use
 * 0.01–0.035 for restrained bloom.
 */
export function createPostChain(app: AppBase, camera: CameraComponent, bloomIntensity = 0.02): CameraFrame {
  const frame = new CameraFrame(app, camera);
  frame.rendering.renderFormats = [PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F];
  frame.rendering.toneMapping = TONEMAP_ACES2;
  frame.rendering.samples = 4;
  frame.bloom.intensity = bloomIntensity;
  frame.bloom.blurLevel = 16;
  frame.update(); // mandatory after ANY property change
  return frame;
}
