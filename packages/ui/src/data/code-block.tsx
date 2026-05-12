'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../primitives/button';
import { cn } from '../lib/utils';

type CodeBlockTone = 'default' | 'error';

export interface CodeBlockProps extends React.ComponentProps<'div'> {
  code: string;
  copyable?: boolean;
  tone?: CodeBlockTone;
  copiedLabel?: string;
  copyLabel?: string;
  viewportClassName?: string;
  codeClassName?: string;
}

const toneClasses: Record<CodeBlockTone, string> = {
  default: 'border-ink/10 bg-base text-foreground',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
};

const scrollbarToneClasses: Record<CodeBlockTone, string> = {
  default: 'tc-scrollbar',
  error: 'tc-scrollbar tc-scrollbar-destructive',
};

export function CodeBlock({
  code,
  copyable = false,
  tone = 'default',
  copiedLabel = 'Copied',
  copyLabel = 'Copy',
  className,
  viewportClassName,
  codeClassName,
  ...props
}: CodeBlockProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      window.setTimeout(() => {
        setIsCopied(false);
      }, 1500);
    } catch {
      setIsCopied(false);
    }
  }, [code]);

  return (
    <div className={cn('relative min-w-0', className)} {...props}>
      {copyable ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-events-auto h-7 gap-1 rounded-none border-0 bg-surface px-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-foreground shadow-none backdrop-blur-[2px] hover:bg-base hover:text-foreground"
            onClick={() => {
              void handleCopy();
            }}
          >
            {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span className="pl-1">{isCopied ? copiedLabel : copyLabel}</span>
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          'min-w-0 max-w-full overflow-x-auto overflow-y-auto border p-4 text-xs',
          toneClasses[tone],
          scrollbarToneClasses[tone],
          copyable ? 'pr-20' : null,
          viewportClassName,
        )}
      >
        <pre className={cn('w-fit min-w-full whitespace-pre font-mono leading-5', codeClassName)}>{code}</pre>
      </div>
    </div>
  );
}