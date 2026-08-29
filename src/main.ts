import { bootstrap } from './shell/bootstrap.ts';
import './style.css';

const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
await bootstrap(canvas);
