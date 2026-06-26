import { Capacitor } from '@capacitor/core';
import { isPlatform } from '@ionic/react';

/** Native or web iPhone (not iPad). */
export function isNativeIphone(): boolean {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    return (
      isPlatform('iphone') ||
      (isPlatform('mobile') && !isPlatform('ipad') && !isPlatform('tablet'))
    );
  }
  return isPlatform('iphone');
}

/** iPhone layout should use landscape / tablet-style UI. */
export function isIphoneLandscapeLayout(): boolean {
  if (isNativeIphone()) return true;
  if (isPlatform('iphone')) return window.innerWidth > window.innerHeight;
  return false;
}

export function applyIphoneLandscapeClass(): void {
  if (typeof document === 'undefined') return;
  const active = isIphoneLandscapeLayout();
  document.documentElement.classList.toggle('iphone-landscape', active);
  document.body.classList.toggle('iphone-landscape', active);
}

export function watchIphoneLandscapeClass(): () => void {
  applyIphoneLandscapeClass();
  const onChange = () => applyIphoneLandscapeClass();
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}
