"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<typeof Input>, "id"> & {
  label: string;
  description?: string;
  errors?: string[];
};

export function TextField({ label, description, errors, type, dir, ...inputProps }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const invalid = !!errors?.length;
  const describedBy = [description ? `${id}-desc` : null, invalid ? `${id}-err` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && visible ? "text" : type}
          dir={dir ?? (type === "email" || isPassword ? "ltr" : undefined)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          className={isPassword ? "pe-10 text-start" : type === "email" ? "text-start" : undefined}
          {...inputProps}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
            aria-pressed={visible}
            className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-lg text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        ) : null}
      </div>
      {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
      {invalid ? <FieldError id={`${id}-err`} errors={errors!.map((message) => ({ message }))} /> : null}
    </Field>
  );
}
