import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useState,
} from 'react';
import {View} from 'react-native';
import {Toast} from '../app/screens/toast';

const ToastContext = createContext();

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

export const ToastProvider = ({children}) => {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  const showToast = toast => {
    const id = Date.now() + Math.random();
    const toastWithId = {
      id,
      type: 'success',
      duration: 3000,
      position: 'top',
      ...toast,
    };

    dispatch({type: 'ADD_TOAST', payload: toastWithId});

    if (toastWithId.duration > 0) {
      setTimeout(() => {
        dispatch({type: 'REMOVE_TOAST', payload: id});
      }, toastWithId.duration);
    }

    return id;
  };

  const hideToast = id => {
    dispatch({type: 'REMOVE_TOAST', payload: id});
  };

  const clearToasts = () => {
    dispatch({type: 'CLEAR_TOASTS'});
  };

  return (
    <ToastContext.Provider
      value={{
        toasts: state.toasts,
        showToast,
        hideToast,
        clearToasts,
      }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastContainer = () => {
  const {toasts, hideToast} = useToast();

  return (
    <View pointerEvents="box-none">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onHide={() => hideToast(toast.id)}
        />
      ))}
    </View>
  );
};
