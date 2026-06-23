import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('../../app/functions/login/loadLoginState', () => ({
  loadLoginState: jest.fn(),
}));
const { loadLoginState } = require('../../app/functions/login/loadLoginState');

const { LoginProvider, useLoginContext } = require('../../context-store/loginContext');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Tiny consumer that writes the latest context value into an outer ref so
// assertions can read it synchronously after act() flushes.
function makeConsumer(valueRef) {
  return function Consumer() {
    valueRef.current = useLoginContext();
    return null;
  };
}

function renderWithProvider(valueRef) {
  const Consumer = makeConsumer(valueRef);
  // Callers own the act() boundary — no inner act() here.
  return ReactTestRenderer.create(
    <LoginProvider>
      <Consumer />
    </LoginProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const MOCK_STATE_A = {
  hasAccount: true,
  isSecurityEnabled: true,
  isPinEnabled: true,
  isBiometricEnabled: false,
};
const MOCK_STATE_B = {
  hasAccount: true,
  isSecurityEnabled: false,
  isPinEnabled: false,
  isBiometricEnabled: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// 1. loadLoginState is called exactly once on mount
test('calls loadLoginState exactly once on mount', async () => {
  loadLoginState.mockResolvedValue({ loginState: MOCK_STATE_A, loginRoute: 'PIN' });

  const valueRef = { current: null };
  await act(async () => {
    renderWithProvider(valueRef);
  });

  expect(loadLoginState).toHaveBeenCalledTimes(1);
});

// 2. Before the load resolves: isLoaded === false, loginRoute === null
test('exposes isLoaded=false and loginRoute=null before the load resolves', async () => {
  // Use a promise we control so we can read the synchronous initial value
  // before resolving it.
  let resolveLoad;
  loadLoginState.mockReturnValue(
    new Promise(res => {
      resolveLoad = res;
    }),
  );

  const valueRef = { current: null };
  // Synchronous render only — do NOT await or flush the promise yet.
  act(() => {
    ReactTestRenderer.create(
      <LoginProvider>
        {React.createElement(makeConsumer(valueRef))}
      </LoginProvider>,
    );
  });

  expect(valueRef.current.isLoaded).toBe(false);
  expect(valueRef.current.loginRoute).toBeNull();

  // Resolve to flush the pending state updates through act to avoid warnings.
  await act(async () => {
    resolveLoad({ loginState: MOCK_STATE_A, loginRoute: 'PIN' });
  });
});

// 3. After the load resolves: isLoaded === true, loginRoute and loginState set
test('sets isLoaded=true with route and state after the load resolves', async () => {
  loadLoginState.mockResolvedValue({ loginState: MOCK_STATE_A, loginRoute: 'PIN' });

  const valueRef = { current: null };
  await act(async () => {
    renderWithProvider(valueRef);
  });

  expect(valueRef.current.isLoaded).toBe(true);
  expect(valueRef.current.loginRoute).toBe('PIN');
  expect(valueRef.current.loginState).toEqual(MOCK_STATE_A);
});

// 4. refreshLoginState re-runs loadLoginState with a new result; isLoaded stays true
test('refreshLoginState updates route/state without flipping isLoaded to false', async () => {
  loadLoginState.mockResolvedValueOnce({ loginState: MOCK_STATE_A, loginRoute: 'PIN' });

  const valueRef = { current: null };
  await act(async () => {
    renderWithProvider(valueRef);
  });

  // Initial state confirmed loaded
  expect(valueRef.current.isLoaded).toBe(true);
  expect(valueRef.current.loginRoute).toBe('PIN');

  // Mock a different result for the refresh call
  loadLoginState.mockResolvedValueOnce({ loginState: MOCK_STATE_B, loginRoute: 'NO_LOGIN' });

  await act(async () => {
    await valueRef.current.refreshLoginState();
  });

  // isLoaded must NOT have flipped to false
  expect(valueRef.current.isLoaded).toBe(true);
  expect(valueRef.current.loginRoute).toBe('NO_LOGIN');
  expect(valueRef.current.loginState).toEqual(MOCK_STATE_B);
  expect(loadLoginState).toHaveBeenCalledTimes(2);
});

// 5. StrictMode / ref-latch: loadLoginState is not called more than once even if
//    React double-invokes the mount effect.
test('does not call loadLoginState more than once even under effect double-invoke', async () => {
  loadLoginState.mockResolvedValue({ loginState: MOCK_STATE_A, loginRoute: 'PIN' });

  const valueRef = { current: null };
  const Consumer = makeConsumer(valueRef);

  await act(async () => {
    // React.StrictMode intentionally double-invokes effects in dev to catch
    // side-effect bugs. Our ref latch must prevent a second call.
    ReactTestRenderer.create(
      <React.StrictMode>
        <LoginProvider>
          <Consumer />
        </LoginProvider>
      </React.StrictMode>,
    );
  });

  expect(loadLoginState).toHaveBeenCalledTimes(1);
});

// 6. Race guard: a stale initial load that resolves AFTER a refresh must NOT
//    overwrite the fresher data written by the refresh.
test('stale initial load result is discarded when refresh resolves first', async () => {
  // Promise A simulates the slow initial load (mount effect).
  // Promise B simulates a faster refresh triggered before A resolves.
  let resolveA;
  let resolveB;
  const promiseA = new Promise(res => { resolveA = res; });
  const promiseB = new Promise(res => { resolveB = res; });

  loadLoginState
    .mockReturnValueOnce(promiseA) // first call: initial mount
    .mockReturnValueOnce(promiseB); // second call: refresh

  const valueRef = { current: null };

  // Mount — A starts in flight, nothing resolves yet.
  act(() => {
    renderWithProvider(valueRef);
  });

  // Trigger refresh — B starts in flight while A is still pending.
  let refreshDone;
  act(() => {
    refreshDone = valueRef.current.refreshLoginState();
  });

  // Resolve B first with the FRESHER data.
  await act(async () => {
    resolveB({ loginState: MOCK_STATE_B, loginRoute: 'BIOMETRIC' });
    await refreshDone;
  });

  expect(valueRef.current.loginRoute).toBe('BIOMETRIC');

  // Now resolve A (stale) — should be discarded by the load-sequence counter.
  await act(async () => {
    resolveA({ loginState: MOCK_STATE_A, loginRoute: 'PIN' });
  });

  // Final state must still be the fresher BIOMETRIC result.
  expect(valueRef.current.loginRoute).toBe('BIOMETRIC');
  expect(valueRef.current.loginState).toEqual(MOCK_STATE_B);
  // isLoaded must be true (set by the initial-load path, even though stale result is discarded)
  expect(valueRef.current.isLoaded).toBe(true);
});

// 7. useLoginContext() throws when used outside a LoginProvider.
//    Uses a class error boundary to capture the thrown error so React 19's
//    root-level catching doesn't swallow it before we can assert on it.
test('useLoginContext throws when used outside LoginProvider', () => {
  class Boundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(err) {
      return { error: err };
    }
    render() {
      if (this.state.error) return null;
      return this.props.children;
    }
  }

  function Bare() {
    useLoginContext();
    return null;
  }

  const originalError = console.error;
  console.error = () => {};
  let renderer;
  try {
    act(() => {
      renderer = ReactTestRenderer.create(
        <Boundary>
          <Bare />
        </Boundary>,
      );
    });
  } finally {
    console.error = originalError;
  }

  const instance = renderer.getInstance();
  expect(instance.state.error).not.toBeNull();
  expect(instance.state.error.message).toBe(
    'useLoginContext must be used within a LoginProvider',
  );
});
