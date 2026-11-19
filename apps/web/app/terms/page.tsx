import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPage } from "../components/LegalPage";
import { LOCALE_COOKIE, resolveLocaleFrom } from "../lib/i18n";

export const metadata: Metadata = {
  title: "sur.plus · AGB / Terms of Service"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The document the SaaS clickwrap points at.
 *
 * It previously pointed at surpluspurpose.com, the marketing homepage. That
 * clickwrap gates match confirmation, so we were recording an auditable
 * acceptance of a document that did not exist. Terms that were never presented
 * are not incorporated (§ 305(2) BGB), and an acceptance log asserting consent
 * to nothing is worse than no log at all.
 *
 * 2026-08: German is the authoritative text (§ 12), because German law and a
 * German venue are agreed and the customers are German companies. English stays
 * as a translation for international partners.
 *
 * 2026-08 also splits a conflation that had become wrong. The old § 1 said
 * sur.plus "is not offered to consumers" full stop. That was true of the paid
 * subscription and never true of the receiving side, and since the discounted
 * transfer track opened to private individuals the website invites exactly the
 * people this document excluded. The subscription stays B2B; who may *receive*
 * is governed by the separate recipient terms.
 *
 * 2026-08-06, second pass: the plan descriptions were wrong. They had CSRD
 * documentation in Seed (it is a Tree feature since a321270), listed a
 * green-procurement certificate that was dropped in the same commit, and § 7
 * stated that unused match allowance does not roll over while the pricing page
 * promises up to six carried into the next year. Terms that contradict the
 * offer page are worse than vague ones, so the plan text now mirrors
 * surpluspurpose.com/#pricing feature for feature.
 *
 * Careful with the word "Clearance": the pricing page uses it for a fixed-price
 * clearing project on the CORPORATE side, the FAQ uses it for the discounted
 * transfer to SMEs and private individuals. Two different things. This document
 * says "vergünstigte Übernahme" for the second and names the collision.
 *
 * 2026-09 (pricing v13). Five changes, four of which create obligations that did
 * not exist under 2026-08, which is why this needs a fresh acceptance and not a
 * silent rewrite:
 *
 * 1. § 7 gains a three-month minimum term on monthly plans. Under 2026-08 a
 *    customer could cancel to the end of any billing period. Tree is unlimited
 *    matches, so one month at €389 bought what the annual plan charges €3,890
 *    for — a 90% discount available to anyone who noticed. The minimum term is
 *    the fix, and it binds the customer, so it cannot ride along under the old
 *    number. It binds us symmetrically and leaves § 314 BGB untouched.
 *
 * 2. § 3 prices the two things that were previously unpriced and unbounded.
 *    "Logistics coordination on demand" sat in the Tree list as an included
 *    feature with no limit on a fixed-price plan; it is now split into network
 *    access (included) and coordinated pickup (€390). Seed's thirteenth match
 *    had no defined consequence at all; it is now €290. Both are gated on the
 *    customer confirming in text form, so neither can produce a surprise
 *    invoice — that gate is deliberate and should survive review.
 *
 * 3. § 3 gains the First Donation Run at a fixed €2,900 with a defined scope
 *    (two pallets, one address, one date, one category family) and an
 *    undertaking: no verified recipient within four weeks and the price falls
 *    away. Scoped as a MATCHING undertaking, not a delivery guarantee — it bites
 *    before logistics is commissioned, so the exposure is our own time rather
 *    than a carrier invoice we have already paid. The carve-outs (customer
 *    rejects named recipients, goods not as described, failure within their
 *    control) are what stops it becoming a free option to walk away.
 *
 * 4. § 3 puts one year of Seed into every clearance project. Written so it ENDS
 *    after twelve months unless actively continued, with a reminder 60 days
 *    before. A free year that silently converts to a paid one would be the
 *    obvious commercial move and the wrong one — it is the pattern the Fair
 *    Consumer Contracts Act attacks in B2C, and § 307 reaches it in B2B too.
 *
 * 5. Transport is passed on WITHOUT a mark-up, in both § 3 and § 7, because
 *    that is what the pricing page now promises ("zum Selbstkostenpreis"). The
 *    €390 coordination fee is the margin. If the business later wants a mark-up
 *    on carriage, the website claim has to change first, not this clause.
 *
 * 2026-10-10, version 2026-10 (liability review, see
 * 03_LEGAL/sur.plus_Haftung_und_AGB_Review_2026-10-10.md):
 *
 * 6. § 2 now states when risk passes and that sur.plus coordinating a pickup
 *    is a coordinator, not a carrier or freight forwarder; the carrier is
 *    commissioned in the customer's name and for its account. If operations ever
 *    book carriers in sur.plus's own name, this clause (and the forwarder
 *    liability of §§ 453 ff. HGB) must be revisited first.
 *
 * 7. § 3: clearance projects that include data erasure now require an Art. 28
 *    GDPR processing agreement before erasure starts — the website promises
 *    erasure as part of Clearance, and the Legal Playbook flags Art. 28 as the
 *    open core.
 *
 * 8. § 5 expanded from one paragraph to five: identity of goods (manufacturer,
 *    model, serial — answers § 4(3) ProdHaftG), data and licences, new goods and
 *    returns (customer stays economic operator under GPSR, per the 22 Sept 2026
 *    positioning decision that returns are part of the offer), materials and
 *    semi-finished goods (not waste under § 3 KrWG, food-contact declaration).
 *
 * 9. § 6: the contract between company and private individual is expressly
 *    concluded OUTSIDE the application. With contracts concluded through our
 *    software, sur.plus would meet the definition of an online marketplace in
 *    § 312l(2) BGB and Art. 3(14) GPSR, with Art. 22 GPSR duties (contact
 *    points, Safety Gate registration, 2/3 working-day response times). The
 *    product flow must match this clause; if a one-click purchase is ever built
 *    for consumers, the clause is wrong and the duties apply.
 *
 * All of this remains a founding-phase draft pending review by counsel.
 */
export default async function TermsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);

  return locale === "de" ? <TermsDe /> : <TermsEn />;
}

function TermsDe() {
  return (
    <LegalPage locale="de" title="Allgemeine Geschäftsbedingungen" kicker="Entwurf Aufbauphase · Unternehmenskunden">
      <p className="note">
        <strong>Entwurf.</strong> sur.plus ist ein junges Unternehmen im Aufbau. Diese
        Bedingungen beschreiben, wie sur.plus heute arbeitet, in der Aufbauphase mit
        persönlich koordinierten Übergaben und einer Anwendung, die Schritt für Schritt
        dazukommt (Ziffer 2a), und stehen unter dem Vorbehalt anwaltlicher Prüfung. Wo sie schweigen oder unklar sind, gilt die für den
        Kunden günstigere Auslegung. Vor dem Wirksamwerden einer neuen Fassung für einen
        neuen Zeitraum informieren wir Sie.
      </p>

      <h2>1. Wer hier Vertragspartner ist</h2>
      <p>
        Diese Bedingungen regeln die Nutzung der sur.plus-Plattform durch ein Unternehmen
        (&bdquo;Sie&ldquo;) und die sur.plus
        UG (haftungsbeschränkt), Landsberger Straße 57, 82266 Inning am Ammersee-Stegen,
        eingetragen im Handelsregister des Amtsgerichts München unter HRB 315904, vertreten
        durch den Geschäftsführer Florian Lechner (&bdquo;sur.plus&ldquo;).
        &bdquo;Plattform&ldquo; meint beides zusammen: die von uns persönlich koordinierte
        Vermittlung und die Anwendung unter app.surpluspurpose.com, soweit sie für Sie
        freigeschaltet ist. Wo diese Bedingungen von der Anwendung sprechen, gilt dasselbe
        für den Ablauf per E-Mail, Telefon und Datei, mit dem wir in der Aufbauphase
        arbeiten.
      </p>
      <p>
        <strong>Das kostenpflichtige Abonnement richtet sich ausschließlich an Unternehmer
        im Sinne des § 14 BGB.</strong> Verbraucher können kein Abonnement abschließen. Wer
        Überschüsse <em>empfangen</em> kann, richtet sich dagegen nach den{" "}
        <a href="/recipient-terms">Nutzungsbedingungen für die Empfängerseite</a>. Dort
        können neben gemeinnützigen Organisationen und öffentlichen Trägern auch kleine
        Unternehmen und Privatpersonen stehen. Für die entgeltliche Abgabe an Verbraucher
        gilt zusätzlich Ziffer 6.
      </p>

      <h2>2. Was sur.plus tut, und was nicht</h2>
      <p>
        sur.plus ist eine Vermittlungsplattform. Wir bringen Überschüsse, die Sie nicht mehr
        benötigen, mit geprüften Empfängern zusammen, koordinieren die Übergabe und
        erstellen die zugehörige Dokumentation.
      </p>
      <p>
        <strong>Wir erwerben zu keinem Zeitpunkt Eigentum an Ihrer Ware.</strong> Die
        Übertragung erfolgt unmittelbar zwischen Ihnen und dem Empfänger. sur.plus ist nicht
        Partei dieses Geschäfts, kauft, verkauft, lagert und transportiert die Ware nicht
        und handelt dabei nicht als Ihr Stellvertreter. Eigentum, Gefahr und etwaige
        Gewährleistung gehen direkt zwischen Ihnen und dem Empfänger über.
      </p>
      <p>
        <strong>Übergabe, Gefahrübergang und Transport.</strong> Die Gefahr des zufälligen
        Untergangs und der Verschlechterung geht mit der Übergabe der Ware an den Empfänger
        oder an eine von ihm beauftragte Person über; organisieren Sie den Transport, mit der
        Ablieferung beim Empfänger. Bei einer Schenkung an einen steuerbegünstigten Empfänger
        haften Sie diesem gegenüber nach § 521 BGB nur für Vorsatz und grobe Fahrlässigkeit
        und für Mängel nur, wenn Sie sie arglistig verschwiegen haben (§ 524 BGB); eine
        zutreffende Zustandsbeschreibung nach Ziffer 5 ist deshalb Ihr wichtigster Schutz.
        Koordinieren wir auf Ihren Wunsch eine Abholung (Ziffer 3), handeln wir als
        Koordinator: Wir sind weder Frachtführer noch Spediteur. Ein Transportunternehmen
        beauftragen wir in Ihrem Namen und für Ihre Rechnung; der Beförderungsvertrag kommt
        zwischen Ihnen und dem Transportunternehmen zustande, das nach §§ 425 ff. HGB haftet.
        Beförderungssichere Verpackung und Verladung bleiben Ihre Sache (§ 412 HGB).
      </p>
      <p>
        <strong>Zuwendungsbestätigung.</strong> Ausstellen kann sie nur der empfangende
        steuerbegünstigte Träger, in eigener Verantwortung. Wir bereiten sie vor: Aus den
        Angaben, die Sie und der Empfänger zum Match hinterlegt haben, also Art und Menge
        der Ware, angesetzter Wert, Zustand, Übergabedatum und Empfängerdaten, erzeugen wir
        einen vorausgefüllten Entwurf, den der Empfänger prüft, gegebenenfalls korrigiert
        und digital signiert. Die Verantwortung für Richtigkeit und Wertansatz bleibt bei
        Ihnen und dem Empfänger. Dasselbe gilt für die Impact- und CO<sub>2</sub>-Werte, die
        wir aus Ihren Angaben berechnen.
      </p>
      <p>
        <strong>Wir erteilen keine Steuer- oder Rechtsberatung.</strong> Die Beurteilung von
        Abzugsfähigkeit, umsatzsteuerlicher Behandlung (§ 3 Abs. 1b UStG) und
        Berichtspflicht bleibt bei Ihnen und Ihren Beratern.
      </p>

      <h2>2a. Aufbauphase: wie sur.plus heute arbeitet</h2>
      <p>
        sur.plus befindet sich im Aufbau. Die ersten Übergaben laufen seit Herbst 2026, die
        Anwendung wird daneben entwickelt. Damit Sie wissen, was Sie bekommen, sagen wir
        offen, wie der Ablauf heute aussieht:
      </p>
      <p>
        <strong>Registrierung und Zugang.</strong> Sie registrieren sich über ein
        Online-Formular oder per E-Mail an service@surpluspurpose.com. Ein Konto in der
        Anwendung richten wir ein, sobald der betreffende Bereich für Unternehmenskunden
        freigeschaltet ist; bis dahin ist Ihr Ansprechpartner bei sur.plus Ihr Zugang.
      </p>
      <p>
        <strong>Matching und Übergabe.</strong> Das Matching koordinieren Menschen: Wir
        prüfen Ihre Angaben, sprechen geprüfte Empfänger an, stimmen Mengen, Termine und
        Transport mit beiden Seiten ab und begleiten die Übergabe. Angebote, Zusagen und
        Übergabetermine werden in Textform festgehalten, in der Regel per E-Mail.
      </p>
      <p>
        <strong>Dokumentation.</strong> Geräte- oder Warenliste, Übergabeprotokoll, der
        vorausgefüllte Entwurf der Zuwendungsbestätigung und der Impact-Report entstehen aus
        Ihren Angaben und der dokumentierten Übergabe. Wir liefern sie als Dateien (PDF,
        Tabelle), bis die Anwendung sie für Sie erzeugt; Inhalt und Beweiswert sind dieselben.
      </p>
      <p>
        <strong>Leistungsstand bei Vertragsschluss.</strong> Die in Ziffer 3 genannten
        Funktionen der Anwendung, etwa Dashboard, Copilot, Newsletter oder digitale
        Signatur, werden schrittweise freigeschaltet. Welche davon zum Zeitpunkt Ihres
        Vertragsschlusses verfügbar sind, teilen wir Ihnen vorher in Textform mit
        (Leistungsübersicht). Noch nicht verfügbare Funktionen erbringen wir persönlich oder
        als Datei, soweit das ihrem Zweck nach möglich ist; sie sind kein Mangel der
        Plattform. Was weder in der Anwendung noch persönlich erbracht werden kann, ist für
        die Dauer der Nichtverfügbarkeit nicht geschuldet und wird im Preis berücksichtigt,
        den wir Ihnen nennen.
      </p>
      <p>
        <strong>Pilotcharakter.</strong> Unternehmen, die in der Aufbauphase mit uns
        arbeiten, bekommen mehr persönliche Begleitung und weniger Software als später.
        Rückmeldungen zum Ablauf fließen in die Entwicklung ein; eine Pflicht zur Mitwirkung
        an Produktentwicklung oder Kommunikation entsteht daraus nicht, Ihre Nennung bleibt
        an Ihre Einwilligung nach Ziffer 10 gebunden.
      </p>

      <h2>3. Zugang und Tarife</h2>
      <p>
        Die Registrierung ist kostenlos und öffnet die Plattform: Sie sehen, was geprüfte
        Empfänger aktuell benötigen, einschließlich der Organisation hinter jedem Bedarf, in
        der Aufbauphase als Bedarfsübersicht, die wir Ihnen zusenden. Kontaktdaten und ein
        koordinierter Match setzen einen kostenpflichtigen Tarif oder eine Projektleistung
        voraus.
      </p>
      <p>
        <strong>Pulse</strong> ist kostenlos und umfasst nur das Assessment:
        Impact-Potenzial-Score, Potenzial-Report als PDF und eine ESRS-Relevanzübersicht.
        Kein Konto erforderlich, kein Zugang zum Netzwerk.
      </p>
      <p>
        <strong>Seed</strong> umfasst bis zu 12 Matches je Kalenderjahr, Zugang zum
        geprüften Empfängernetzwerk, die Spendenübersicht im Dashboard, die automatisch
        erzeugte und vom Empfänger digital signierte Zuwendungsbestätigung, den AI Copilot
        für Listings und Impact-Texte, 2 Nutzerplätze, einen Onboarding-Call und Support mit
        Reaktion innerhalb von 48 Stunden.
      </p>
      <p>
        <strong>Weitere Matches in Seed.</strong> Über die zwölf enthaltenen Matches hinaus
        berechnen wir 290 € je weiterem Match. Wir führen einen solchen Match erst aus,
        nachdem Sie die Mehrkosten in Textform bestätigt haben. Ohne diese Bestätigung
        entsteht keine Forderung, und der Match unterbleibt.
      </p>
      <p>
        <strong>Tree</strong> umfasst alles aus Seed, dazu unbegrenzte Matches mit
        kuratiertem Priority-Matching, die CSRD-Dokumentation je Match mit Warenwert,
        Empfänger und CO<sub>2</sub>e in prüfungssicherer Form (ISAE 3000, Audit-Trail),
        Zugang zum Netzwerk sozialer Service-Partner, erweiterte Copilot-Funktionen, den wöchentlichen Impact- und Bedarfs-Newsletter, das
        Marketing-Dashboard, 5 Nutzerplätze und Priority-Support.
      </p>
      <p>
        Die <strong>prüfungssichere CSRD-Dokumentation ist Bestandteil von Tree.</strong> In
        Seed erhalten Sie die Spendenübersicht und die Zuwendungsbestätigung je Match, nicht
        den vollständigen Berichtssatz.
      </p>
      <p>
        <strong>Logistik.</strong> In Tree enthalten ist der Zugang zu unseren geprüften
        Logistikpartnern: deren Konditionen, unsere Packvorgaben und der mit dem Empfänger
        abgestimmte Übergabetermin. Die Beauftragung des Transports nehmen Sie selbst vor.
        Übernehmen wir die Koordination einer Abholung für Sie, berechnen wir dafür 390 € je
        Abholung. Die Transportkosten selbst geben wir ohne Aufschlag weiter und legen die
        Rechnung des Frachtführers auf Wunsch offen. Bei den Projektleistungen des nächsten
        Absatzes ist beides im Festpreis enthalten.
      </p>
      <p>
        Daneben bieten wir zwei Projektleistungen ohne Abonnement an. Die{" "}
        <strong>Erste Spendenaktion</strong> umfasst eine Abholung zum Festpreis von 2.900 €.
        Eine Abholung sind bis zu zwei Paletten von einer Abholadresse an einem vereinbarten
        Termin aus einer Kategoriefamilie, etwa IT oder Möbel oder Werkzeuge. Wie viele
        Empfänger die Ware aufnehmen, begrenzen wir nicht und berechnen wir nicht. Größeres
        Volumen, mehrere Standorte oder gemischte Kategorien sind{" "}
        <strong>Clearance und Logistik</strong>, ein Einzelprojekt zum Festpreis, der vor
        Projektstart feststeht. Nicht zu verwechseln mit der vergünstigten Übernahme nach
        Ziffer 6, die dasselbe Wort trägt, aber die Empfängerseite betrifft.
      </p>
      <p>
        <strong>Datenlöschung im Clearance-Projekt.</strong> Umfasst ein Clearance-Projekt die
        Löschung von Datenträgern, führt sie ein von uns benannter, dafür zertifizierter
        Partner durch. Weil dabei personenbezogene Daten in unserem Auftrag verarbeitet
        werden können, schließen wir mit Ihnen vor Beginn einen Vertrag zur
        Auftragsverarbeitung nach Art. 28 DSGVO, in dem der Partner als weiterer
        Auftragsverarbeiter benannt ist. Ohne diesen Vertrag beginnt die Löschung nicht. Die
        Löschnachweise je Seriennummer werden Teil Ihrer Projektakte.
      </p>
      <p>
        <strong>Zusage zur Ersten Spendenaktion.</strong> Finden wir innerhalb von vier Wochen
        keinen geprüften Empfänger für Ihre Ware, entfällt der Festpreis vollständig; bereits
        gezahlte Beträge erstatten wir. Die Frist beginnt, sobald der Auftrag erteilt ist und
        uns Ihre Angaben zu Art, Menge, Zustand und Standort der Ware vollständig vorliegen.
        Die Zusage greift nicht, soweit Sie von uns benannte geprüfte Empfänger ablehnen, die
        Ware nicht Ihren Angaben entspricht oder die Übergabe aus Gründen unterbleibt, die Sie
        zu vertreten haben. Aufwendungen, die wir auf Ihren ausdrücklichen Wunsch vorab
        veranlasst haben, etwa eine Besichtigung vor Ort, bleiben unberührt.
      </p>
      <p>
        <strong>Anrechnung.</strong> Beauftragen Sie innerhalb von zwölf Monaten nach einer
        Ersten Spendenaktion ein Clearance-Projekt, rechnen wir den dafür gezahlten Festpreis
        vollständig auf dessen Preis an.
      </p>
      <p>
        <strong>Enthaltenes Abonnement.</strong> Im Preis eines Clearance-Projekts ist ein
        Jahr Seed enthalten, gerechnet ab Projektbeginn. Dieses Jahr verlängert sich nicht
        automatisch und geht nicht selbsttätig in ein kostenpflichtiges Abonnement über: Es
        endet nach zwölf Monaten, wenn Sie es nicht ausdrücklich fortsetzen. Spätestens 60
        Tage vor Ablauf weisen wir Sie in Textform darauf hin.
      </p>
      <p>
        Die jeweils aktuellen Preise stehen unter surpluspurpose.com/#pricing. Für
        Unternehmen ab etwa 500 Mitarbeitenden oder mit mehreren Standorten vereinbaren wir
        Scale- und Enterprise-Konditionen gesondert.
      </p>
      <p>
        Das Matching wird in der Aufbauphase von Menschen koordiniert (Ziffer 2a). Wir
        schulden keinen Match: er hängt davon ab, ob ein geprüfter Empfänger das benötigt,
        was Sie anbieten.
      </p>

      <h2>4. Kontakte bleiben auf der Plattform</h2>
      <p>
        Kontaktdaten von Empfängern werden Ihnen zum Zweck der Abwicklung eines konkreten
        Matches offengelegt. Sie verpflichten sich, diese Daten für die Laufzeit Ihres
        Tarifs und zwölf Monate darüber hinaus nicht zu nutzen, um vergleichbare Übergaben
        mit demselben Empfänger außerhalb von sur.plus zu verabreden, und sie nicht an
        Dritte weiterzugeben. Das ist es, was das Netzwerk für gemeinnützige Empfänger
        kostenlos hält: sie sind nicht das Produkt und keine Adressliste.
      </p>
      <p>
        Bestehende Beziehungen, die Sie vor der Vermittlung durch sur.plus zu einem
        Empfänger hatten, bleiben unberührt, ebenso Kontakte, die der Empfänger zu anderen
        Zwecken von sich aus aufnimmt.
      </p>

      <h2>5. Was wir von Ihnen erwarten</h2>
      <p>
        Stellen Sie nur Ware ein, die Ihnen gehört und über die Sie verfügen dürfen, die für
        ihren Zweck brauchbar und deren Weitergabe zulässig ist. Geleaste, gemietete oder
        unter Eigentumsvorbehalt stehende Gegenstände gehören nicht dazu. Stellen Sie keine
        zurückgerufenen, unsicheren, abgelaufenen oder sanktionierten Gegenstände ein.
        Beschreiben Sie den Zustand zutreffend und benennen Sie bekannte Mängel: der
        Empfänger plant damit, die Zuwendungsbestätigung beruht darauf, und ein benannter
        Mangel ist kein verschwiegener.
      </p>
      <p>
        <strong>Identität der Ware.</strong> Geben Sie je Position Hersteller, Modell und,
        soweit vorhanden, Seriennummer oder Chargennummer an. Das ist die Grundlage der
        Zuwendungsbestätigung, ermöglicht die Prüfung auf Rückrufe und erlaubt es Ihnen, im
        Fall eines Produktschadens den Hersteller zu benennen (§ 4 Abs. 3 ProdHaftG).
      </p>
      <p>
        <strong>Daten und Lizenzen.</strong> Stellen Sie keine Geräte ein, auf denen sich noch
        personenbezogene Daten befinden oder die in einer Geräteverwaltung eingebunden oder
        durch eine Aktivierungssperre geschützt sind. Das Löschen von IT-Hardware liegt bei
        Ihnen, soweit es nicht ausdrücklich Teil eines Clearance-Projekts nach Ziffer 3 ist.
        Geben Sie installierte Software nur weiter, wenn die Lizenz mit dem Gerät übergehen
        darf, und vermerken Sie die Lizenzlage.
      </p>
      <p>
        <strong>Neuware und Retouren.</strong> Geben Sie unverkaufte Ware oder Retouren ab,
        bleiben Sie für diese Ware Wirtschaftsakteur im Sinne der Verordnung (EU) 2023/988.
        Sie stellen sicher, dass die Ware den für sie geltenden Sicherheits- und
        Kennzeichnungsanforderungen entspricht, geben Herstellerangaben, Warnhinweise und
        Anleitungen mit und teilen uns Rückrufe oder Sicherheitswarnungen, die eingestellte
        Ware betreffen, unverzüglich mit; wir informieren dann die betroffenen Empfänger.
      </p>
      <p>
        <strong>Materialien und Halbzeuge.</strong> Stellen Sie Materialien ein, etwa Folien,
        Holz, Metall oder Stoffe, bestätigen Sie, dass es sich um Ware zur weiteren Verwendung
        und nicht um Abfall im Sinne des § 3 KrWG handelt und dass sie keine Gefahrstoffe
        enthält. Geben Sie ein Datenblatt oder die wesentlichen Materialangaben mit. Für
        Materialien, die mit Lebensmitteln in Berührung kommen könnten, geben Sie an, ob eine
        Konformitätserklärung nach Art. 16 der Verordnung (EG) Nr. 1935/2004 vorliegt;
        andernfalls kennzeichnen wir die Ware als nicht für den Lebensmittelkontakt bestimmt.
      </p>

      <h2>6. Vergünstigte Übernahme durch kleine Unternehmen und Privatpersonen</h2>
      <p className="note">
        Diese Ziffer ist neu (Fassung 2026-08) und wurde in der Fassung 2026-10 um den
        Vertragsschluss außerhalb der Anwendung ergänzt. Sie ist der Teil dieser Bedingungen,
        für den wir die anwaltliche Prüfung am dringendsten benötigen.
      </p>
      <p>
        Empfänger sind in der Regel steuerbegünstigte Körperschaften sowie öffentliche und
        kirchliche Träger. Daneben können auch kleine Unternehmen und Privatpersonen mit
        einem gemeinwohlorientierten Projekt Überschüsse erhalten. Üblich ist dabei die
        vergünstigte Übernahme gegen einen symbolischen Preis mit Rechnung, weil eine
        unentgeltliche Abgabe an diese Gruppen keine abzugsfähige Spende ist und beim
        Empfänger als Betriebseinnahme zu behandeln sein kann. Eine unentgeltliche Abgabe
        bleibt möglich, wenn Sie das ausdrücklich so wollen; sie hat dann keine
        Spendenwirkung. Welche Variante gewählt wird, entscheiden Sie im Angebot.
      </p>
      <p>
        <strong>Bei entgeltlicher Abgabe kommt der Kaufvertrag unmittelbar zwischen Ihnen
        und dem Empfänger zustande.</strong> sur.plus vermittelt, ist nicht Verkäufer und
        tritt nicht in den Kaufvertrag ein. Verkäufer sind Sie, mit allen Pflichten, die
        daran hängen.
      </p>
      <p>
        <strong>Der Vertrag wird nicht über die Anwendung geschlossen.</strong> Die
        Anwendung stellt den Kontakt her, zeigt Ihr Angebot und dokumentiert die Übergabe.
        Angebot und Annahme erklären Sie und der Empfänger unmittelbar gegeneinander,
        außerhalb der Anwendung, etwa per E-Mail oder bei der Besichtigung; wir stellen dafür
        die vollständigen Kontaktdaten bereit. sur.plus betreibt damit keinen
        Online-Marktplatz im Sinne des § 312l Abs. 2 BGB und des Art. 3 Nr. 14 der Verordnung
        (EU) 2023/988. Ändert sich der Ablauf, informieren wir Sie vorab.
      </p>
      <p>
        <strong>Gegenüber Verbrauchern</strong> (§ 13 BGB) bedeutet das insbesondere: Sie
        schulden die gesetzliche Mängelhaftung. Bei gebrauchten Sachen kann sie auf ein Jahr
        verkürzt, nach § 476 Abs. 2 BGB aber nicht ausgeschlossen werden. Schließen Sie den
        Vertrag im Fernabsatz, etwa per E-Mail, treffen Sie außerdem die Informationspflichten
        nach Art. 246a EGBGB und die Pflicht, über das Widerrufsrecht zu belehren. sur.plus
        stellt Ihnen dafür eine Musterbelehrung und ein Muster-Widerrufsformular bereit
        (siehe <a href="/withdrawal">Widerrufsbelehrung</a>) und weist Sie im Ablauf darauf
        hin, sobald der Empfänger ein Verbraucher ist. Die Verantwortung für die
        ordnungsgemäße Erteilung bleibt bei Ihnen.
      </p>
      <p>
        <strong>Produktsicherheit.</strong> Die Verordnung (EU) 2023/988 (GPSR) erfasst die
        entgeltliche und die unentgeltliche Bereitstellung von Produkten, die für Verbraucher
        bestimmt sind oder wahrscheinlich von ihnen benutzt werden, auch gebrauchter
        Produkte. Sie treffen dabei die Sorgfaltspflichten eines Händlers (Art. 12 GPSR).
        Geben Sie deshalb keine Ware ab, für die ein Rückruf oder eine Sicherheitswarnung
        besteht, lassen Sie Kennzeichnung und Anleitungen am Produkt, kennzeichnen Sie
        reparaturbedürftige Ware eindeutig als solche und teilen Sie uns bekannte
        Sicherheitsmängel unverzüglich mit. Wir unterhalten eine Kontaktstelle für Produktsicherheit unter
        service@surpluspurpose.com und leiten Meldungen an Sie weiter.
      </p>
      <p>
        <strong>Elektrogeräte.</strong> Bei der Abgabe gebrauchter Elektro- und
        Elektronikgeräte an Privatpersonen können Pflichten nach ElektroG und Batterierecht
        bestehen. Prüfen Sie das vor der Einstellung; sur.plus übernimmt insoweit keine
        Registrierungs- oder Rücknahmepflichten für Sie.
      </p>

      <h2>7. Zahlung, Laufzeit und Preisänderungen</h2>
      <p>
        Tarife laufen monatlich oder jährlich, wie bei der Anmeldung gewählt, und verlängern
        sich um denselben Zeitraum, wenn nicht vor Ablauf des laufenden gekündigt wird.
        Jahrestarife werden im Voraus in Rechnung gestellt. Preise verstehen sich netto
        zuzüglich Umsatzsteuer, soweit sie anfällt.
      </p>
      <p>
        <strong>Mindestlaufzeit der Monatstarife.</strong> Monatstarife haben eine
        Mindestlaufzeit von drei Monaten ab Vertragsbeginn. Danach können Sie zum Ende jedes
        Kalendermonats kündigen. Jahrestarife laufen zwölf Monate. Das Recht zur
        außerordentlichen Kündigung aus wichtigem Grund bleibt für beide Seiten unberührt.
      </p>
      <p>
        <strong>Zusätzliche Leistungen.</strong> Weitere Matches nach Ziffer 3 und von uns
        koordinierte Abholungen rechnen wir mit der nächsten turnusmäßigen Rechnung ab.
        Transportkosten, die wir für Sie verauslagt haben, weisen wir gesondert und ohne
        Aufschlag aus.
      </p>
      <p>
        Preisänderungen kündigen wir mindestens 60 Tage vor Wirksamwerden in Textform an.
        Sie können bis zum Wirksamwerden kündigen, wenn Sie die Änderung nicht annehmen. Die
        Frist ist von uns gesetzt und nicht gesetzlich vorgegeben; sie soll Ihnen genug Zeit
        für die Entscheidung lassen.
      </p>
      <p>
        <strong>Nicht genutzte Matches.</strong> In Seed nehmen Sie bis zu sechs nicht
        genutzte Matches bei Verlängerung in das Folgejahr mit. Darüber hinausgehende Matches
        verfallen. In Tree stellt sich die Frage nicht, weil die Zahl der Matches dort nicht
        begrenzt ist.
      </p>

      <h2>8. Verfügbarkeit</h2>
      <p>
        In der Aufbauphase sagen wir keine Verfügbarkeitsquote zu, und wir sagen das
        offen, statt eine zuzusagen, die wir noch nicht halten können. Wir streben
        durchgehende Verfügbarkeit an und kündigen geplante Wartung an.
      </p>

      <h2>9. Haftung</h2>
      <p>
        sur.plus haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für
        Verletzungen von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haften
        wir nur für die Verletzung einer für die Erreichung des Vertragszwecks wesentlichen
        Pflicht und dann begrenzt auf den vorhersehbaren, vertragstypischen Schaden. Für
        Beschaffenheit, Eignung und rechtmäßige Verwendung der Ware selbst sowie für den
        Umgang des Empfängers damit haften wir nicht, weil wir an dieser Übertragung nicht
        beteiligt sind (Ziffer 2 und 6). Ebenso wenig haften wir für Verlust, Beschädigung
        oder Verzögerung beim Transport durch ein von Ihnen oder in Ihrem Namen beauftragtes
        Transportunternehmen. Wir stellen die Ware weder her noch führen wir sie ein noch
        liefern wir sie. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.
      </p>
      <p>
        Die von uns erzeugten Impact- und CO<sub>2</sub>-Werte beruhen auf den von Ihnen und
        vom Empfänger gemachten Angaben und auf anerkannten Berechnungsgrundlagen (GHG
        Protocol, GIIN IRIS+). Wir erstellen sie mit Sorgfalt, schulden aber keine
        prüfungsfeste Richtigkeit für Ihre Berichterstattung; deren Verantwortung bleibt bei
        Ihnen.
      </p>

      <h2>10. Ihre Daten und Ihre Inhalte</h2>
      <p>
        Alle Rechte an den von Ihnen eingegebenen Daten bleiben bei Ihnen. Wir verarbeiten
        sie, um die Plattform zu betreiben und Ihre Dokumentation zu erstellen, siehe{" "}
        <a href="/privacy">Datenschutzerklärung</a>. Wir verkaufen sie nicht und nutzen Ihre
        Überschussdaten nicht außerhalb der Plattform. Ihr Arbeitsbereich in der Anwendung
        ist vor der Schließung exportierbar und wird 30 Tage danach gelöscht, vorbehaltlich
        gesetzlicher Aufbewahrungspflichten; Unterlagen, die wir Ihnen in der Aufbauphase
        als Dateien geliefert haben, bleiben bei Ihnen.
      </p>
      <p>
        <strong>Export der Match-Kommunikation.</strong> Manche Unternehmen dürfen
        geschäftliche Kommunikation nicht ausschließlich auf einer externen Plattform führen.
        Deshalb können Sie den vollständigen Nachrichtenverlauf zu einem Match jederzeit als
        Datei erhalten, aus der Anwendung exportiert oder, solange die Kommunikation per
        E-Mail läuft, als Zusammenstellung von uns, mit Zeitstempel und Beteiligten, und ihn in Ihre eigene Ablage
        oder Ihr Archivierungssystem übernehmen. Auf Wunsch richten wir eine automatische
        Kopie an eine von Ihnen benannte Adresse ein. Sagen Sie uns Bescheid, wenn Ihre
        Compliance-Vorgaben eine bestimmte Form verlangen.
      </p>
      <p>
        Ihr Unternehmen nennen wir namentlich nur mit Ihrer vorherigen Einwilligung.
        Anonymisierte oder aggregierte Wirkungszahlen dürfen wir ohne diese verwenden.
      </p>

      <h2>11. Kündigung</h2>
      <p>
        Beide Seiten können zum Ende des laufenden Abrechnungszeitraums kündigen, bei
        Monatstarifen frühestens zum Ablauf der Mindestlaufzeit nach Ziffer 7. Bei einer
        erheblichen Pflichtverletzung, insbesondere dem Einstellen fremder Ware oder der
        Umgehung von Ziffer 4, können wir ein Konto sofort sperren. Bereits bestätigte
        Matches werden abgewickelt.
      </p>

      <h2>12. Recht, Gerichtsstand und maßgebliche Sprache</h2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Sind Sie Kaufmann, ist
        Gerichtsstand München. Wir versuchen zunächst eine einvernehmliche Lösung, schreiben
        Sie an <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>.
      </p>
      <p>
        <strong>Maßgeblich ist die deutsche Fassung dieser Bedingungen.</strong> Die
        englische Fassung ist eine Übersetzung zur Information; bei Abweichungen geht der
        deutsche Text vor.
      </p>

      <p className="note">
        Fassung 2026-10 · Entwurf der Aufbauphase, anwaltliche Prüfung ausstehend.
        Geändert gegenüber 2026-09: Ziffer 1 (Begriff Plattform), neue Ziffer 2a
        (Aufbauphase), Ziffer 2 (Gefahrübergang, Transport), Ziffer 3
        (Datenlöschung im Clearance-Projekt), Ziffer 5 (Identität der Ware, Daten und
        Lizenzen, Neuware und Retouren, Materialien), Ziffer 6 (Vertragsschluss außerhalb der
        Anwendung, Produktsicherheit), Ziffer 9 (Transport). Fragen zu diesen Bedingungen:
        service@surpluspurpose.com
      </p>
    </LegalPage>
  );
}

function TermsEn() {
  return (
    <LegalPage locale="en" title="Terms of Service" kicker="Founding-phase draft · Corporate customers">
      <p className="note">
        <strong>Translation.</strong> The German version of these terms is the authoritative
        one (section 12). This English text is provided for information; where the two
        differ, the German text prevails.
      </p>
      <p className="note">
        <strong>Draft.</strong> sur.plus is a young company still being built. These terms
        describe how sur.plus works today, in a build-up phase with personally coordinated
        handovers and an application that is being added step by step (section 2a), and are
        pending review by external counsel. Where they are
        silent or unclear, the more customer-favourable reading applies.
      </p>

      <h2>1. Who this is between</h2>
      <p>
        These terms govern use of the sur.plus platform by a company (&ldquo;you&rdquo;)
        and sur.plus UG
        (haftungsbeschränkt), Landsberger Straße 57, 82266 Inning am Ammersee-Stegen,
        Germany, registered with the commercial register of the Munich Local Court under
        HRB 315904, represented by its managing director Florian Lechner
        (&ldquo;sur.plus&rdquo;). &ldquo;Platform&rdquo; means both together: the
        intermediation we coordinate personally and the application at
        app.surpluspurpose.com, to the extent it has been enabled for you. Where these terms
        refer to the application, the same applies to the e-mail, phone and file-based
        process we work with during the build-up phase.
      </p>
      <p>
        <strong>The paid subscription is offered to businesses only (§ 14 BGB).</strong>{" "}
        Consumers cannot take out a subscription. Who may <em>receive</em> surplus is
        governed by the separate <a href="/recipient-terms">recipient terms</a>, which also
        cover small businesses and private individuals. For paid transfers to consumers,
        section 6 applies in addition.
      </p>

      <h2>2. What sur.plus does, and does not do</h2>
      <p>
        sur.plus is an intermediation platform. We match surplus goods you no longer need
        with verified recipients, coordinate the handover, and generate the documentation
        for it.
      </p>
      <p>
        <strong>We never take ownership of your goods.</strong> The transfer is direct
        between you and the recipient. sur.plus is not a party to it, does not buy, sell,
        store or transport the goods, and does not act as your agent. Title, risk and any
        warranty pass directly between you and the recipient.
      </p>
      <p>
        <strong>Handover, passing of risk and transport.</strong> The risk of accidental loss
        or deterioration passes when the goods are handed over to the recipient or to a person
        acting on its behalf; where you organise transport, on delivery to the recipient. For a
        gift to a tax-privileged recipient you are liable to that recipient only for intent
        and gross negligence under § 521 BGB, and for defects only where you concealed them
        fraudulently (§ 524 BGB); an accurate description of condition under section 5 is
        therefore your most important protection. Where we coordinate a pickup at your request
        (section 3), we act as coordinator: we are neither carrier nor freight forwarder. We
        commission a transport company in your name and for your account; the contract of
        carriage is between you and that company, which is liable under §§ 425 et seq. HGB.
        Packing and loading safe for carriage remain your responsibility (§ 412 HGB).
      </p>
      <p>
        <strong>Donation receipt.</strong> Only the receiving tax-privileged organisation
        can issue it, on its own responsibility. We prepare it: from the details you and the
        recipient recorded for the match, meaning type and quantity of goods, the value
        applied, condition, handover date and recipient data, we generate a pre-filled draft
        that the recipient reviews, corrects where needed and signs digitally.
        Responsibility for accuracy and valuation stays with you and the recipient. The same
        applies to the impact and CO<sub>2</sub> figures we calculate from your input.
      </p>
      <p>
        <strong>We do not give tax or legal advice.</strong> The assessment of
        deductibility, VAT treatment (§ 3(1b) UStG) and reportability remains yours and your
        advisors&rsquo;.
      </p>

      <h2>2a. Build-up phase: how sur.plus works today</h2>
      <p>
        sur.plus is being built. The first handovers have been running since autumn 2026;
        the application is being developed alongside. So that you know what you are getting,
        this is how the process works today:
      </p>
      <p>
        <strong>Registration and access.</strong> You register through an online form or by
        e-mail to service@surpluspurpose.com. We set up an account in the application once
        the relevant area has been enabled for corporate customers; until then, your contact
        at sur.plus is your access.
      </p>
      <p>
        <strong>Matching and handover.</strong> Matching is coordinated by people: we check
        your details, approach verified recipients, agree quantities, dates and transport
        with both sides and accompany the handover. Offers, commitments and handover dates
        are recorded in text form, usually by e-mail.
      </p>
      <p>
        <strong>Documentation.</strong> The device or goods list, the handover record, the
        pre-filled draft of the donation receipt and the impact report are produced from your
        details and the documented handover. We deliver them as files (PDF, spreadsheet)
        until the application generates them for you; content and evidential value are the
        same.
      </p>
      <p>
        <strong>Feature status at the time of contracting.</strong> The application features
        named in section 3, such as dashboard, copilot, newsletter or digital signature, are
        enabled step by step. We tell you in text form beforehand which of them are available
        at the time you contract (feature overview). Features not yet available we provide
        personally or as a file where their purpose allows; they are not a defect of the
        platform. What can be provided neither in the application nor personally is not owed
        for the duration of its unavailability and is reflected in the price we quote you.
      </p>
      <p>
        <strong>Pilot character.</strong> Companies that work with us during the build-up
        phase get more personal support and less software than later customers will.
        Feedback on the process flows into development; no obligation to take part in product
        development or communication arises from this, and naming you remains subject to your
        consent under section 10.
      </p>

      <h2>3. Access and plans</h2>
      <p>
        Registration is free and opens the platform: you can browse what verified recipients
        currently need, including which organisation posted each need. Contact details and a
        coordinated match require a paid plan.
      </p>
      <p>
        <strong>Pulse</strong> is free and covers the assessment only: impact potential
        score, potential report as a PDF, and an ESRS relevance overview. No account needed,
        no network access.
      </p>
      <p>
        <strong>Seed</strong> covers up to 12 matches per calendar year, access to the
        verified recipient network, the donation overview in the dashboard, the automatically
        generated donation receipt digitally signed by the recipient, the AI copilot for
        listings and impact copy, 2 user seats, an onboarding call, and support responding
        within 48 hours.
      </p>
      <p>
        <strong>Further matches in Seed.</strong> Beyond the twelve included matches we charge
        €290 per further match. We carry out such a match only after you have confirmed the
        additional charge in text form. Without that confirmation no claim arises and the
        match does not go ahead.
      </p>
      <p>
        <strong>Tree</strong> covers everything in Seed, plus unlimited matches with curated
        priority matching, CSRD documentation per match with goods value, recipient and
        CO<sub>2</sub>e in audit-grade form (ISAE 3000, audit trail), access to the network
        of social service partners, extended copilot features, the weekly impact and needs newsletter, the marketing dashboard, 5 user
        seats and priority support.
      </p>
      <p>
        <strong>Audit-grade CSRD documentation is part of Tree.</strong> Seed gives you the
        donation overview and the per-match donation receipt, not the full reporting set.
      </p>
      <p>
        <strong>Logistics.</strong> Tree includes access to our vetted logistics partners:
        their rates, our packing specifications and the handover slot agreed with the
        recipient. You commission the transport yourself. Where we coordinate a pickup for
        you, we charge €390 per pickup. The transport cost itself is passed on without a
        mark-up, and we disclose the carrier&rsquo;s invoice on request. In the project
        services described in the next paragraph, both are included in the fixed price.
      </p>
      <p>
        Separately we offer two project services without a subscription. The{" "}
        <strong>First Donation Run</strong> covers one pickup at a fixed price of €2,900. One
        pickup means up to two pallets from one collection address on one agreed date, from
        one category family, such as IT or furniture or tools. How many recipients take the
        goods is neither limited nor charged for. Larger volumes, several sites or mixed
        categories are <strong>clearance and logistics</strong>, a one-off project at a fixed
        price set before the project starts. Not to be confused with the discounted transfer
        under section 6, which shares the word but concerns the receiving side.
      </p>
      <p>
        <strong>Data erasure in a clearance project.</strong> Where a clearance project
        includes the erasure of data carriers, a certified partner named by us performs it.
        Because personal data may be processed on our instructions in the course of this, we
        conclude a data processing agreement under Art. 28 GDPR with you before the project
        starts, naming the partner as sub-processor. Erasure does not begin without that
        agreement. The erasure records per serial number become part of your project file.
      </p>
      <p>
        <strong>Our undertaking for the First Donation Run.</strong> If we do not find a
        verified recipient for your goods within four weeks, the fixed price falls away
        entirely and we refund anything already paid. The period starts once the order is
        placed and your details on the type, quantity, condition and location of the goods are
        complete. The undertaking does not apply where you reject verified recipients we have
        named, where the goods do not match your description, or where the handover fails for
        reasons within your control. Expenses we incurred in advance at your express request,
        such as an on-site inspection, remain payable.
      </p>
      <p>
        <strong>Credit.</strong> If you commission a clearance project within twelve months of
        a First Donation Run, we credit the fixed price paid for it in full against the price
        of that project.
      </p>
      <p>
        <strong>Included subscription.</strong> The price of a clearance project includes one
        year of Seed, counted from the start of the project. That year does not renew
        automatically and does not roll over into a paid subscription by itself: it ends after
        twelve months unless you expressly continue it. We will remind you in text form at
        least 60 days before it expires.
      </p>
      <p>
        Current prices are shown at surpluspurpose.com/#pricing. For companies above roughly
        500 employees or with multiple sites we agree Scale and Enterprise terms separately.
      </p>
      <p>
        Matching is human-coordinated during the build-up phase (section 2a). We do not owe a match: it
        depends on whether a verified recipient needs what you have.
      </p>

      <h2>4. Connections stay on the platform</h2>
      <p>
        Recipient contact details are disclosed to you for the purpose of completing a
        specific match. You agree not to use them to arrange comparable transfers with that
        recipient outside sur.plus for the duration of your plan and 12 months after, and
        not to pass them to third parties. This is what keeps the network free for
        non-profits: they are not the product, and they are not a lead list.
      </p>
      <p>
        Nothing here restricts a relationship you already had with a recipient before
        sur.plus introduced you, or contact the recipient initiates for other purposes.
      </p>

      <h2>5. What we ask of you</h2>
      <p>
        Only list goods you own and are entitled to dispose of, that are usable for their
        purpose, and that are lawful to transfer. Leased or rented items and items subject to
        retention of title are not among them. Do not list recalled, unsafe, expired or
        sanctioned items. Describe condition accurately and name known defects: a recipient
        plans around it, the donation receipt is based on it, and a named defect is not a
        concealed one.
      </p>
      <p>
        <strong>Identity of the goods.</strong> State manufacturer, model and, where
        available, serial or batch number per line item. This is the basis of the donation
        receipt, enables recall checks and allows you to name the manufacturer in the event of
        a product-related damage claim (§ 4(3) ProdHaftG).
      </p>
      <p>
        <strong>Data and licences.</strong> Do not list devices that still hold personal data
        or that are enrolled in device management or protected by an activation lock. Wiping IT
        hardware is your responsibility unless it is expressly part of a clearance project
        under section 3. Pass on installed software only where the licence may transfer with
        the device, and record the licence position.
      </p>
      <p>
        <strong>New goods and returns.</strong> Where you release unsold goods or returns, you
        remain the economic operator for those goods under Regulation (EU) 2023/988. You ensure
        that the goods meet the safety and labelling requirements applicable to them, supply
        manufacturer details, warnings and instructions, and tell us without delay about any
        recall or safety warning concerning listed goods; we then inform the recipients
        concerned.
      </p>
      <p>
        <strong>Materials and semi-finished goods.</strong> Where you list materials such as
        film, timber, metal or fabric, you confirm that they are goods for further use and not
        waste within the meaning of § 3 KrWG, and that they contain no hazardous substances.
        Supply a data sheet or the essential material details. For materials that could come
        into contact with food, state whether a declaration of conformity under Art. 16 of
        Regulation (EC) No 1935/2004 exists; otherwise we mark the goods as not intended for
        food contact.
      </p>

      <h2>6. Discounted transfer to small businesses and private individuals</h2>
      <p>
        Recipients are usually tax-privileged organisations and public or church-run bodies.
        Small businesses and private individuals running a public-benefit project may also
        receive surplus. The usual route is a discounted transfer for a symbolic price
        against an invoice, because an outright gift to these groups is not a deductible
        donation and may count as taxable income for the recipient. An outright gift remains
        possible if you expressly want that; it then carries no donation effect. You choose
        the route in the offer.
      </p>
      <p>
        <strong>For a paid transfer, the sale is concluded directly between you and the
        recipient.</strong> sur.plus intermediates, is not the seller and does not become a
        party to the sale. You are the seller, with the obligations that follow.
      </p>
      <p>
        <strong>The contract is not concluded through the application.</strong> The
        application makes the introduction, displays your offer and documents the handover.
        Offer and acceptance are exchanged directly between you and the recipient, outside the
        application, for instance by e-mail or at an inspection; we provide full contact
        details for that purpose. sur.plus therefore does not operate an online marketplace
        within the meaning of § 312l(2) BGB or Art. 3(14) of Regulation (EU) 2023/988. Should
        the flow change, we will inform you in advance.
      </p>
      <p>
        <strong>Towards consumers</strong> (§ 13 BGB) this means in particular: statutory
        liability for defects applies. For used goods it may be shortened to one year but,
        under § 476(2) BGB, not excluded. Where you conclude the contract at a distance, for
        instance by e-mail, the information duties under Art. 246a EGBGB and the duty to
        instruct on the right of withdrawal also apply to you. sur.plus provides a model instruction and model
        withdrawal form for this (see <a href="/withdrawal">withdrawal</a>) and flags it in
        the flow once the recipient is a consumer. Correct provision remains your
        responsibility.
      </p>
      <p>
        <strong>Product safety.</strong> Regulation (EU) 2023/988 (GPSR) covers the supply,
        for payment or free of charge, of products intended for or likely to be used by
        consumers, including used products. You bear the due-diligence duties of a
        distributor (Art. 12 GPSR). Do not offer goods subject to a recall or safety warning,
        leave labelling and instructions on the product, clearly mark goods that need repair
        before use as such, and tell us about known safety defects without delay. We maintain a product safety contact point at
        service@surpluspurpose.com and forward reports to you.
      </p>
      <p>
        <strong>Electrical equipment.</strong> Transferring used electrical and electronic
        equipment to private individuals may trigger duties under ElektroG and battery law.
        Check this before listing; sur.plus does not assume registration or take-back duties
        on your behalf.
      </p>

      <h2>7. Payment, term and price changes</h2>
      <p>
        Plans run monthly or annually as chosen at sign-up and renew for the same period
        unless cancelled before the end of the current one. Annual plans are invoiced in
        advance. Prices are net, plus VAT where applicable.
      </p>
      <p>
        <strong>Minimum term on monthly plans.</strong> Monthly plans have a minimum term of
        three months from the start of the contract. After that you may cancel to the end of
        any calendar month. Annual plans run for twelve months. The right of either party to
        terminate for good cause remains unaffected.
      </p>
      <p>
        <strong>Additional services.</strong> Further matches under section 3 and pickups
        coordinated by us are billed with the next regular invoice. Transport costs we have
        advanced on your behalf are shown separately and without a mark-up.
      </p>
      <p>
        We announce price changes in text form at least 60 days before they take effect. You
        may cancel to the effective date if you do not accept the change. The period is one
        we set ourselves, not a statutory requirement; it is meant to leave you enough time
        to decide.
      </p>
      <p>
        <strong>Unused matches.</strong> In Seed you carry up to six unused matches into the
        following year on renewal. Anything beyond that expires. In Tree the question does
        not arise, as the number of matches is not capped.
      </p>

      <h2>8. Availability</h2>
      <p>
        We do not offer an uptime guarantee during the build-up phase, and we say so rather
        than promise one we cannot yet keep. We aim for continuous availability and will
        announce planned maintenance.
      </p>

      <h2>9. Liability</h2>
      <p>
        sur.plus is liable without limit for intent and gross negligence, and for injury to
        life, body or health. For slight negligence we are liable only for breach of an
        obligation essential to the purpose of this contract, and then limited to
        foreseeable, contract-typical damage. We are not liable for the condition, fitness
        or lawful use of the goods themselves, nor for what the recipient does with them, as
        we are not a party to that transfer (sections 2 and 6). Nor are we liable for loss,
        damage or delay in transport by a transport company commissioned by you or in your
        name. We neither manufacture, import nor supply the goods. Liability under the
        Produkthaftungsgesetz is unaffected.
      </p>
      <p>
        The impact and CO<sub>2</sub> figures we generate are based on the information you
        and the recipient provide and on recognised methodologies (GHG Protocol, GIIN
        IRIS+). We prepare them with care but do not owe audit-grade accuracy for your
        reporting; that responsibility remains yours.
      </p>

      <h2>10. Your data and your content</h2>
      <p>
        You keep all rights to the data you enter. We process it to run the platform and to
        produce your documentation, see the <a href="/privacy">privacy policy</a>. We do not
        sell it and do not use your surplus data for anything outside the platform. Your
        workspace in the application is exportable before closure and deleted 30 days after,
        subject to statutory retention duties; documents we delivered to you as files during
        the build-up phase stay with you.
      </p>
      <p>
        <strong>Exporting match communication.</strong> Some companies may not conduct
        business communication solely on an external platform. You can therefore obtain the
        full message history for a match at any time as a file, exported from the application
        or, while communication runs by e-mail, compiled by us, with timestamps and
        participants, and move it into your own records or archiving system. On request we
        set up an automatic copy to an address you nominate. Tell us if your compliance
        rules require a particular format.
      </p>
      <p>
        We may reference your company by name only with your prior consent. Anonymised or
        aggregated impact figures may be used without it.
      </p>

      <h2>11. Termination</h2>
      <p>
        Either party may terminate to the end of the current billing period, on monthly plans
        no earlier than the end of the minimum term under section 7. We may suspend
        an account immediately for a material breach, in particular listing goods you do not
        own, or circumventing section 4. Matches already confirmed are completed.
      </p>

      <h2>12. Law, venue and authoritative language</h2>
      <p>
        German law applies, excluding the CISG. Where you are a merchant, the venue is
        Munich. We try good-faith negotiation first, write to{" "}
        <a href="mailto:service@surpluspurpose.com">service@surpluspurpose.com</a>.
      </p>
      <p>
        <strong>The German version of these terms is authoritative.</strong> This English
        version is a translation for information; in case of discrepancy the German text
        prevails.
      </p>

      <p className="note">
        Version 2026-10 · founding-phase draft, pending review by external counsel. Changed
        from 2026-09: section 1 (meaning of platform), new section 2a (build-up phase),
        section 2 (passing of risk, transport), section 3 (data erasure in
        clearance projects), section 5 (identity of goods, data and licences, new goods and
        returns, materials), section 6 (contract concluded outside the application, product
        safety), section 9 (transport).
        Questions: service@surpluspurpose.com
      </p>
    </LegalPage>
  );
}
