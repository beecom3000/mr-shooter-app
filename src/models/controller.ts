import type { XRController } from 'iwer/lib/device/XRController';

export interface Controller {
  none?: XRController | undefined;
  left?: XRController | undefined;
  right?: XRController | undefined;
}
