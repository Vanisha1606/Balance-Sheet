import { isPlatform } from '@ionic/react';
import type { TemplateMeta } from '../services/local-template-service';
import { isIphoneLandscapeLayout } from './iphoneLandscape';

/** True on iPad and iPhone landscape (wide balance-sheet layout). */
export function isTabletDevice(): boolean {
  if (isPlatform('ipad') || isPlatform('tablet')) return true;
  if (isIphoneLandscapeLayout()) return true;
  return window.innerWidth >= 768;
}

export function pickTemplateIdForDevice(items: TemplateMeta[]): number | string | null {
  const mobile = items.find((t) => t.device === 'mobile');
  const tablet = items.find((t) => t.device === 'tablet');
  if (isTabletDevice() && tablet) return tablet.id;
  if (mobile) return mobile.id;
  return items[0]?.id ?? null;
}
