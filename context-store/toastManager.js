import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
} from 'react';

const ToastStateContext = createContext();
const ToastActionsContext = createContext();

const initialState = {
  toasts: [],
};

const toastReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload),
      };
    case 'CLEAR_TOASTS':
      return {
        ...state,
        toasts: [],
      };
    default:
      return state;
  }
};

export const ToastProvider = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  const showToast = useCallback(toast => {
    const id = Date.now() + Math.random();
    const toastWithId = {
      id,
      type: 'success',
      duration: 3000,
      position: 'top',
      ...toast,
    };

    dispatch({ type: 'ADD_TOAST', payload: toastWithId });

    if (toastWithId.duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
      }, toastWithId.duration);
    }

    return id;
  }, []);

  const hideToast = useCallback(id => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const clearToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  const actionsValue = useMemo(
    () => ({ showToast, hideToast, clearToasts }),
    [showToast, hideToast, clearToasts],
  );
  const stateValue = useMemo(() => ({ toasts: state.toasts }), [state.toasts]);

  return (
    <ToastActionsContext.Provider value={actionsValue}>
      <ToastStateContext.Provider value={stateValue}>
        {children}
      </ToastStateContext.Provider>
    </ToastActionsContext.Provider>
  );
};

export const useToast = () => {
  const stateContext = useContext(ToastStateContext);
  const actionsContext = useContext(ToastActionsContext);
  if (!stateContext || !actionsContext) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return { ...stateContext, ...actionsContext };
};

export const useToastActions = () => {
  const context = useContext(ToastActionsContext);
  if (!context) {
    throw new Error('useToastActions must be used within a ToastProvider');
  }
  return context;
};
