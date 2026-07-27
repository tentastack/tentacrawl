'use client';

import * as React from 'react';
import {
  Button,
  DataLoader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@tentacrawl/ui';
import { Settings } from 'lucide-react';
import {
  PROXY_EXTENSION_KEY,
  useProxyExtensionConfig,
  useSaveProxyExtensionConfig,
  type ProxyExtensionConfigValues,
} from '../hooks/use-proxy-servers';

export function ExtensionSettingsDialog() {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, error } = useProxyExtensionConfig();
  const saveConfig = useSaveProxyExtensionConfig();
  const [draft, setDraft] = React.useState<ProxyExtensionConfigValues | null>(null);

  const config = draft ?? data;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(null);
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Settings className="mr-2 h-3.5 w-3.5" />
        Extension Settings
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Extension Settings</DialogTitle>
          <DialogDescription>
            Runtime behavior of the <span className="font-mono">{PROXY_EXTENSION_KEY}</span>{' '}
            challenger extension. Changes apply on the next run.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 text-sm">
          <DataLoader isLoading={isLoading} error={error}>
            {config && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proxy-rotation">Endpoint rotation</Label>
                  <Select
                    value={config.rotation}
                    onValueChange={(rotation) =>
                      setDraft({ ...config, rotation: rotation as ProxyExtensionConfigValues['rotation'] })
                    }
                  >
                    <SelectTrigger id="proxy-rotation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">Round robin (least recently used)</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="proxy-blocked-failure">Count blocked runs as failures</Label>
                    <p className="text-xs text-muted-foreground">
                      BLOCKED outcomes increment the endpoint failure counter.
                    </p>
                  </div>
                  <Switch
                    id="proxy-blocked-failure"
                    checked={config.countBlockedAsFailure}
                    onCheckedChange={(countBlockedAsFailure) =>
                      setDraft({ ...config, countBlockedAsFailure })
                    }
                  />
                </div>
              </div>
            )}
          </DataLoader>
        </div>
        <DialogFooter>
          <Button
            disabled={!draft || saveConfig.isPending}
            onClick={() => {
              if (draft) {
                saveConfig.mutate(draft, {
                  onSuccess: () => {
                    setDraft(null);
                    setOpen(false);
                  },
                });
              }
            }}
          >
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
