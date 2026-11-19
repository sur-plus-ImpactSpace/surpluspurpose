"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Languages, LogOut } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import { LOCALE_COOKIE, LOCALES } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", de: "Deutsch" };

type Props = {
  initials: string;
  name: string;
  tier: string;
  languageLabel: string;
  /** The language the page was rendered in (query or saved cookie, resolved on the server). */
  locale: string;
  /** Present on authenticated pages; the public demo has nothing to sign out of. */
  signOut?: { config: SupabaseBrowserConfig; label: string };
};

/**
 * The account control in the top bar: just the avatar. Its menu carries the
 * workspace name and tier, a language submenu and sign out (as on YouTube).
 */
export function ProfileMenu(props: Props) {
  return (
    <Suspense fallback={<ProfileRow {...props} />}>
      <ProfileMenuInner {...props} />
    </Suspense>
  );
}

/** The whole row is the button: avatar, name and role. */
function ProfileRow({ initials, name, tier }: { initials: string; name: string; tier: string }) {
  return (
    <span className="flex w-full items-center gap-3 text-left">
      <AvatarButton initials={initials} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{tier}</span>
      </span>
      <ChevronsUpDown aria-hidden="true" className="size-4 text-muted-foreground" />
    </span>
  );
}

function AvatarButton({ initials }: { initials: string }) {
  return (
    <Avatar className="size-9">
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
    </Avatar>
  );
}

function ProfileMenuInner({ initials, languageLabel, locale: rendered, name, signOut, tier }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = rendered;
  const [signingOut, setSigningOut] = useState(false);

  function chooseLanguage(locale: string) {
    // Same rule as the sign-in switch: only `lang` changes, everything else stays.
    const params = new URLSearchParams(searchParams.toString());
    if (locale === "en") params.delete("lang");
    else params.set("lang", locale);
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function handleSignOut() {
    if (!signOut || signingOut) return;
    setSigningOut(true);
    const { error } = await getBrowserSupabaseClient(signOut.config).auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    // The page was rendered with the auth cookie; refresh so the guard sends us to /login.
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={name} className="w-full rounded-md p-2 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent">
        <ProfileRow initials={initials} name={name} tier={tier} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56" side="top">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages aria-hidden="true" />
            <span className="flex-1">{languageLabel}</span>
            <span className="text-xs text-muted-foreground">{LANGUAGE_NAMES[current] ?? current}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LOCALES.map((locale) => (
              <DropdownMenuItem key={locale} onSelect={() => chooseLanguage(locale)}>
                <span className="flex-1">{LANGUAGE_NAMES[locale] ?? locale}</span>
                {locale === current ? <Check aria-hidden="true" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {signOut ? (
          <DropdownMenuItem onSelect={() => void handleSignOut()} variant="destructive">
            <LogOut aria-hidden="true" />
            <span className="flex-1">{signingOut ? "…" : signOut.label}</span>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
