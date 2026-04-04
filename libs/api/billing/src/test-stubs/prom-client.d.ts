declare module 'prom-client' {
  export class Counter<TLabel extends string = string> {
    constructor(config: unknown);
    inc(labelsOrValue?: Record<TLabel, string> | number, value?: number): void;
  }

  export interface Registry {
    contentType: string;
    metrics: () => Promise<string>;
  }

  export const register: Registry;

  export function collectDefaultMetrics(config?: unknown): void;
}
