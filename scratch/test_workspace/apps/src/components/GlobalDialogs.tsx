"use client";

import { useDialogStore } from "@/lib/dialogStore";
import { CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";

export function GlobalDialogs() {
  const {
    isAlertOpen,
    alertOptions,
    closeAlert,
    isConfirmOpen,
    confirmOptions,
    closeConfirm,
    isPromptOpen,
    promptOptions,
    closePrompt,
  } = useDialogStore();

  const [promptValue, setPromptValue] = useState("");
  useEffect(() => {
    if (isPromptOpen) {
      setPromptValue(promptOptions.defaultValue || "");
    }
  }, [isPromptOpen, promptOptions.defaultValue]);

  return (
    <>
      {/* Alert Modal */}
      {isAlertOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {alertOptions.title || "Perhatian"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                {alertOptions.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={closeAlert}
                className="w-full py-2.5 px-4 bg-suka-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-colors active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-suka-orange/10 text-suka-orange rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {confirmOptions.title || "Konfirmasi"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                {confirmOptions.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
              <button
                onClick={() => closeConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className="flex-1 py-2.5 px-4 bg-suka-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-colors active:scale-95"
              >
                {confirmOptions.confirmText || "Ya, Yakin"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Prompt Modal */}
      {isPromptOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {promptOptions.title || "Input"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 whitespace-pre-wrap">
                {promptOptions.message}
              </p>
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                autoFocus
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') closePrompt(promptValue);
                  if (e.key === 'Escape') closePrompt(null);
                }}
              />
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
              <button
                onClick={() => closePrompt(null)}
                className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={() => closePrompt(promptValue)}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors active:scale-95"
              >
                {promptOptions.confirmText || "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
