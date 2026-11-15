import { z } from "zod";

/** Result returned by every form Server Action. */
export type FormState = {
  ok: boolean;
  /** Message for the whole form (success or error). */
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed non-secret values so the form keeps what the user typed. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { ok: false };

export function validationError(error: z.ZodError, values?: Record<string, string>): FormState {
  return {
    ok: false,
    message: "יש לתקן את השדות המסומנים",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    values,
  };
}

export function formValues(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
