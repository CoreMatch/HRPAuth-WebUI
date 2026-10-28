export const RECOVERY_KEY_PRINT_ACTIVE_CLASS = 'rk-print-active';

const PRINT_ROOT_CLASS = 'rk-print-root';

/**
 * 恢复密钥打印纸张挂载在 body 下的独立容器中，
 * 便于打印时隐藏应用其余内容（对话框本身也运行在 Portal 中）。
 */
export const getRecoveryKeyPrintRoot = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const existing = document.querySelector<HTMLElement>(`.${PRINT_ROOT_CLASS}`);
  if (existing) return existing;
  const root = document.createElement('div');
  root.className = PRINT_ROOT_CLASS;
  document.body.appendChild(root);
  return root;
};

/**
 * 临时标记页面处于“打印恢复密钥”状态并唤起浏览器打印。
 */
export const printRecoveryKey = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  document.body.classList.add(RECOVERY_KEY_PRINT_ACTIVE_CLASS);
  const cleanup = () => {
    document.body.classList.remove(RECOVERY_KEY_PRINT_ACTIVE_CLASS);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  // 兜底：部分浏览器不会触发 afterprint，避免打印状态残留影响后续打印。
  window.setTimeout(cleanup, 30000);
  window.requestAnimationFrame(() => {
    window.print();
  });
};
