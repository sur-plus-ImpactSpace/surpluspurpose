import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPage } from "../components/LegalPage";
import { LOCALE_COOKIE, resolveLocaleFrom } from "../lib/i18n";

export const metadata: Metadata = {
  title: "sur.plus · Impressum / Imprint"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * 2026-08: two corrections.
 *
 * 1. The link to the EU online dispute resolution platform is gone. The
 *    Commission shut that platform down on 2025-07-20, and keeping a link to a
 *    dead platform in an imprint is itself a warning risk. It was a duty to
 *    link while it existed and a duty to remove once it did not. The § 36 VSBG
 *    declaration stays: it is the part that is still owed, and it now matters
 *    more, not less, because consumers can reach us at all since the clearance
 *    track opened.
 *
 * 2. A product safety contact point, because making used goods available to
 *    consumers for payment can trigger Art. 22 GPSR duties. Naming it here
 *    costs nothing and is where people look for it.
 */
export default async function ImprintPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);

  return locale === "de" ? <ImprintDe /> : <ImprintEn />;
}

function ImprintDe() {
  return (
    <LegalPage locale="de" title="Impressum" kicker="Rechtliche Angaben">
      <h2>Anbieter (§ 5 DDG)</h2>
      <p>
        sur.plus UG (haftungsbeschränkt)
        <br />
        Landsberger Straße 57
        <br />
        82266 Inning am Ammersee-Stegen
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>
        <br />
        Web: <a href="https://surpluspurpose.com">surpluspurpose.com</a>
      </p>

      <h2>Vertreten durch</h2>
      <p>Florian Lechner, Geschäftsführer</p>

      <h2>Registereintrag</h2>
      <p>
        Eingetragen im Handelsregister des Amtsgerichts München
        <br />
        Registernummer: HRB 315904
      </p>

      <h2>Inhaltlich verantwortlich</h2>
      <p>Florian Lechner, Anschrift wie oben.</p>

      <h2>Kontaktstelle für Produktsicherheit</h2>
      <p>
        Für Meldungen zu Sicherheitsmängeln an über sur.plus vermittelter Ware:{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>. Wir
        leiten Meldungen an das abgebende Unternehmen weiter und informieren betroffene
        Empfänger. Verantwortlich für die Ware selbst bleibt das abgebende Unternehmen.
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG). Bei Beschwerden wenden Sie
        sich bitte direkt an uns, wir versuchen zunächst eine einvernehmliche Lösung.
      </p>

    </LegalPage>
  );
}

function ImprintEn() {
  return (
    <LegalPage locale="en" title="Imprint" kicker="Legal notice · Impressum">
      <h2>Provider (§ 5 DDG)</h2>
      <p>
        sur.plus UG (haftungsbeschränkt)
        <br />
        Landsberger Straße 57
        <br />
        82266 Inning am Ammersee-Stegen
        <br />
        Germany
      </p>

      <h2>Contact</h2>
      <p>
        E-mail: <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>
        <br />
        Web: <a href="https://surpluspurpose.com">surpluspurpose.com</a>
      </p>

      <h2>Represented by</h2>
      <p>Florian Lechner, Managing Director</p>

      <h2>Commercial register</h2>
      <p>
        Registered with the commercial register of the Munich Local Court
        <br />
        Registration number: HRB 315904
      </p>

      <h2>Responsible for content</h2>
      <p>Florian Lechner, address as above.</p>

      <h2>Product safety contact point</h2>
      <p>
        For reports of safety defects in goods intermediated through sur.plus:{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>. We
        forward reports to the releasing company and inform affected recipients.
        Responsibility for the goods themselves remains with the releasing company.
      </p>

      <h2>Consumer dispute resolution</h2>
      <p>
        We are neither obliged nor willing to participate in dispute resolution proceedings
        before a consumer arbitration board (§ 36 VSBG). Please address complaints directly
        to us, we try to find an amicable solution first.
      </p>
    </LegalPage>
  );
}
