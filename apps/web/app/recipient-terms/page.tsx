import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPage } from "../components/LegalPage";
import { LOCALE_COOKIE, resolveLocaleFrom } from "../lib/i18n";

export const metadata: Metadata = {
  title: "sur.plus · Nutzungsbedingungen Empfängerseite"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * New in 2026-08. Until now the receiving side had only the NGO Partner
 * Agreement, which says of itself that it is a pre-registration document
 * ("Vollständige Plattform-Nutzungsbedingungen folgen zum Launch"). It covers
 * one of three recipient groups and none of the paid transfer track.
 *
 * This document is the rulebook for all three groups. It deliberately keeps
 * sur.plus out of the sale itself (the seller is the releasing company) and
 * scopes our own paid relationship to the verification fee, which is what makes
 * the consumer obligations tractable.
 *
 * 2026-08-06, second pass, two corrections:
 *
 *   * SMEs are no longer told they can ONLY receive against payment. They can
 *     receive a gift; it simply carries no donation effect (not deductible for
 *     the giver, potentially taxable income for them). Stating "only paid" was
 *     us describing a tax consequence as if it were a rule we impose.
 *
 *   * The fee is quoted net for businesses and gross for consumers. Flo asked
 *     for net throughout, but § 3 PAngV requires a total price including VAT
 *     towards consumers, so quoting the private-individual fee net would be a
 *     pricing-law problem in a document written to fix a consumer-law problem.
 *     Split by addressee instead. Flagged for the Legal Clinic.
 *
 * 2026-10-10, third pass (liability review): the contract over the goods is now
 * expressly concluded outside the application (so sur.plus is not an online
 * marketplace under sec. 312l(2) BGB / Art. 3(14) GPSR), risk passes on handover,
 * transport cost promise softened to "as a rule" to match the flyer and the pilot
 * reality, and a consumer-safe liability clause for sur.plus itself added as new
 * section 8 (there was none). Review file: 03_LEGAL/sur.plus_Haftung_und_AGB_Review_2026-10-10.md
 *
 * Founding-phase draft. The construction chosen here, sur.plus as intermediary,
 * releasing company as seller, verification fee as a separate service contract,
 * is exactly what the Legal Clinic on 2026-08-19 should stress-test.
 */
export default async function RecipientTermsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);

  return locale === "de" ? <RecipientTermsDe /> : <RecipientTermsEn />;
}

function RecipientTermsDe() {
  return (
    <LegalPage
      locale="de"
      title="Nutzungsbedingungen für die Empfängerseite"
      kicker="Entwurf Aufbauphase · Empfänger"
    >
      <p className="note">
        <strong>Entwurf.</strong> sur.plus ist ein junges Unternehmen im Aufbau. Diese
        Bedingungen beschreiben, wie die Plattform heute arbeitet, und stehen unter dem
        Vorbehalt anwaltlicher Prüfung. Wo sie schweigen oder unklar sind, gilt die für Sie
        günstigere Auslegung.
      </p>

      <h2>1. Für wen diese Bedingungen gelten</h2>
      <p>
        Diese Bedingungen regeln das Verhältnis zwischen Ihnen als Empfänger und der
        sur.plus UG (haftungsbeschränkt), Landsberger Straße 57, 82266 Inning am
        Ammersee-Stegen, eingetragen im Handelsregister des Amtsgerichts München unter
        HRB 315904 (&bdquo;sur.plus&ldquo;). Sie gelten für drei Gruppen:
      </p>
      <p>
        <strong>a) Gemeinnützige und öffentliche Träger:</strong> steuerbegünstigte
        Körperschaften (e.V., gGmbH, gUG, Stiftung) sowie öffentliche und kirchliche Träger
        wie Schulen, Kitas und Kommunen. Für sie ist die Nutzung dauerhaft kostenlos. Sie
        können Überschüsse als Sachspende empfangen. Ergänzend gilt die
        NGO-Partnervereinbarung.
      </p>
      <p>
        <strong>b) Kleine und mittlere Unternehmen</strong> mit gemeinwohlorientiertem
        Handeln.
      </p>
      <p>
        <strong>c) Privatpersonen mit einem gemeinwohlorientierten Projekt.</strong> Handeln
        Sie dabei zu Zwecken, die überwiegend weder Ihrer gewerblichen noch Ihrer
        selbständigen beruflichen Tätigkeit zugerechnet werden können, sind Sie Verbraucher
        im Sinne des § 13 BGB. Die Ziffern 4 und 5 enthalten die Regelungen, die dann
        zusätzlich zu Ihren Gunsten gelten.
      </p>

      <h2>2. Was sur.plus tut, und was nicht</h2>
      <p>
        sur.plus ist eine Vermittlungsplattform. Wir prüfen Empfänger, erfassen Ihren Bedarf,
        bringen ihn mit verfügbaren Überschüssen zusammen, koordinieren die Übergabe und
        dokumentieren sie.
      </p>
      <p>
        <strong>Wir erwerben zu keinem Zeitpunkt Eigentum an der Ware und sind nicht Partei
        der Übertragung.</strong> Ob Spende oder entgeltliche Übernahme, der Vertrag über
        die Ware kommt unmittelbar zwischen dem abgebenden Unternehmen und Ihnen zustande.
        Eigentum, Gefahr und Gewährleistung richten sich nach diesem Verhältnis, nicht nach
        dem zu sur.plus.
      </p>
      <p>
        Wir schulden keinen Match. Ob Ihr Bedarf bedient werden kann, hängt davon ab, was
        Unternehmen anbieten.
      </p>
      <p>
        <strong>Aufbauphase.</strong> sur.plus befindet sich im Aufbau; die ersten Übergaben
        laufen seit Herbst 2026. Registrierung und Verifizierung laufen heute über ein
        Online-Formular und E-Mail, das Matching koordinieren Menschen, Benachrichtigungen,
        Zusagen und Übergabetermine erhalten Sie per E-Mail oder Telefon, und
        Übergabeprotokoll, Entwurf der Zuwendungsbestätigung und Wirkungsbericht liefern wir
        als Dateien. Ein Konto in der Anwendung richten wir ein, sobald der Empfängerbereich
        freigeschaltet ist. Wo diese Bedingungen von der Anwendung, von Freischaltung,
        Benachrichtigungen oder Export sprechen, gilt dasselbe für diesen Ablauf.
      </p>

      <h2>3. Aufnahme und Verifizierung</h2>
      <p>
        Vor der Freischaltung prüfen wir Ihre Angaben. Was wir dafür benötigen, hängt von
        Ihrer Gruppe ab:
      </p>
      <p>
        <strong>Gemeinnützige Träger:</strong> Freistellungsbescheid oder gleichwertiger
        Nachweis der Steuerbegünstigung, Rechtsträgerschaft, keine laufenden Sanktions- oder
        Insolvenzverfahren. <strong>Öffentliche und kirchliche Träger:</strong> Nachweis der
        Trägerschaft. <strong>Kleine Unternehmen:</strong> Handelsregisterauszug oder
        Gewerbeanmeldung sowie belegbare Angaben zum gemeinwohlorientierten Handeln.{" "}
        <strong>Privatpersonen:</strong> belegbare Angaben zu Ihrem Projekt, etwa eine
        öffentliche Projektpräsenz, Referenzen von Partnern oder dokumentierte bisherige
        Wirkung.
      </p>
      <p>
        <strong>&bdquo;Gemeinwohlorientiertes Handeln&ldquo; ist unser eigenes Kriterium,
        kein gesetzlicher Begriff.</strong> Wir verstehen darunter ein konkretes Projekt mit
        nachvollziehbarer Tätigkeit, dessen Nutzen nicht überwiegend bei Ihnen selbst
        anfällt. Gute Absichten allein genügen nicht.
      </p>
      <p>
        <strong>Ablehnung und Sperrung.</strong> Wir können die Aufnahme ablehnen oder ein
        Konto sperren, wenn die Nachweise fehlen oder unzutreffend sind, wenn die
        Voraussetzungen nachträglich entfallen oder wenn gegen Ziffer 6 verstoßen wird. Wir
        teilen Ihnen die Gründe in Textform mit und geben Ihnen Gelegenheit zur
        Stellungnahme. Sie können der Entscheidung binnen 14 Tagen formlos an
        service@surpluspurpose.com widersprechen; wir prüfen dann erneut. Eine Sperrung aus
        wichtigem Grund kann sofort wirken, die Begründung reichen wir unverzüglich nach.
      </p>
      <p>
        Die Kennzeichnung als &bdquo;verifiziert&ldquo; bestätigt, dass uns die genannten
        Nachweise zum Prüfzeitpunkt vorlagen. Sie ist keine Zusicherung Ihrer Bonität,
        Kapazität oder künftigen Mittelverwendung.
      </p>

      <h2>4. Verifizierungsbeitrag</h2>
      <p>
        Für gemeinnützige, öffentliche und kirchliche Träger ist die Nutzung dauerhaft
        kostenlos. Es gibt keine Gebühren, keine Abonnements und keine Provision auf
        empfangene Ware.
      </p>
      <p>
        Kleine Unternehmen zahlen für die Prüfung einen einmaligen Verifizierungsbeitrag von
        25 € netto zuzüglich Umsatzsteuer, soweit sie anfällt. Für Privatpersonen beträgt der
        Beitrag 10 € als Gesamtpreis einschließlich Umsatzsteuer, weil das Preisangabenrecht
        gegenüber Verbrauchern die Angabe des Gesamtpreises verlangt. Nach der Prüfung ist
        der Zugang kostenfrei. Der Beitrag betrifft ausschließlich das Verhältnis zu
        sur.plus und ist kein Entgelt für die Ware.
      </p>
      <p>
        <strong>Widerrufsrecht für Verbraucher.</strong> Sind Sie Verbraucher, steht Ihnen
        für diesen Vertrag ein Widerrufsrecht von 14 Tagen zu. Die Einzelheiten und das
        Muster-Widerrufsformular finden Sie in der{" "}
        <a href="/withdrawal">Widerrufsbelehrung</a>. Beginnen wir auf Ihren ausdrücklichen
        Wunsch vor Ablauf der Frist mit der Prüfung, schulden Sie im Fall des Widerrufs
        einen anteiligen Betrag für die bereits erbrachte Leistung.
      </p>

      <h2>5. Empfang von Ware</h2>
      <p>
        <strong>Sachspende.</strong> Gemeinnützige, öffentliche und kirchliche Träger
        empfangen Überschüsse unentgeltlich. Die Zuwendungsbestätigung stellen Sie in
        eigener Verantwortung aus. sur.plus bereitet sie vor: Aus den zum Match erfassten
        Angaben, also Art und Menge der Ware, angesetzter Wert, Zustand, Übergabedatum und
        Beteiligte, erzeugen wir einen vorausgefüllten Entwurf, den Sie prüfen,
        gegebenenfalls korrigieren und digital signieren. Für Richtigkeit und Wertansatz
        bleiben Sie verantwortlich. Bei einer Schenkung haftet das abgebende Unternehmen
        nach § 521 BGB nur für Vorsatz und grobe Fahrlässigkeit.
      </p>
      <p>
        <strong>Kleine Unternehmen und Privatpersonen.</strong> Auch Sie können Ware
        unentgeltlich erhalten, wenn das abgebende Unternehmen sie so anbietet. Eine
        Spendenwirkung entsteht dabei nicht: Für den Geber ist die Abgabe keine abzugsfähige
        Spende, und bei Ihnen kann sie als Betriebseinnahme zu erfassen sein. Deshalb ist
        der übliche Weg die <strong>vergünstigte Übernahme</strong> gegen einen symbolischen
        Preis mit Rechnung. Welche Variante gilt, steht im jeweiligen Angebot. Klären Sie die
        steuerliche Behandlung mit Ihrer Steuerberatung; wir beraten dazu nicht.
      </p>
      <p>
        <strong>Verkäufer ist bei entgeltlicher Übernahme das abgebende Unternehmen, nicht
        sur.plus.</strong> Ansprüche wegen Mängeln richten Sie deshalb an dieses Unternehmen;
        wir nennen Ihnen die vollständigen Kontaktdaten vor Vertragsschluss und unterstützen
        bei der Abwicklung. Der Vertrag über die Ware wird nicht über die Anwendung
        geschlossen: Angebot und Annahme erklären Sie und das Unternehmen unmittelbar
        gegeneinander, etwa per E-Mail oder bei der Besichtigung; die Anwendung stellt den
        Kontakt her und dokumentiert die Übergabe.
      </p>
      <p>
        <strong>Als Verbraucher</strong> gilt für Sie zusätzlich: Die gesetzliche
        Mängelhaftung kann bei gebrauchten Sachen auf ein Jahr verkürzt, nach § 476 Abs. 2
        BGB aber nicht ausgeschlossen werden. Wird der Vertrag im Fernabsatz geschlossen, etwa
        per E-Mail, steht Ihnen ein 14-tägiges Widerrufsrecht gegenüber dem abgebenden
        Unternehmen zu.
        Die Belehrung erhalten Sie von diesem Unternehmen vor Vertragsschluss; sur.plus
        stellt dafür ein Muster bereit und weist im Ablauf darauf hin. Erhalten Sie keine
        ordnungsgemäße Belehrung, verlängert sich die Widerrufsfrist nach den gesetzlichen
        Vorschriften.
      </p>
      <p>
        Ware wird in gebrauchtem Zustand abgegeben. Der Zustand wird im Angebot beschrieben,
        bekannte Mängel sind dort benannt; prüfen Sie ihn vor der Übernahme. Mit der Übergabe
        an Sie oder an eine von Ihnen beauftragte Person geht die Gefahr auf Sie über.
        Transportkosten trägt bei der Sachspende in der Regel das abgebende Unternehmen;
        Abweichungen, etwa eine Selbstabholung, werden je Match vor Ihrer Zusage vereinbart.
        Bei der vergünstigten Übernahme werden die Transportkosten im Angebot ausgewiesen.
      </p>

      <h2>6. Was wir von Ihnen erwarten</h2>
      <p>
        Bestätigen Sie den Empfang zugeteilter Ware innerhalb von fünf Werktagen nach
        Lieferung. Verwenden Sie empfangene Ware für die bei der Registrierung angegebenen
        Zwecke. Ein kommerzieller Weiterverkauf ist ausgeschlossen; das gilt auch für
        vergünstigt übernommene Ware, bei der der symbolische Preis gerade auf dieser
        Zweckbindung beruht. Reagieren Sie nach Möglichkeit innerhalb von 48 Stunden auf
        Match-Benachrichtigungen. Teilen Sie uns wesentliche Änderungen mit, also Adresse,
        Rechtsstatus, Kapazität oder den Wegfall der Gemeinwohlorientierung, innerhalb von
        14 Tagen.
      </p>

      <h2>7. Produktsicherheit</h2>
      <p>
        Wir unterhalten eine Kontaktstelle für Produktsicherheit unter
        service@surpluspurpose.com. Melden Sie uns Sicherheitsmängel an empfangener Ware; wir
        leiten die Meldung an das abgebende Unternehmen weiter und informieren andere
        Empfänger, wenn dieselbe Ware betroffen sein kann. Gebrauchte Elektrogeräte können
        Pflichten nach ElektroG und Batterierecht auslösen; Hinweise dazu finden Sie im
        Angebot.
      </p>

      <h2>8. Haftung von sur.plus</h2>
      <p>
        sur.plus haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden
        aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Bei einfacher
        Fahrlässigkeit haften wir nur für die Verletzung einer Pflicht, deren Erfüllung die
        ordnungsgemäße Durchführung dieser Vereinbarung überhaupt erst ermöglicht und auf
        deren Einhaltung Sie regelmäßig vertrauen dürfen, und dann begrenzt auf den bei
        Vertragsschluss vorhersehbaren, vertragstypischen Schaden. Für Beschaffenheit,
        Eignung und Sicherheit der Ware, für den Transport und für das Verhalten des
        abgebenden Unternehmens haften wir nicht, weil wir an der Übertragung nicht beteiligt
        sind (Ziffer 2); Ihre Ansprüche gegen das abgebende Unternehmen bleiben davon
        unberührt. Die Haftung nach dem Produkthaftungsgesetz und zwingende gesetzliche
        Haftung bleiben unberührt. Was die Kennzeichnung als &bdquo;verifiziert&ldquo;
        bestätigt und was nicht, regelt Ziffer 3.
      </p>

      <h2>9. Ihre Daten</h2>
      <p>
        Wie wir Ihre Daten verarbeiten, steht in der{" "}
        <a href="/privacy">Datenschutzerklärung</a>. Für die Verifizierung verarbeiten wir
        auch die von Ihnen eingereichten Nachweise. Reichen Sie dabei keine Unterlagen ein,
        die mehr über Sie preisgeben als für die Prüfung nötig ist, insbesondere keine
        Gesundheits-, Religions- oder politischen Daten, soweit sie für Ihr Projekt nicht
        ohnehin offenkundig sind. Unterlagen abgelehnter Bewerbungen löschen wir nach sechs
        Monaten, sofern keine gesetzliche Aufbewahrungspflicht besteht.
      </p>
      <p>
        Den Nachrichtenverlauf zu einem Match können Sie jederzeit als Datei exportieren,
        mit Zeitstempel und Beteiligten. Das ist gedacht für Träger, deren interne Vorgaben
        eine eigene Ablage der Korrespondenz verlangen.
      </p>

      <h2>10. Laufzeit und Beendigung</h2>
      <p>
        Die Vereinbarung gilt ab Freischaltung auf unbestimmte Zeit. Beide Seiten können mit
        einer Frist von 30 Tagen in Textform an service@surpluspurpose.com kündigen. Der
        Verifizierungsbeitrag wird bei Kündigung nicht anteilig erstattet, außer die
        Kündigung beruht auf einem von uns zu vertretenden Grund. Bereits bestätigte Matches
        werden abgewickelt.
      </p>

      <h2>11. Recht, Gerichtsstand und maßgebliche Sprache</h2>
      <p>
        Es gilt deutsches Recht. Sind Sie Verbraucher, bleiben zwingende Vorschriften des
        Staates Ihres gewöhnlichen Aufenthalts unberührt, und es gelten die gesetzlichen
        Gerichtsstände. Sind Sie Kaufmann, ist Gerichtsstand München. Wir versuchen zunächst
        eine einvernehmliche Lösung, schreiben Sie an{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>.
      </p>
      <p>
        <strong>Maßgeblich ist die deutsche Fassung.</strong> Die englische Fassung ist eine
        Übersetzung zur Information; bei Abweichungen geht der deutsche Text vor.
      </p>

      <p className="note">
        Fassung 2026-10 · Entwurf der Aufbauphase, anwaltliche Prüfung ausstehend. Geändert
        gegenüber 2026-08: Ziffer 2 (Aufbauphase), Ziffer 5 (Vertragsschluss außerhalb der Anwendung, Gefahrübergang,
        Transportkosten), neue Ziffer 8 (Haftung von sur.plus), Folgenummerierung. Fragen:
        service@surpluspurpose.com
      </p>
    </LegalPage>
  );
}

function RecipientTermsEn() {
  return (
    <LegalPage locale="en" title="Recipient terms" kicker="Founding-phase draft · Recipients">
      <p className="note">
        <strong>Translation.</strong> The German version is authoritative (section 11). This
        English text is provided for information; where the two differ, the German prevails.
      </p>
      <p className="note">
        <strong>Draft.</strong> sur.plus is a young company still being built. These terms describe how
        the platform works today and are pending review by external counsel.
      </p>

      <h2>1. Who these terms apply to</h2>
      <p>
        These terms govern the relationship between you as a recipient and sur.plus UG
        (haftungsbeschränkt), Landsberger Straße 57, 82266 Inning am Ammersee-Stegen,
        registered with the commercial register of the Munich Local Court under HRB 315904
        (&ldquo;sur.plus&rdquo;). They cover three groups:
      </p>
      <p>
        <strong>a) Non-profit and public bodies:</strong> tax-privileged organisations
        (e.V., gGmbH, gUG, Stiftung) as well as public and church-run bodies such as
        schools, day-care centres and municipalities. Access is free, permanently. They may
        receive surplus as a donation in kind. The NGO Partner Agreement applies in
        addition.
      </p>
      <p>
        <strong>b) Small and medium-sized businesses</strong> acting in the public benefit.
      </p>
      <p>
        <strong>c) Private individuals running a public-benefit project.</strong> Where you
        act for purposes outside your trade or profession, you are a consumer (§ 13 BGB);
        sections 4 and 5 set out the additional protections that then apply.
      </p>

      <h2>2. What sur.plus does, and does not do</h2>
      <p>
        sur.plus is an intermediation platform. We verify recipients, record your needs,
        match them with available surplus, coordinate the handover and document it.
      </p>
      <p>
        <strong>We never take ownership of the goods and are not a party to the
        transfer.</strong> Whether donation or paid transfer, the contract over the goods is
        concluded directly between the releasing company and you. Title, risk and warranty
        follow that relationship, not your relationship with sur.plus.
      </p>
      <p>
        We do not owe a match. Whether your need can be served depends on what companies
        offer.
      </p>
      <p>
        <strong>Build-up phase.</strong> sur.plus is being built; the first handovers have
        been running since autumn 2026. Registration and verification currently run through
        an online form and e-mail, matching is coordinated by people, notifications,
        commitments and handover dates reach you by e-mail or phone, and the handover record,
        the draft donation receipt and the impact report are delivered as files. We set up an
        account in the application once the recipient area has been enabled. Where these
        terms refer to the application, activation, notifications or export, the same applies
        to this process.
      </p>

      <h2>3. Admission and verification</h2>
      <p>
        We check your details before activation. What we need depends on your group.
        Non-profits: exemption notice (Freistellungsbescheid) or equivalent proof of
        tax-privileged status, legal personality, no ongoing sanctions or insolvency
        proceedings. Public and church-run bodies: proof of status. Small businesses:
        commercial register extract or trade registration plus evidence of public-benefit
        activity. Private individuals: evidence of your project, such as a public project
        presence, references from partners, or documented prior impact.
      </p>
      <p>
        <strong>&ldquo;Public-benefit activity&rdquo; is our own criterion, not a statutory
        term.</strong> We take it to mean a concrete project with traceable activity whose
        benefit does not accrue predominantly to you. Good intentions alone are not enough.
      </p>
      <p>
        <strong>Refusal and suspension.</strong> We may refuse admission or suspend an
        account where evidence is missing or incorrect, where the conditions cease to be
        met, or where section 6 is breached. We give reasons in text form and an opportunity
        to respond. You may object informally within 14 days to
        service@surpluspurpose.com and we will review the decision. Suspension for good
        cause may take effect immediately, with reasons following without delay.
      </p>
      <p>
        The &ldquo;verified&rdquo; label confirms that the stated evidence was on file at
        the time of the check. It is not an assurance of your solvency, capacity or future
        use of resources.
      </p>

      <h2>4. Verification fee</h2>
      <p>
        For non-profit, public and church-run bodies, use is permanently free: no fees, no
        subscriptions, no commission on goods received.
      </p>
      <p>
        Small businesses pay a one-off verification fee of € 25 net plus VAT where
        applicable. For private individuals the fee is € 10 as a total price including VAT,
        because pricing law requires a total price towards consumers. Access is free after
        the check. The fee concerns only your relationship with sur.plus and is not payment
        for goods.
      </p>
      <p>
        <strong>Right of withdrawal for consumers.</strong> If you are a consumer you have a
        14-day right of withdrawal for this contract. Details and the model withdrawal form
        are in the <a href="/withdrawal">withdrawal instruction</a>. If we begin the review
        at your express request before the period expires, you owe a proportionate amount
        for the service already provided should you withdraw.
      </p>

      <h2>5. Receiving goods</h2>
      <p>
        <strong>Donation in kind.</strong> Non-profit, public and church-run bodies receive
        surplus free of charge. You issue the donation receipt on your own responsibility.
        sur.plus prepares it: from the details recorded for the match, meaning type and
        quantity, the value applied, condition, handover date and the parties, we generate a
        pre-filled draft that you review, correct where needed and sign digitally. Accuracy
        and valuation remain your responsibility. In a gift, the releasing company is liable
        only for intent and gross negligence (§ 521 BGB).
      </p>
      <p>
        <strong>Small businesses and private individuals.</strong> You too can receive goods
        free of charge where the releasing company offers them that way. No donation effect
        arises: it is not a deductible donation for the giver, and for you it may count as
        taxable income. The usual route is therefore a <strong>discounted transfer</strong>{" "}
        for a symbolic price against an invoice. The applicable route is stated in each
        offer. Clarify the tax treatment with your tax advisor; we do not advise on it.
      </p>
      <p>
        <strong>In a paid transfer the seller is the releasing company, not
        sur.plus.</strong> Defect claims go to that company; we give you its full contact
        details before the contract is concluded and support the process. The contract over
        the goods is not concluded through the application: offer and acceptance are
        exchanged directly between you and the company, for instance by e-mail or at an
        inspection; the application makes the introduction and documents the handover.
      </p>
      <p>
        <strong>As a consumer</strong>, the following applies in addition: statutory
        liability for defects may be shortened to one year for used goods but, under
        § 476(2) BGB, not excluded. Where the contract is concluded at a distance, for
        instance by e-mail, you have a 14-day right of withdrawal against the releasing
        company. That company provides the
        instruction before the contract is concluded; sur.plus supplies a model and flags it
        in the flow. Without a proper instruction, the withdrawal period is extended by law.
      </p>
      <p>
        Goods are transferred used. Condition is described in the offer and known defects are
        named there; check it before taking over. Risk passes to you on handover to you or to
        a person acting on your behalf. For donations, transport costs are as a rule borne by
        the releasing company; deviations, such as collection by you, are agreed per match
        before you confirm. For discounted transfers, transport costs are stated in the offer.
      </p>

      <h2>6. What we ask of you</h2>
      <p>
        Confirm receipt of allocated goods within five working days of delivery. Use goods
        received for the purposes stated at registration. Commercial resale is excluded,
        including for discounted goods, where the symbolic price rests on exactly that
        restriction. Respond to match notifications within 48 hours where possible. Tell us
        about material changes, meaning address, legal status, capacity, or the end of your
        public-benefit activity, within 14 days.
      </p>

      <h2>7. Product safety</h2>
      <p>
        We maintain a product safety contact point at service@surpluspurpose.com. Report
        safety defects in goods received; we forward the report to the releasing company and
        inform other recipients where the same goods may be affected. Used electrical
        equipment may trigger duties under ElektroG and battery law; the offer carries notes
        on this.
      </p>

      <h2>8. Liability of sur.plus</h2>
      <p>
        sur.plus is liable without limit for intent and gross negligence and for injury to
        life, body or health. For slight negligence we are liable only for breach of an
        obligation whose fulfilment is essential to the proper performance of this agreement
        and on whose observance you may regularly rely, and then limited to the foreseeable,
        contract-typical damage at the time of conclusion. We are not liable for the
        condition, fitness or safety of the goods, for transport, or for the conduct of the
        releasing company, as we are not a party to the transfer (section 2); your claims
        against the releasing company remain unaffected. Liability under the
        Produkthaftungsgesetz and mandatory statutory liability remain unaffected. What the
        &ldquo;verified&rdquo; label does and does not confirm is set out in section 3.
      </p>

      <h2>9. Your data</h2>
      <p>
        How we process your data is set out in the <a href="/privacy">privacy policy</a>.
        For verification we also process the evidence you submit. Please do not submit
        documents revealing more about you than the check requires, in particular no health,
        religious or political data, unless these are inherent to your project. Documents
        from rejected applications are deleted after six months unless a statutory retention
        duty applies.
      </p>
      <p>
        You can export the message history for a match at any time as a file, with
        timestamps and participants. This is meant for organisations whose internal rules
        require them to keep their own record of correspondence.
      </p>

      <h2>10. Term and termination</h2>
      <p>
        The agreement starts on activation and runs indefinitely. Either side may terminate
        on 30 days&rsquo; notice in text form to service@surpluspurpose.com. The
        verification fee is not refunded pro rata on termination unless the termination is
        due to a reason for which we are responsible. Matches already confirmed are
        completed.
      </p>

      <h2>11. Law, venue and authoritative language</h2>
      <p>
        German law applies. If you are a consumer, mandatory provisions of your country of
        habitual residence remain unaffected and the statutory venues apply. If you are a
        merchant, the venue is Munich. We try good-faith negotiation first, write to{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>.
      </p>
      <p>
        <strong>The German version is authoritative.</strong> This English version is a
        translation for information; in case of discrepancy the German text prevails.
      </p>

      <p className="note">
        Version 2026-10 · founding-phase draft, pending review by external counsel. Changed
        from 2026-08: section 2 (build-up phase), section 5 (contract concluded outside the application, passing of risk,
        transport costs), new section 8 (liability of sur.plus), renumbering.
        Questions: service@surpluspurpose.com
      </p>
    </LegalPage>
  );
}
