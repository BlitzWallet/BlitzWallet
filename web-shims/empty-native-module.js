// Generic stub for deferred-feature native modules (Liquid/Breez, maps,
// notifications, background tasks, view-shot, etc). Any named import resolves
// to a no-op function or a null-rendering component, so screens that import
// these compile and only fail if the user actually navigates to them — and
// those entry points are hidden on web (navigation/settings filters).
import React from 'react';

const noop = () => {};
// A callable that also renders its children when used as a JSX component.
// For wrapper components like ViewShot, this ensures the wrapped content
// (e.g. QR code) remains visible on web instead of disappearing.
// Must remain a plain function (not forwardRef) so the Proxy `apply` trap
// keeps named imports like `createPdf` callable.
function NullComponent(props) {
  return props?.children ?? null;
}
NullComponent.displayName = 'EmptyNativeStub';

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return stub;
    if (prop === Symbol.toPrimitive) return () => '';
    if (prop in target) return target[prop];
    // Return a dual-purpose stub: callable (returns undefined) AND a valid
    // React component (renders children) AND further proxyable.
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
    apply(target, thisArg, args) {
      // When used as a component (e.g. <ViewShot>), preserve children so
      // wrapped content (QR) stays visible on web. For plain function calls
      // like createPdf({imagePaths}), there are no children so this returns
      // undefined.
      const props = args[0];
      return props?.children ?? undefined;
    },
    construct() {
      return {};
    },
  },
);

const proxy = new Proxy({ noop }, handler);

export default stub;
export const __isEmptyNativeModuleStub = true;
// Explicit named exports for modules that use named imports (e.g.
// `import { createPdf } from 'react-native-pdf-from-image'`). ESM named
// imports resolve statically, so the generic Proxy cannot trap them.
export const createPdf = stub;
