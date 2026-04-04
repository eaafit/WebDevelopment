export class Counter<TLabel extends string = string> {
  constructor(_config: unknown) {
    void _config;
  }

  inc(_labelsOrValue?: Record<TLabel, string> | number, _value?: number): void {
    void _labelsOrValue;
    void _value;
  }
}

export interface Registry {
  contentType: string;
  metrics: () => Promise<string>;
}

export const register: Registry = {
  contentType: 'text/plain; version=0.0.4',
  metrics: async () => '',
};

export function collectDefaultMetrics(_config?: unknown): void {
  void _config;
}
