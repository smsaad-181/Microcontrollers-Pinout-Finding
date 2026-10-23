// Web Worker entry: exposes the engine host over Comlink. The engine never runs on the main thread.
import { expose } from 'comlink';
import { createEngineHost } from './engineHost';

expose(createEngineHost(() => performance.now()));
