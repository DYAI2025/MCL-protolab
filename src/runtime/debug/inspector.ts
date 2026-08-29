import type { AppBase } from 'playcanvas';
import type { TunableDescriptor } from '../../core/config/tunables.ts';
import { formatInspector, type InspectorSnapshot } from '../../core/debug/inspector-state.ts';

export interface InspectorTunables {
  descriptors(): TunableDescriptor[];
  set(key: string, value: number): void;
}

export interface InspectorOptions {
  app: AppBase;
  container: HTMLElement;
  tunables: InspectorTunables;
  snapshot(): InspectorSnapshot;
  onReset(): void;
}

const UPDATE_INTERVAL_S = 0.1; // ~10 Hz — sliders stay responsive, text does not jitter

function section(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.cssText = 'margin:0 0 4px;font-size:11px;letter-spacing:0.08em;opacity:0.6;';
  const body = document.createElement('div');
  root.append(heading, body);
  root.style.marginBottom = '10px';
  return { root, body };
}

function row(label: string): { root: HTMLElement; value: HTMLElement } {
  const root = document.createElement('div');
  root.style.cssText = 'display:flex;justify-content:space-between;gap:12px;font-size:12px;';
  const name = document.createElement('span');
  name.textContent = label;
  name.style.opacity = '0.75';
  const value = document.createElement('span');
  value.style.cssText = 'font-variant-numeric:tabular-nums;';
  root.append(name, value);
  return { root, value };
}

/**
 * DOM debug overlay (mission §6 F). Built ONCE — only text nodes and slider
 * value labels are written afterwards; the slider list is never rebuilt.
 */
export function mountInspector(options: InspectorOptions): () => void {
  const { app, container, tunables, snapshot, onReset } = options;

  const panel = document.createElement('div');
  panel.style.cssText = [
    'background:rgba(13,17,23,0.82)', 'backdrop-filter:blur(4px)', 'padding:12px 14px',
    'margin:10px', 'border-radius:8px', 'min-width:230px', 'max-width:280px',
    'font-size:12px', 'line-height:1.5',
    'max-height:calc(100vh - 140px)', 'overflow-y:auto', // experiments add their own chips above/below
  ].join(';');

  // EXPERIMENT
  const experiment = section('EXPERIMENT');
  const experimentRow = row('id');
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset (R)';
  resetButton.style.cssText = 'margin-top:4px;font-size:12px;padding:2px 10px;cursor:pointer;';
  resetButton.addEventListener('click', () => onReset());
  experiment.body.append(experimentRow.root, resetButton);

  // PLAYER
  const player = section('PLAYER');
  const positionRow = row('position');
  const speedRow = row('speed');
  const stateRow = row('state');
  player.body.append(positionRow.root, speedRow.root, stateRow.root);

  // RUNTIME
  const runtime = section('RUNTIME');
  const fpsRow = row('fps');
  runtime.body.append(fpsRow.root);

  // TUNABLES — sliders built once from descriptors.
  const tuning = section('TUNABLES');
  for (const descriptor of tunables.descriptors()) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:block;margin-bottom:6px;font-size:11px;';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
    const name = document.createElement('span');
    name.textContent = descriptor.key;
    name.style.opacity = '0.75';
    const valueLabel = document.createElement('span');
    valueLabel.textContent = String(descriptor.value);
    valueLabel.style.cssText = 'font-variant-numeric:tabular-nums;';
    head.append(name, valueLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(descriptor.min);
    slider.max = String(descriptor.max);
    slider.step = String(descriptor.step);
    slider.value = String(descriptor.value);
    slider.style.cssText = 'width:100%;margin:2px 0 0;';
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      tunables.set(descriptor.key, value);
      valueLabel.textContent = String(value);
    });

    wrap.append(head, slider);
    tuning.body.append(wrap);
  }

  panel.append(experiment.root, player.root, runtime.root, tuning.root);
  container.append(panel);

  let sinceUpdate = 0;
  let smoothedFps = 60;
  const onUpdate = (dt: number) => {
    if (dt > 0) smoothedFps += (1 / dt - smoothedFps) * 0.08;
    sinceUpdate += dt;
    if (sinceUpdate < UPDATE_INTERVAL_S) return;
    sinceUpdate = 0;
    const out = formatInspector({ ...snapshot(), fps: smoothedFps });
    experimentRow.value.textContent = out.experimentId;
    positionRow.value.textContent = out.position;
    speedRow.value.textContent = out.speed;
    stateRow.value.textContent = out.movementState;
    fpsRow.value.textContent = out.fps;
  };
  app.on('update', onUpdate);

  return () => {
    app.off('update', onUpdate);
    panel.remove();
  };
}
