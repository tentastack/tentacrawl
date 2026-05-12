// @tentacrawl/ui — shared UI component library
// Primitives
export { Button, buttonVariants } from './primitives/button';
export type { ButtonProps } from './primitives/button';
export { Input } from './primitives/input';
export { Textarea } from './primitives/textarea';
export { Label } from './primitives/label';
export { Badge, badgeVariants } from './primitives/badge';
export type { BadgeProps } from './primitives/badge';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './primitives/card';
export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from './primitives/dialog';
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectItem, SelectLabel, SelectSeparator,
} from './primitives/select';
export { Switch } from './primitives/switch';
export { Checkbox } from './primitives/checkbox';
export { Separator } from './primitives/separator';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './primitives/tabs';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './primitives/tooltip';
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup,
} from './primitives/dropdown-menu';
export { Spinner } from './primitives/spinner';
export { Panel, PanelHeader, PanelTitle, PanelContent } from './primitives/panel';
export {
  Table, TableHeader, TableBody, TableFooter, TableHead,
  TableRow, TableCell, TableCaption,
} from './primitives/table';

// Layout
export { AppShell } from './layout/app-shell';
export type { AppShellProps, AppShellBrand, AppShellSearch, AppShellHeaderAction } from './layout/app-shell';
export { Page, PageHeader, PageBody } from './layout/page';
export { Sidebar } from './layout/sidebar';
export type { SidebarNavItem, SidebarNavItemChild, SidebarFooterItem } from './layout/sidebar';

// Data display
export { DataTable } from './data/data-table';
export type { DataTableProps, DataTableSort, PaginationState } from './data/data-table';
export { CodeBlock } from './data/code-block';
export type { CodeBlockProps } from './data/code-block';
export { FilterBar } from './data/filter-bar';
export type { FilterDef } from './data/filter-bar';
export { EmptyState } from './data/empty-state';
export { StatCard } from './data/stat-card';
export type { StatCardProps, Trend } from './data/stat-card';
export { StatusDot } from './data/status-dot';
export type { StatusDotProps, DotStatus, DotSize } from './data/status-dot';
export {
  ArtefactViewer,
} from './data/artefact-viewer';
export type {
  ArtefactViewerProps,
  ArtefactTab,
} from './data/artefact-viewer';

// Forms
export { CrudForm } from './form/crud-form';
export type { CrudField, CrudFieldOption, CrudFormGroup, CrudFieldType } from './form/crud-form';
export { HeaderMapField, LocaleField, NetworkPolicyField, TimezoneField } from './form/request-config-fields';

// Feedback
export { FlashProvider, flash } from './feedback/flash';
export { DataLoader } from './feedback/data-loader';

// Theme
export { ThemeProvider, useTheme } from './theme/theme-provider';
export type { Theme } from './theme/theme-provider';

// Lib
export { cn } from './lib/utils';
export { configureApiClient, apiCall, apiCallOrThrow } from './lib/api-client';
export { prettifyHtml, formatRunEnvironment, formatUserAgent } from './lib/code-format';
export { timeAgo, formatDuration, formatDurationExact, computeDuration, formatTimestamp } from './lib/time';
export { queryWithTimeout } from './lib/query-with-timeout';

// Hooks
export { useIsMobile } from './hooks/use-is-mobile';
export { useDebouncedValue } from './hooks/use-debounced-value';
