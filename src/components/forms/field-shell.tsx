"use client";

import { useId } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

export type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

/** Label + description + errors around any control (select, textarea, custom). */
export function FieldShell({
  label,
  description,
  errors,
  children,
  className,
}: {
  label: string;
  description?: React.ReactNode;
  errors?: string[];
  children: (control: ControlProps) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const invalid = !!errors?.length;
  const describedBy = [description ? `${id}-desc` : null, invalid ? `${id}-err` : null].filter(Boolean).join(" ");
  return (
    <Field data-invalid={invalid || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        "aria-invalid": invalid || undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
      {invalid ? <FieldError id={`${id}-err`} errors={errors!.map((message) => ({ message }))} /> : null}
    </Field>
  );
}
