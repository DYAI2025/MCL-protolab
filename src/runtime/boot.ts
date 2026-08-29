import {
  AppBase,
  AppOptions,
  CameraComponentSystem,
  CollisionComponentSystem,
  Color,
  ContainerHandler,
  FILLMODE_FILL_WINDOW,
  LightComponentSystem,
  ParticleSystemComponentSystem,
  RESOLUTION_AUTO,
  RenderComponentSystem,
  RigidBodyComponentSystem,
  ScriptComponentSystem,
  TextureHandler,
  WasmModule,
  createGraphicsDevice,
} from 'playcanvas';

/**
 * Boots the prototype runtime.
 *
 * Ammo MUST be a defined global before app.start(): AppBase.start() calls
 * RigidBodyComponentSystem.onLibraryLoaded(), which permanently unbinds the
 * physics update handler if `typeof Ammo === 'undefined'` at that moment.
 * There is no retry and no error — physics is just silently dead.
 */
export async function bootRuntime(canvas: HTMLCanvasElement): Promise<AppBase> {
  WasmModule.setConfig('Ammo', {
    glueUrl: '/ammo/ammo.wasm.js',
    wasmUrl: '/ammo/ammo.wasm.wasm',
    fallbackUrl: '/ammo/ammo.js',
  });
  await new Promise<void>((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve());
  });

  const device = await createGraphicsDevice(canvas);
  device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

  const options = new AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem,
    ParticleSystemComponentSystem,
  ];
  options.resourceHandlers = [TextureHandler, ContainerHandler];

  const app = new AppBase(canvas);
  app.init(options);
  app.start();

  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.scene.ambientLight = new Color(0.28, 0.32, 0.38);

  // Resize is not automatic.
  const resize = () => app.resizeCanvas();
  window.addEventListener('resize', resize);
  app.on('destroy', () => window.removeEventListener('resize', resize));

  return app;
}
