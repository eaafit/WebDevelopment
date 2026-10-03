import { Injectable } from '@angular/core';

const YOOKASSA_WIDGET_SCRIPT_URL = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';

export interface YooKassaWidgetHandlers {
  onSuccess: () => void;
  onFail: () => void;
  onComplete: () => void;
  onClose: () => void;
  onError: (error: unknown) => void;
}

export interface YooKassaWidgetSession {
  destroy: () => void;
}

interface YooMoneyCheckoutWidgetConstructor {
  new (options: {
    confirmation_token: string;
    error_callback: (error: unknown) => void;
  }): YooMoneyCheckoutWidgetInstance;
}

interface YooMoneyCheckoutWidgetInstance {
  render: (containerId: string) => void;
  on?: (eventName: 'success' | 'fail' | 'complete' | 'modal_close', callback: () => void) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    YooMoneyCheckoutWidget?: YooMoneyCheckoutWidgetConstructor;
  }
}

@Injectable({ providedIn: 'root' })
export class YooKassaWidgetService {
  private loadPromise: Promise<YooMoneyCheckoutWidgetConstructor> | null = null;

  async mount(
    containerId: string,
    confirmationToken: string,
    handlers: YooKassaWidgetHandlers,
  ): Promise<YooKassaWidgetSession> {
    const WidgetConstructor = await this.loadWidgetConstructor();
    const widget = new WidgetConstructor({
      confirmation_token: confirmationToken,
      error_callback: handlers.onError,
    });

    widget.on?.('success', handlers.onSuccess);
    widget.on?.('fail', handlers.onFail);
    widget.on?.('complete', handlers.onComplete);
    widget.on?.('modal_close', handlers.onClose);
    widget.render(containerId);

    return {
      destroy: () => widget.destroy?.(),
    };
  }

  private loadWidgetConstructor(): Promise<YooMoneyCheckoutWidgetConstructor> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('YooKassa widget can only be loaded in the browser'));
    }

    if (window.YooMoneyCheckoutWidget) {
      return Promise.resolve(window.YooMoneyCheckoutWidget);
    }

    if (!this.loadPromise) {
      this.loadPromise = new Promise<YooMoneyCheckoutWidgetConstructor>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
          `script[src="${YOOKASSA_WIDGET_SCRIPT_URL}"]`,
        );

        if (existingScript) {
          existingScript.addEventListener('load', () => {
            if (window.YooMoneyCheckoutWidget) {
              resolve(window.YooMoneyCheckoutWidget);
              return;
            }
            reject(new Error('YooKassa widget script loaded without constructor'));
          });
          existingScript.addEventListener('error', () => {
            reject(new Error('Failed to load YooKassa widget script'));
          });
          return;
        }

        const script = document.createElement('script');
        script.src = YOOKASSA_WIDGET_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
          if (window.YooMoneyCheckoutWidget) {
            resolve(window.YooMoneyCheckoutWidget);
            return;
          }
          reject(new Error('YooKassa widget script loaded without constructor'));
        };
        script.onerror = () => reject(new Error('Failed to load YooKassa widget script'));
        document.head.appendChild(script);
      }).catch((error) => {
        this.loadPromise = null;
        throw error;
      });
    }

    return this.loadPromise;
  }
}
