export { cn, initialsFromName } from "./lib/utils";

export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Input } from "./components/input";
export { Textarea } from "./components/textarea";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/card";
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";
export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetDescription,
} from "./components/bottom-sheet";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { Skeleton } from "./components/skeleton";
export { Switch } from "./components/switch";
export { Toaster, toast } from "./components/toast";
export { ProgressBar, type ProgressBarProps } from "./components/progress-bar";
export { SettingsRow, type SettingsRowProps } from "./components/settings-row";
export {
  FilterPills,
  type FilterPillOption,
  type FilterPillsProps,
} from "./components/filter-pills";
export {
  CalendarPicker,
  type CalendarPickerProps,
} from "./components/calendar-picker";
export { NoteCard, type NoteCardProps } from "./components/note-card";
export {
  SwipeableRow,
  type SwipeableRowAction,
  type SwipeableRowProps,
} from "./components/swipeable-row";
export {
  RecordButton,
  TransportButton,
  type RecordButtonProps,
  type RecordButtonState,
  type TransportButtonProps,
} from "./components/record-button";
export {
  WaveformVisualizer,
  type WaveformVisualizerProps,
} from "./components/waveform-visualizer";
export { OptionCard, type OptionCardProps } from "./components/option-card";
export {
  PhotoUploader,
  PhotoThumbnailStrip,
  type PhotoUploaderPhoto,
  type PhotoUploaderProps,
  type PhotoThumbnailStripProps,
} from "./components/photo-uploader";
// RichTextEditor is deliberately NOT re-exported here. It's the one
// component in this package that pulls in Lexical's full dependency tree
// (~90kB+), and every consumer of the shared barrel — nearly every page in
// apps/web — would otherwise bundle that weight whether or not it actually
// uses the editor. Import it directly via "@mindreva/ui/rich-text-editor"
// (see entry-detail.tsx's next/dynamic usage), the same isolation pattern
// already used for @mindreva/ui/toast.
export {
  TaskChecklist,
  type TaskChecklistTask,
  type TaskChecklistProps,
} from "./components/task-checklist";
export {
  Logo,
  LeafMark,
  type LogoProps,
  type LeafMarkProps,
} from "./components/logo";
