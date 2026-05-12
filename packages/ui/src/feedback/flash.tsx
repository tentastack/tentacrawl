'use client';

import { Toaster, toast } from 'sonner';

type FlashType = 'success' | 'error' | 'info' | 'warning';

const baseToastClassName =
  '!rounded-none !border !border-ink !text-foreground !shadow-[var(--shadow-brutal)] font-medium';

const toastVariantClassName: Record<FlashType, string> = {
  success: '!border-emerald-600/45 !bg-emerald-100',
  error: '!border-red-600/45 !bg-red-100',
  warning: '!border-amber-600/45 !bg-amber-100',
  info: '!border-blue-600/45 !bg-blue-100',
};

function showToast(message: string, type: FlashType) {
  const options = {
    className: `${baseToastClassName} ${toastVariantClassName[type]}`,
  };

  switch (type) {
    case 'success':
      toast.success(message, options);
      break;
    case 'error':
      toast.error(message, options);
      break;
    case 'warning':
      toast.warning(message, options);
      break;
    default:
      toast.info(message, options);
  }
}

function FlashProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: baseToastClassName,
          title: 'text-sm font-semibold tracking-tight text-foreground',
          description: 'text-sm text-foreground/75',
          closeButton: 'border border-ink/15 bg-base/80 text-foreground transition-colors hover:bg-muted hover:text-foreground',
          success: toastVariantClassName.success,
          error: toastVariantClassName.error,
          warning: toastVariantClassName.warning,
          info: toastVariantClassName.info,
        },
      }}
      offset={16}
      closeButton
    />
  );
}

// convenience wrappers
function flash(message: string, type: FlashType = 'info') {
  showToast(message, type);
}

export { FlashProvider, flash };
