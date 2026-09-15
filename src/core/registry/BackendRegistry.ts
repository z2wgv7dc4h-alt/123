import type { AudioBackend, HardwareProbe } from '../types';
import { aceStepBackend, offlineStubBackend } from '../backends';

export class BackendRegistry {
  private backends = new Map<string, AudioBackend>();
  private activeId: string;

  constructor(initial: AudioBackend[] = [offlineStubBackend, aceStepBackend]) {
    for (const b of initial) this.backends.set(b.id, b);
    this.activeId = offlineStubBackend.id;
  }

  list(): AudioBackend[] {
    return [...this.backends.values()];
  }

  get(id: string): AudioBackend | undefined {
    return this.backends.get(id);
  }

  register(backend: AudioBackend): void {
    this.backends.set(backend.id, backend);
  }

  setActive(id: string): void {
    if (!this.backends.has(id)) throw new Error(`Unknown backend: ${id}`);
    this.activeId = id;
  }

  active(): AudioBackend {
    const b = this.backends.get(this.activeId);
    if (!b) throw new Error('No active backend');
    return b;
  }

  /** Prefer OfflineStub until AceStep probe reports GPU. */
  async selectBest(): Promise<AudioBackend> {
    const ace = this.backends.get(aceStepBackend.id);
    if (ace) {
      const probe: HardwareProbe = await ace.probe();
      if (probe.hasGpu) {
        this.activeId = ace.id;
        return ace;
      }
    }
    this.activeId = offlineStubBackend.id;
    return offlineStubBackend;
  }
}

export const backendRegistry = new BackendRegistry();
