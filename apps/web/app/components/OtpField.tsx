"use client";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/** Six separate boxes for an authenticator code. Digits only; `onComplete` fires when all six are in. */
export function OtpField({
  disabled,
  invalid,
  onChange,
  onComplete,
  value
}: {
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onComplete?: () => void;
  value: string;
}) {
  return (
    <InputOTP
      aria-invalid={invalid || undefined}
      aria-label="6-digit code"
      autoComplete="one-time-code"
      disabled={disabled}
      inputMode="numeric"
      maxLength={6}
      onChange={(next) => onChange(next.replace(/\D/g, ""))}
      onComplete={onComplete}
      pattern="[0-9]*"
      value={value}
    >
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <InputOTPSlot aria-invalid={invalid || undefined} index={index} key={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
