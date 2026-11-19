import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPage } from "../components/LegalPage";
import { LOCALE_COOKIE, resolveLocaleFrom } from "../lib/i18n";

export const metadata: Metadata = {
  title: "sur.plus · Widerrufsbelehrung / Right of withdrawal"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * New in 2026-08, together with the recipient terms.
 *
 * Two distinct withdrawal situations arise once private individuals can receive
 * surplus, and conflating them would be wrong:
 *
 *   A. The verification fee. A service contract between the consumer and
 *      sur.plus, concluded at a distance. We are the trader; we owe the
 *      instruction.
 *
 *   B. The clearance purchase. A sale of goods between the consumer and the
 *      RELEASING COMPANY. We are not the seller and cannot instruct on its
 *      behalf, so part B is a model the company uses, not an instruction we
 *      give. Presenting it as ours would be worse than useless: it would look
 *      like the consumer had been instructed when they had not.
 *
 * Both parts follow the statutory model instruction (Anlage 1 to Art. 246a § 1(2)
 * EGBGB) but are adapted, and adaptation is exactly where these go wrong. This
 * is a founding-phase draft for the Legal Clinic on 2026-08-19, not a checked
 * instruction. In particular the return-cost and value-compensation wording in
 * part B needs a lawyer's eye before a single consumer sees it.
 */
export default async function WithdrawalPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);

  return locale === "de" ? <WithdrawalDe /> : <WithdrawalEn />;
}

function WithdrawalDe() {
  return (
    <LegalPage locale="de" title="Widerrufsbelehrung" kicker="Entwurf Aufbauphase · Verbraucher">
      <p className="note">
        <strong>Entwurf, noch nicht anwaltlich geprüft.</strong> Diese Belehrung wurde im
        August 2026 entworfen, als die Clearance-Schiene für Privatpersonen geöffnet wurde.
        Sie folgt dem gesetzlichen Muster, ist aber angepasst. Vor dem ersten entgeltlichen
        Fall mit einem Verbraucher muss sie geprüft werden.
      </p>
      <p>
        Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt,
        die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen
        Tätigkeit zugerechnet werden können (§ 13 BGB). Es gibt zwei verschiedene Verträge,
        und sie haben unterschiedliche Vertragspartner.
      </p>

      <h2>A. Verifizierungsbeitrag: Vertrag mit sur.plus</h2>
      <p>
        Betrifft den einmaligen Beitrag für die Prüfung Ihrer Aufnahme (10 € für
        Privatpersonen). Vertragspartner ist die sur.plus UG (haftungsbeschränkt),
        Landsberger Straße 57, 82266 Inning am Ammersee-Stegen,
        service@surpluspurpose.com.
      </p>
      <p>
        <strong>Widerrufsrecht.</strong> Sie haben das Recht, binnen vierzehn Tagen ohne
        Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn
        Tage ab dem Tag des Vertragsschlusses.
      </p>
      <p>
        Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung
        (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss,
        diesen Vertrag zu widerrufen, informieren. Sie können dafür das unten abgedruckte
        Muster-Widerrufsformular verwenden, das aber nicht vorgeschrieben ist. Zur Wahrung
        der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des
        Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
      </p>
      <p>
        <strong>Folgen des Widerrufs.</strong> Wenn Sie diesen Vertrag widerrufen, haben wir
        Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens
        binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren
        Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden
        wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt
        haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem
        Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
      </p>
      <p>
        Haben Sie verlangt, dass die Prüfung während der Widerrufsfrist beginnen soll, so
        haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem
        Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts unterrichten, bereits
        erbrachten Leistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen
        Leistungen entspricht.
      </p>

      <h2>B. Übernahme von Ware: Vertrag mit dem abgebenden Unternehmen</h2>
      <p className="note">
        <strong>Wichtig:</strong> Über diesen Vertrag belehrt Sie nicht sur.plus, sondern das
        abgebende Unternehmen. Es ist Ihr Verkäufer, wir vermitteln nur. Sie erhalten die
        Belehrung von diesem Unternehmen vor Vertragsschluss. Der folgende Text ist das
        Muster, das wir abgebenden Unternehmen dafür bereitstellen, damit Sie vorab wissen,
        was Sie erwartet.
      </p>
      <p>
        <strong>Widerrufsrecht.</strong> Sie haben das Recht, binnen vierzehn Tagen ohne
        Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn
        Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der
        Beförderer ist, die Waren in Besitz genommen haben bzw. hat. Bei mehreren Waren aus
        einer einheitlichen Bestellung, die getrennt geliefert werden, läuft die Frist ab
        dem Tag, an dem Sie die letzte Ware in Besitz genommen haben.
      </p>
      <p>
        Um Ihr Widerrufsrecht auszuüben, müssen Sie dem abgebenden Unternehmen mittels einer
        eindeutigen Erklärung über Ihren Entschluss informieren, diesen Vertrag zu
        widerrufen. Dessen vollständige Kontaktdaten erhalten Sie vor Vertragsschluss und
        finden Sie auf der Rechnung.
      </p>
      <p>
        <strong>Folgen des Widerrufs.</strong> Das Unternehmen hat Ihnen alle Zahlungen
        unverzüglich und spätestens binnen vierzehn Tagen ab Eingang der Widerrufsmitteilung
        zurückzuzahlen. Es kann die Rückzahlung verweigern, bis es die Waren zurückerhalten
        hat oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt
        haben, je nachdem, welches der frühere Zeitpunkt ist.
      </p>
      <p>
        Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen
        ab dem Tag zurückzusenden oder zu übergeben, an dem Sie das Unternehmen über den
        Widerruf unterrichten. Wer die unmittelbaren Kosten der Rücksendung trägt, wird
        Ihnen vor Vertragsschluss mitgeteilt; bei sperrigen Gütern wie Möbeln können diese
        Kosten erheblich sein. Sie müssen für einen etwaigen Wertverlust der Waren nur
        aufkommen, wenn dieser auf einen zur Prüfung der Beschaffenheit, Eigenschaften und
        Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.
      </p>

      <h2>Muster-Widerrufsformular</h2>
      <p>
        Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und
        senden Sie es zurück. Die Verwendung ist freiwillig.
      </p>
      <p>
        An: <em>[bei Verifizierungsbeitrag: sur.plus UG (haftungsbeschränkt),
        Landsberger Straße 57, 82266 Inning am Ammersee-Stegen,
        service@surpluspurpose.com. Bei Warenübernahme: das abgebende Unternehmen laut
        Rechnung]</em>
      </p>
      <p>
        Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über
        den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)
        <br />
        &mdash; Bestellt am (*) / erhalten am (*)
        <br />
        &mdash; Name des/der Verbraucher(s)
        <br />
        &mdash; Anschrift des/der Verbraucher(s)
        <br />
        &mdash; Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)
        <br />
        &mdash; Datum
        <br />
        (*) Unzutreffendes streichen.
      </p>

      <p className="note">
        Fassung 2026-08 · Entwurf der Aufbauphase, anwaltliche Prüfung ausstehend.
      </p>
    </LegalPage>
  );
}

function WithdrawalEn() {
  return (
    <LegalPage locale="en" title="Right of withdrawal" kicker="Founding-phase draft · Consumers">
      <p className="note">
        <strong>Translation.</strong> The German version is authoritative. This English text
        is for information only. <strong>Draft, not yet reviewed by counsel.</strong>
      </p>
      <p>
        A consumer is any natural person concluding a contract for purposes outside their
        trade or profession (§ 13 BGB). Two distinct contracts arise, with different
        counterparties.
      </p>

      <h2>A. Verification fee: contract with sur.plus</h2>
      <p>
        Concerns the one-off fee for reviewing your admission (€ 10 for private
        individuals). Counterparty: sur.plus UG (haftungsbeschränkt), Landsberger Straße
        57, 82266 Inning am Ammersee-Stegen, service@surpluspurpose.com.
      </p>
      <p>
        <strong>Right of withdrawal.</strong> You have the right to withdraw from this
        contract within fourteen days without giving any reason. The withdrawal period
        expires fourteen days from the day of conclusion of the contract.
      </p>
      <p>
        To exercise it, inform us by an unequivocal statement (for example a letter sent by
        post or an e-mail). You may use the model form below, but it is not obligatory. To
        meet the deadline it is sufficient to send your communication before the period
        expires.
      </p>
      <p>
        <strong>Effects of withdrawal.</strong> We will reimburse all payments received from
        you without undue delay and no later than fourteen days from the day on which we are
        informed of your decision. We will use the same means of payment as you used for the
        initial transaction unless expressly agreed otherwise; in no event will you be
        charged as a result of this reimbursement.
      </p>
      <p>
        If you requested that the review begin during the withdrawal period, you shall pay
        an amount proportionate to what has been provided until you communicated your
        withdrawal, in comparison with the full coverage of the contract.
      </p>

      <h2>B. Taking over goods: contract with the releasing company</h2>
      <p className="note">
        <strong>Important:</strong> for this contract you are instructed not by sur.plus but
        by the releasing company. It is your seller, we only intermediate. The text below
        is the model we supply to releasing companies, shown here so you know in advance
        what to expect.
      </p>
      <p>
        <strong>Right of withdrawal.</strong> You have the right to withdraw within fourteen
        days without giving any reason. The period expires fourteen days from the day on
        which you, or a third party other than the carrier indicated by you, acquires
        physical possession of the goods. Where several goods from one order are delivered
        separately, the period runs from possession of the last item.
      </p>
      <p>
        To exercise it, inform the releasing company by an unequivocal statement. Its full
        contact details are provided before the contract is concluded and appear on the
        invoice.
      </p>
      <p>
        <strong>Effects of withdrawal.</strong> The company shall reimburse all payments
        without undue delay and no later than fourteen days from the day it is informed. It
        may withhold reimbursement until it has received the goods back or you have supplied
        evidence of having sent them back, whichever is earliest.
      </p>
      <p>
        You shall send back or hand over the goods without undue delay and in any event no
        later than fourteen days from the day you communicate your withdrawal. Who bears the
        direct cost of returning the goods is stated before the contract is concluded; for
        bulky goods such as furniture this cost can be substantial. You are only liable for
        any diminished value of the goods resulting from handling other than what is
        necessary to establish their nature, characteristics and functioning.
      </p>

      <h2>Model withdrawal form</h2>
      <p>
        To: <em>[for the verification fee: sur.plus UG (haftungsbeschränkt), Landsberger
        Straße 57, 82266 Inning am Ammersee-Stegen, service@surpluspurpose.com. For goods:
        the releasing company as stated on the invoice]</em>
      </p>
      <p>
        I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale
        of the following goods (*) / for the provision of the following service (*)
        <br />
        &mdash; Ordered on (*) / received on (*)
        <br />
        &mdash; Name of consumer(s)
        <br />
        &mdash; Address of consumer(s)
        <br />
        &mdash; Signature of consumer(s) (only if this form is notified on paper)
        <br />
        &mdash; Date
        <br />
        (*) Delete as appropriate.
      </p>

      <p className="note">
        Version 2026-08 · founding-phase draft, pending review by external counsel.
      </p>
    </LegalPage>
  );
}
