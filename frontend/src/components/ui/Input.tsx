/**
 * App-facing Input — re-exports the canonical design-system Input / Textarea.
 */
export { Input } from "../../design-system/components/Input";
export type { InputProps } from "../../design-system/components/Input";

export { Textarea as TextArea } from "../../design-system/components/Textarea";
export type { TextareaProps as TextAreaProps } from "../../design-system/components/Textarea";

/** Class string for gradual migration of existing `inputClassName` / `ds-field-input` usages. */
export { fieldControlClassName as inputFieldClassName } from "../../design-system/components/fieldStyles";
