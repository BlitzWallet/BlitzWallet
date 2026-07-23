// Generic stub for deferred-feature native modules (Liquid/Breez, maps,
// notifications, background tasks, view-shot, etc). Any named import resolves
// to a no-op function or a null-rendering component, so screens that import
// these compile and only fail if the user actually navigates to them — and
// those entry points are hidden on web (navigation/settings filters).
import React from 'react';

const noop = () => {};
// A callable that also renders nothing when used as a JSX component.
function NullComponent() {
  return null;
}

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return proxy;
    if (prop === Symbol.toPrimitive) return () => '';
    if (prop in target) return target[prop];
    // Return a dual-purpose stub: callable (returns undefined) AND a valid
    // React component (renders null) AND further proxyable.
    return stub;
  },
};

const stub = new Proxy(
  Object.assign(NullComponent, { __isEmptyNativeModuleStub: true }),
  {
    get(target, prop) {
      if (prop === '__esModule') return true;
      return handler.get(target, prop);
    },
    apply() {
      return undefined;
    },
    construct() {
      return {};
    },
  },
);

const proxy = new Proxy({ noop }, handler);

export default proxy;
export const __isEmptyNativeModuleStub = true;
