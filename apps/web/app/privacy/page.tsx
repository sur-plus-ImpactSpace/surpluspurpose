import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPage } from "../components/LegalPage";
import { LOCALE_COOKIE, resolveLocaleFrom } from "../lib/i18n";

export const metadata: Metadata = {
  title: "sur.plus · Datenschutz / Privacy"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * 2026-08: German is now the primary text (the imprint is German, the customers
 * are German), and the policy covers what the app actually does since the
 * clearance track opened.
 *
 * The previous version described a B2B workspace only. Three things it did not
 * cover now exist: verification evidence uploaded by recipients (which for a
 * private individual's project can carry Art. 9 categories, e.g. a soup kitchen run
 * by a parish, a project for people with a specific illness), the verification
 * fee as a payment relationship, and the disclosure of a consumer recipient's
 * contact and invoicing details to the releasing company, which is a transfer to
 * a separate controller rather than processing on our behalf.
 *
 * Retention periods are stated per purpose rather than left open. The six-month
 * period for rejected applications is a proposal; see the recipient terms § 8.
 * Founding-phase draft, pending review.
 */
export default async function PrivacyPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);

  return locale === "de" ? <PrivacyDe /> : <PrivacyEn />;
}

function PrivacyDe() {
  return (
    <LegalPage locale="de" title="Datenschutzerklärung" kicker="Datenschutz · Anwendung">
      <p className="note">
        <strong>Entwurf.</strong> Diese Fassung bildet den Stand der Aufbauphase ab und
        steht unter dem Vorbehalt anwaltlicher Prüfung.
      </p>
      <p>
        Diese Erklärung gilt für die sur.plus-Anwendung (app.surpluspurpose.com). Die
        Marketing-Website (surpluspurpose.com) hat eine eigene Datenschutzerklärung.
      </p>

      <h2>Verantwortlicher</h2>
      <p>
        sur.plus UG (haftungsbeschränkt), vertreten durch den Geschäftsführer Florian
        Lechner, Landsberger Straße 57, 82266 Inning am Ammersee-Stegen.{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>
      </p>

      <h2>Was wir verarbeiten</h2>
      <p>
        <strong>Demo-Arbeitsbereich (/demo):</strong> kein Konto, kein Tracking, keine
        Cookies. Nur Beispieldaten; nichts, was Sie eingeben, wird gespeichert.
      </p>
      <p>
        <strong>Arbeitsbereich nach Anmeldung:</strong> E-Mail-Adresse des Kontos und
        Profilangaben (Rolle, Organisation), die von Ihrer Organisation eingegebenen
        operativen Daten (Angebote, Bedarfe, Matches, Nachrichten, Dokumente) sowie ein
        sicherheitsbezogenes Protokoll. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1
        lit. b DSGVO) und berechtigtes Interesse an der Sicherheit der Plattform (Art. 6
        Abs. 1 lit. f DSGVO). <em>Aufbewahrung:</em> für die Vertragsdauer; der
        Arbeitsbereich ist vor Schließung exportierbar und wird 30 Tage danach gelöscht,
        vorbehaltlich gesetzlicher Aufbewahrungspflichten.
      </p>
      <p>
        <strong>Nachrichten zwischen den Parteien:</strong> Chat-Verläufe zu einem Match
        speichern wir, damit beide Seiten die Absprachen nachvollziehen können.
        Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). <em>Aufbewahrung:</em>{" "}
        24 Monate nach Abschluss des Matches, danach Löschung; auf Wunsch früher, soweit
        keine Nachweispflicht entgegensteht. Beide Seiten können den vollständigen Verlauf
        jederzeit als Datei exportieren, mit Zeitstempel und Beteiligten. Das ist für
        Unternehmen gedacht, die geschäftliche Kommunikation nicht ausschließlich auf einer
        externen Plattform führen dürfen; auf Wunsch richten wir eine automatische Kopie an
        eine von Ihnen benannte Adresse ein.
      </p>
      <p>
        <strong>Verifizierungsnachweise:</strong> Zur Prüfung von Empfängern verarbeiten wir
        die eingereichten Unterlagen: Freistellungsbescheid, Registerauszug,
        Trägerschaftsnachweis oder, bei Privatpersonen und kleinen Unternehmen, Belege zur
        Gemeinwohlorientierung wie Projektpräsenzen, Referenzen und Wirkungsnachweise.
        Rechtsgrundlage: Vertragserfüllung bzw. vorvertragliche Maßnahmen (Art. 6 Abs. 1
        lit. b DSGVO) und berechtigtes Interesse am Schutz der abgebenden Unternehmen und
        der übrigen Empfänger (Art. 6 Abs. 1 lit. f DSGVO). Ergeben sich aus Ihrem Projekt
        besondere Kategorien personenbezogener Daten im Sinne des Art. 9 DSGVO, etwa bei
        religiösen, politischen oder gesundheitsbezogenen Vorhaben, stützen wir die
        Verarbeitung auf Ihre ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO) oder
        darauf, dass Sie die Angaben offensichtlich öffentlich gemacht haben (Art. 9 Abs. 2
        lit. e DSGVO). Bitte reichen Sie nur ein, was für die Prüfung erforderlich ist.{" "}
        <em>Aufbewahrung:</em> bei Aufnahme für die Dauer der Partnerschaft, bei Ablehnung
        sechs Monate.
      </p>
      <p>
        <strong>Verifizierungsbeitrag:</strong> Zahlen kleine Unternehmen oder Privatpersonen
        den einmaligen Beitrag, verarbeiten wir die zur Abwicklung und Rechnungsstellung
        nötigen Daten. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) und
        gesetzliche Pflicht (Art. 6 Abs. 1 lit. c DSGVO). <em>Aufbewahrung:</em>{" "}
        Rechnungsdaten zehn Jahre nach den handels- und steuerrechtlichen Fristen.
      </p>
      <p>
        <strong>Abwicklung eines Matches:</strong> Damit die Übergabe stattfinden kann, geben
        wir Ihre Kontaktdaten an die jeweils andere Seite weiter, bei einer entgeltlichen
        Übernahme zusätzlich die für die Rechnung nötigen Angaben an das abgebende
        Unternehmen. Dieses ist für die weitere Verarbeitung eigenständig verantwortlich; es
        handelt sich um eine Übermittlung, nicht um eine Auftragsverarbeitung.
        Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h2>Cookies</h2>
      <p>
        Die Anwendung setzt ausschließlich technisch notwendige Cookies: die
        Authentifizierungs-Sitzung (Supabase), Cloudflare Turnstile zum Botschutz bei
        Anmeldung und Registrierung sowie einen Merker für die gewählte Sprache. Keine
        Analyse, keine Werbung, keine Tracker von Dritten, deshalb gibt es kein
        Cookie-Banner (§ 25 Abs. 2 TDDDG / Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>Auftragsverarbeiter und Hosting</h2>
      <p>
        Auslieferung, DNS und Botschutz (Turnstile): Cloudflare. Hosting und
        Server-Funktionen: Netlify. Datenbank und Authentifizierung: Supabase, EU-Region
        (Frankfurt). E-Mail-Versand: Resend, EU-Region (Irland). Mit diesen Anbietern
        bestehen Verträge zur Auftragsverarbeitung. Für die Zahlungsabwicklung ist Stripe
        vorgesehen; sobald dies aktiv ist, ergänzen wir diese Erklärung, bevor die erste
        Zahlung verarbeitet wird.
      </p>

      <h2>Übermittlung in Drittländer</h2>
      <p>
        Einige Anbieter sind US-Unternehmen oder haben US-Muttergesellschaften (Cloudflare,
        Inc.; Netlify, Inc.; Supabase, Inc.; Resend, Inc.), auch wenn die Daten in einer
        EU-Region liegen. Soweit personenbezogene Daten in die USA übermittelt werden,
        stützen wir uns auf geeignete Garantien: EU-Standardvertragsklauseln und, wo
        vorhanden, die Zertifizierung des Anbieters unter dem EU-US Data Privacy Framework.
        Die abschließende Prüfung dieser Grundlagen ist Teil unserer rechtlichen
        Vorbereitung auf den Go-Live.
      </p>

      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
        Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Soweit eine
        Verarbeitung auf Ihrer Einwilligung beruht, können Sie diese jederzeit mit Wirkung
        für die Zukunft widerrufen. Sie haben außerdem das Recht, sich bei einer
        Aufsichtsbehörde zu beschweren. Für uns ist das Bayerische Landesamt für
        Datenschutzaufsicht (BayLDA), Ansbach, zuständig. Kontakt für alle Anliegen:{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>.
      </p>

      <p className="note">
        Fassung 2026-08 · Stand der Vorbereitungsphase vor dem Launch. Maßgeblich ist die
        deutsche Fassung; die englische ist eine Übersetzung zur Information.
      </p>
    </LegalPage>
  );
}

function PrivacyEn() {
  return (
    <LegalPage locale="en" title="Privacy policy" kicker="Data protection · App">
      <p className="note">
        <strong>Translation.</strong> The German version is authoritative; this English text
        is for information. <strong>Draft</strong>, pending review by counsel.
      </p>
      <p>
        This policy covers the sur.plus product application (app.surpluspurpose.com). The
        landing page (surpluspurpose.com) has its own privacy notice.
      </p>

      <h2>Controller</h2>
      <p>
        sur.plus UG (haftungsbeschränkt), represented by its managing director Florian
        Lechner, Landsberger Straße 57, 82266 Inning am Ammersee-Stegen, Germany.{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>
      </p>

      <h2>What we process</h2>
      <p>
        <strong>Demo workspace (/demo):</strong> no account, no tracking, no cookies. Sample
        data only; nothing you enter is persisted.
      </p>
      <p>
        <strong>Customer workspace (after sign-in):</strong> account e-mail and workspace
        profile (role, organization), the operational data your organization enters
        (listings, needs, matches, messages, documents) and a security audit trail. Legal
        basis: performance of contract (Art. 6(1)(b) GDPR) and legitimate interest in
        platform security (Art. 6(1)(f) GDPR). <em>Retention:</em> for the term of the
        contract; exportable before closure and deleted 30 days after, subject to statutory
        retention duties.
      </p>
      <p>
        <strong>Messages between the parties:</strong> chat threads on a match are stored so
        both sides can trace what was agreed. Legal basis: performance of contract
        (Art. 6(1)(b) GDPR). <em>Retention:</em> 24 months after the match closes, earlier on
        request where no evidentiary duty stands in the way. Either side can export the full
        thread at any time as a file, with timestamps and participants. This is meant for
        companies that may not conduct business communication solely on an external
        platform; on request we set up an automatic copy to an address you nominate.
      </p>
      <p>
        <strong>Verification evidence:</strong> to verify recipients we process the documents
        submitted: exemption notice, register extract, proof of public or church-run
        status, or, for private individuals and small businesses, evidence of public-benefit
        activity such as project presences, references and prior impact. Legal basis:
        performance of contract or pre-contractual steps (Art. 6(1)(b) GDPR) and legitimate
        interest in protecting releasing companies and other recipients (Art. 6(1)(f) GDPR).
        Where your project involves special categories under Art. 9 GDPR, meaning religious,
        political or health-related work, we rely on your explicit consent (Art. 9(2)(a)) or
        on the data having manifestly been made public by you (Art. 9(2)(e)). Please submit
        only what the check requires. <em>Retention:</em> for the partnership if admitted,
        six months if rejected.
      </p>
      <p>
        <strong>Verification fee:</strong> where a small business or private individual pays
        the one-off fee, we process the data needed for payment and invoicing. Legal basis:
        performance of contract (Art. 6(1)(b) GDPR) and legal obligation (Art. 6(1)(c)
        GDPR). <em>Retention:</em> invoicing data for ten years under commercial and tax law.
      </p>
      <p>
        <strong>Completing a match:</strong> so the handover can happen, we pass your contact
        details to the other side, and for a paid transfer also the details needed for the
        invoice to the releasing company. That company is an independent controller for its
        further processing; this is a transfer, not processing on our behalf. Legal basis:
        performance of contract (Art. 6(1)(b) GDPR).
      </p>

      <h2>Cookies</h2>
      <p>
        The app uses strictly necessary cookies only: the Supabase authentication session,
        Cloudflare Turnstile for bot protection on sign-in and registration, and a flag for
        the chosen language. No analytics, no advertising, no third-party trackers, which is
        why there is no cookie banner (§ 25(2) TDDDG / Art. 6(1)(f) GDPR).
      </p>

      <h2>Processors and hosting</h2>
      <p>
        Content delivery, DNS and bot protection (Turnstile): Cloudflare. Hosting and server
        functions: Netlify. Database and authentication: Supabase, EU region (Frankfurt).
        E-mail delivery: Resend, EU region (Ireland). Data processing agreements are in place
        with these providers. Stripe is intended for payment processing; we will update this
        policy before the first payment is processed.
      </p>

      <h2>International transfers</h2>
      <p>
        Some providers are US companies or have US parent companies (Cloudflare, Inc.;
        Netlify, Inc.; Supabase, Inc.; Resend, Inc.), even where data sits in an EU region.
        Where personal data is transferred to the USA we rely on appropriate safeguards: EU
        Standard Contractual Clauses and, where available, the provider&rsquo;s certification
        under the EU-US Data Privacy Framework. Finalising these is part of our pre-launch
        legal review.
      </p>

      <h2>Your rights</h2>
      <p>
        You have the rights of access, rectification, erasure, restriction, portability and
        objection (Art. 15–21 GDPR). Where processing rests on consent you may withdraw it at
        any time with effect for the future. You also have the right to lodge a complaint
        with a supervisory authority (for us: BayLDA, Ansbach). Contact us at{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>.
      </p>

      <p className="note">
        Version 2026-08 · pre-launch phase.
      </p>
    </LegalPage>
  );
}
