import { create } from 'zustand';

type DialogOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string; // For prompt
};

type DialogState = {
  isAlertOpen: boolean;
  alertOptions: DialogOptions;
  alertResolver: (() => void) | null;

  isConfirmOpen: boolean;
  confirmOptions: DialogOptions;
  confirmResolver: ((result: boolean) => void) | null;

  isPromptOpen: boolean;
  promptOptions: DialogOptions;
  promptResolver: ((result: string | null) => void) | null;

  showAlert: (message: string, title?: string) => Promise<void>;
  closeAlert: () => void;
  showConfirm: (message: string, title?: string, confirmText?: string) => Promise<boolean>;
  closeConfirm: (result: boolean) => void;
  showPrompt: (message: string, title?: string, defaultValue?: string) => Promise<string | null>;
  closePrompt: (result: string | null) => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  isAlertOpen: false,
  alertOptions: { message: '' },
  alertResolver: null,

  isConfirmOpen: false,
  confirmOptions: { message: '' },
  confirmResolver: null,

  showAlert: (message, title) => {
    return new Promise((resolve) => {
      set({
        isAlertOpen: true,
        alertOptions: { message, title },
        alertResolver: resolve,
      });
    });
  },
  closeAlert: () => {
    set((state) => {
      if (state.alertResolver) state.alertResolver();
      return { isAlertOpen: false, alertResolver: null };
    });
  },

  showConfirm: (message, title, confirmText) => {
    return new Promise((resolve) => {
      set({
        isConfirmOpen: true,
        confirmOptions: { message, title, confirmText },
        confirmResolver: resolve,
      });
    });
  },
  closeConfirm: (result) => {
    set((state) => {
      if (state.confirmResolver) state.confirmResolver(result);
      return { isConfirmOpen: false, confirmResolver: null };
    });
  },

  isPromptOpen: false,
  promptOptions: { message: '' },
  promptResolver: null,

  showPrompt: (message, title, defaultValue) => {
    return new Promise((resolve) => {
      set({
        isPromptOpen: true,
        promptOptions: { message, title, defaultValue },
        promptResolver: resolve,
      });
    });
  },
  closePrompt: (result) => {
    set((state) => {
      if (state.promptResolver) state.promptResolver(result);
      return { isPromptOpen: false, promptResolver: null };
    });
  },
}));
