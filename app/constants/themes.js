// Redesign colour tokens per mode (audit/IMPLEMENTATION_PLAN.md §10 T2).
// Dim and Lights out derive from today's dark palette in ./theme.js.
// Inside sheets, `field` uses `ground` instead (context, applied by callers).
export const MODES = {
  light: {
    ground: '#F0F0F2',
    surface: '#FFFFFF',
    ink: '#15161A',
    muted: '#66676E',
    disc: '#EEEEF1',
    divider: '#E8E8EB',
    field: '#FFFFFF',
    onField: '#15161A',
    scrim: 'rgba(21,22,26,.30)',
    grab: '#D3D4D9',
    skel: '#E2E2E6',
    accent: '#0375F6',
    onAccent: '#FFFFFF',
    link: '#0257BE',
    danger: '#B42318',
    dangerBg: '#FDECEA',
    warn: '#93370D',
    warnBg: '#FEF0C7',
    success: '#0375F6',
    tabPill: '#E6E6EA',
    tabIdle: '#75767D',
    scheme: 'light',
  },
  dim: {
    ground: '#00254E',
    surface: '#013167',
    ink: '#FFFFFF',
    muted: '#A6B7CA',
    disc: '#154173',
    divider: '#1F4A79',
    field: '#013167',
    onField: '#FFFFFF',
    scrim: 'rgba(0,0,0,.3)',
    grab: '#4D6F95',
    skel: '#1A4676',
    accent: '#0375F6',
    onAccent: '#FFFFFF',
    link: '#FFFFFF',
    danger: '#E20000',
    dangerBg: '#36243E',
    warn: '#FEF0C7',
    warnBg: '#3B2C34',
    success: '#0375F6',
    tabPill: '#1F4A79',
    tabIdle: '#99A8B8',
    scheme: 'dark',
  },
  lightsOut: {
    ground: '#000000',
    surface: '#1B1B1B',
    ink: '#FFFFFF',
    muted: '#AFAFAF',
    disc: '#2D2D2D',
    divider: '#363636',
    field: '#FFFFFF',
    onField: '#262626',
    scrim: 'rgba(0,0,0,.6)',
    grab: '#5F5F5F',
    skel: '#323232',
    accent: '#0375F6',
    onAccent: '#FFFFFF',
    link: '#FFFFFF',
    danger: '#E20000',
    dangerBg: '#360A07',
    warn: '#FEF0C7',
    warnBg: '#3B1605',
    success: '#0375F6',
    tabPill: '#363636',
    tabIdle: '#999999',
    scheme: 'dark',
  },
};

const CANARY = {ground: '#FF00FF', ink: '#00FF00'};

export const SKINS = {
  canary: {
    id: 'canary',
    name: 'Canary',
    overrides: {light: CANARY, dim: CANARY, lightsOut: CANARY},
  },
};

// Developer-only. Set DEV_SKIN to 'canary' locally; release builds always use null.
const DEV_SKIN = null;
export const ACTIVE_SKIN = __DEV__ ? DEV_SKIN : null;
