"use client";

import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type PickerGuest = { id: string; first_name: string; last_name: string; phone: string | null };

const fullName = (g: PickerGuest) => `${g.first_name} ${g.last_name}`.trim();

/** Searchable guest selector; submits the chosen id as a hidden form field. */
export function GuestPicker({
  name,
  guests,
  defaultValue,
  id,
  invalid,
}: {
  name: string;
  guests: PickerGuest[];
  defaultValue?: string | null;
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const selected = guests.find((g) => g.id === value);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className="h-10 w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? fullName(selected) : "ללא שיוך לאורח"}
            </span>
            <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              const q = search.trim().toLowerCase();
              const digits = q.replace(/\D/g, "");
              const qPhone = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
              return itemValue.toLowerCase().includes(q) || (digits.length >= 3 && itemValue.includes(qPhone)) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="חיפוש לפי שם או טלפון…" />
            <CommandList>
              <CommandEmpty>לא נמצאו אורחים</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__ ללא שיוך"
                  onSelect={() => {
                    setValue("");
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn(value ? "opacity-0" : "opacity-100")} aria-hidden="true" />
                  ללא שיוך לאורח
                </CommandItem>
                {guests.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={`${fullName(g)} ${g.phone ?? ""} ${g.id}`}
                    onSelect={() => {
                      setValue(g.id);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon className={cn(value === g.id ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="flex-1 truncate">{fullName(g)}</span>
                    {g.phone ? (
                      <span dir="ltr" className="text-xs text-muted-foreground">
                        {formatPhone(g.phone)}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
