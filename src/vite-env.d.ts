/// <reference types="vite/client" />

declare module 'playcanvas/scripts/esm/third-person-controller.mjs' {
  import { Script } from 'playcanvas';
  export class ThirdPersonController extends Script {
    static scriptName: string;
  }
  export function damp(damping: number, dt: number): number;
}

declare module 'playcanvas/scripts/esm/camera-controls.mjs' {
  import { Script } from 'playcanvas';
  export class CameraControls extends Script {
    static scriptName: string;
  }
  export function damp(damping: number, dt: number): number;
}
