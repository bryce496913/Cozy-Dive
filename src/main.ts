import './style.css';
import { Application } from './app/Application';

const app = new Application(document.querySelector<HTMLDivElement>('#app')!);
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
