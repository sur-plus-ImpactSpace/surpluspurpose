# Abstimmung mit Florian

Stand: 19. Juli 2026 · **Beschlossen: 20. Juli 2026** (Florian & Andi) · Teilnehmer: Florian (Gründer), Andi.

> Diese Fassung ist bewusst ohne Fachbegriffe geschrieben. Es gibt eine zweite, technischere
> Fassung (`abstimmung-flo-2026-07-19.md`) mit allen Detail-Belegen, falls Florian tiefer einsteigen will.
> Beide enthalten dieselben 30 Entscheidungen.

---

## Ergebnis auf einen Blick (beschlossen am 20. Juli 2026)

Alle 30 Punkte sind entschieden. **28 wie vorgeschlagen**, **3 mit Abweichung/Konkretisierung**
(A5, E3, F4 — unten fett markiert). Die einzelnen Entscheidungen stehen zusätzlich unten bei jedem Punkt.

| # | Thema | Entscheidung |
|---|---|---|
| A1 | Alte Arbeitskopien löschen | Ja, löschen |
| A2 | Automatische Update-Vorschläge | Einzeln prüfen, bei grün übernehmen |
| A3 | Schutz Live-/Test-Version | Ja, gestuft (Live streng, Test lockerer) |
| A4 | Eigene Testumgebung | Ja |
| **A5** | **Feste Zuständigkeit/Vorlage** | **Nein — bewusst weglassen (nur zwei Personen)** |
| B1 | Feinheit der Anforderungen | Gemischt (wichtiges fein, allgemeines grob) |
| B2 | „Fertig"-Beschreibung | Einfache Häkchen-Liste |
| B3 | Wichtigkeit kennzeichnen | Muss / Sollte / Kann / Vorerst nicht |
| B4 | Verknüpfung Entscheidung↔Anforderung | Nur eine Richtung |
| B5 | Datei-Aufteilung | Vorerst alles in einer Datei |
| C1 | Auch Unternehmen prüfen | Ja |
| C2 | Anmeldung = Antrag stellen | Ja |
| C3 | Prüf-Strenge Unternehmen | Automatisch bei grün, sonst Mensch |
| C4 | Freemail / Nachweis-Pflicht | Unternehmen: Freemail ablehnen · NGO: erlauben + Dokument-Pflicht |
| C5 | Sicherheitsabfrage heikle Aktionen | Zum Start: erneute Bestätigung per E-Mail |
| D1 | Wie entsteht eine Vermittlung | System schlägt vor, Mensch gibt frei |
| D2 | Feste Stationen-Abfolge | So lassen (Kontakt erst nach beidseitiger Zusage) |
| D3 | Teil-Deckung eines Bedarfs | Ja, mit Kontingent-Abzug je Teil-Lieferung |
| D4 | Abbruch & Erstattung | Zwei Fälle trennen, faire Erstattung |
| D5 | Liegengebliebene Vermittlungen | Nach 14 Tagen verfallen (mit Erinnerung) |
| D6 | Umwelt-Nutzen (CO₂) | Feste, gepflegte Werte-Tabelle |
| E1 | Vermittlung als Nächstes bauen | Ja, direkt nach der Prüfung (Teil C) |
| E2 | Bezahlung | Zuerst von Hand, dann automatisch (Stripe) |
| **E3** | **Spendenwert (Steuer)** | **Beleg/Nachweis verlangen — Wert nie ungeprüft; Steuerberater dazuholen** |
| E4 | Zugang & Demo | Nur mit Einladung + eigener Demo-Einstieg + „Zugang anfragen"-Formular |
| F1 | Anmeldung scharfschalten | Erst in der Testumgebung, live erst nach Teil C |
| F2 | Demo-Version | Eigene, abgeschottete Spielwiese je Besucher |
| F3 | „Zugang anfragen"-Formular | Ja, wie in E4 |
| **F4** | **Schrift in dichten Ansichten** | **Vertagt — Florian entscheidet später** |
| F5 | Bereichs-Farben | Florian legt die Marken-Farben fest |

---

## Die drei Nutzer-Typen (wichtig — bei jedem Punkt mitdenken)

Die App wird für **drei verschiedene Arten von Nutzern** entwickelt. Fast jede Funktion sieht für
jeden dieser drei anders aus. Deshalb steht bei jeder Entscheidung unten eine Zeile „**Betrifft:**",
die zeigt, welche Nutzer-Typen sie berührt.

- **Verwalter** (im Fachjargon „Admin"): Das sind **wir** als Betreiber. Der Verwalter prüft Anträge,
  gibt Vermittlungen frei, schaltet Tarife frei und behält den Überblick. Ein normaler Nutzer wird nie automatisch zum Verwalter.
- **Unternehmen** (im Fachjargon „Corporate"): die **spendende, zahlende Seite**. Ein Unternehmen bietet
  seine Überschüsse an, schaut sich Bedarfe an und bestätigt Vermittlungen.
- **Hilfsorganisation** (im Fachjargon „NGO"): die **empfangende, besonders vertrauenskritische Seite**.
  Sie meldet Bedarfe, bestätigt den Wareneingang und löst damit die Spendenbescheinigung aus.

---

## Kleines Begriffs-Lexikon (einmal lesen, dann versteht sich der Rest)

- **Projekt-Speicher (GitHub):** die Online-Plattform, auf der unser gesamter Programm-Code liegt — samt Verlauf aller Änderungen. Man kann es sich wie eine Dropbox nur für Programm-Code vorstellen, mit lückenloser Historie.
- **Arbeitskopie (im Fachjargon „Branch"):** eine abgetrennte Kopie des Projekts, in der man in Ruhe etwas bauen oder ausprobieren kann, ohne die Haupt-Version zu gefährden. Wenn es fertig und geprüft ist, wird es zurück in die Haupt-Version übernommen.
- **Haupt-Version / Live-Version (im Fachjargon „main" / „Produktion"):** die echte Version der App, die die Nutzer sehen.
- **Testumgebung (im Fachjargon „Staging"):** eine zweite, komplett getrennte Version zum Ausprobieren. Fehler dort haben keine Folgen für echte Nutzer oder echte Daten.
- **Zwischenstand speichern (im Fachjargon „Commit"):** ein gespeicherter Bearbeitungsstand mit kurzer Notiz, was gemacht wurde.
- **Aufgaben-Zettel (im Fachjargon „Issue"):** eine Aufgabe auf der Projekt-Plattform, die man zuweisen und abhaken kann.
- **Datenbank (unser Anbieter heißt „Supabase"):** der Ort, an dem alle Daten liegen (Nutzerkonten, Spenden, Bedarfe usw.).
- **Website-Veröffentlichung (unser Anbieter heißt „Netlify"):** der Dienst, der unsere App ins Internet stellt.
- **Verifizierung:** die Prüfung, ob ein Unternehmen bzw. eine Hilfsorganisation echt ist.
- **Vermittlung (im Fachjargon „Match"):** die Zusammenführung von einem Unternehmens-Überschuss und einem Bedarf einer Hilfsorganisation.
- **Kontingent (im Fachjargon „Quota"):** wie viele Vermittlungen ein Unternehmen pro Jahr in seinem Tarif nutzen darf.
- **Spendenbescheinigung (amtlich „Zuwendungsbestätigung"):** der Beleg, mit dem eine Spende steuerlich geltend gemacht werden kann.

---

# Teil A — Aufräumen und Absichern im Projekt-Speicher
*Schnelle Punkte, meist nur ein „Ja". Sie hängen von nichts anderem ab.*
*Betrifft in diesem Teil vor allem die **Entwicklung und den Betrieb** — nicht direkt die drei App-Nutzer.*

## A1 — Alte, nicht mehr benötigte Arbeitskopien löschen
- **Worum geht es?** Im Projekt-Speicher liegen rund 38 alte Arbeitskopien herum, deren Inhalt längst in die Haupt-Version übernommen wurde. Sie sind überflüssig und machen es unübersichtlich.
- **Frage an euch:** Dürfen wir diese alten, bereits übernommenen Arbeitskopien löschen?
- **Mein Vorschlag:** Ja. Ich habe die genaue Liste vorbereitet und einen Sicherheits-Check eingebaut, damit nur wirklich Überflüssiges gelöscht wird.
- **Vorteil:** aufgeräumt, weniger Verwechslungsgefahr. **Risiko:** dass man versehentlich etwas löscht, das noch gebraucht wird — dagegen schützt der Sicherheits-Check. **Wie machen es andere:** Aufräumen nach Abschluss ist üblicher Standard.
- **Betrifft:** Entwicklung/Betrieb.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## A2 — Automatische Update-Vorschläge abarbeiten
- **Worum geht es?** Ein Helfer-Programm meldet automatisch, wenn kleine Bausteine unserer App (fertige Software-Teile von anderen) veraltet sind, und schlägt Aktualisierungen vor. Vier solcher Vorschläge sind offen.
- **Frage an euch:** Jeden Vorschlag einzeln prüfen und übernehmen, oder alle auf einmal schließen?
- **Mein Vorschlag:** Einzeln übernehmen, wenn die automatische Prüfung grün ist; sonst schließen.
- **Vorteil:** Sicherheits- und Fehlerkorrekturen kommen rein. **Risiko:** ein großes Update kann etwas kaputt machen — deshalb nicht blind übernehmen. **Wie machen es andere:** kleine Updates automatisch, große von Hand prüfen.
- **Betrifft:** Entwicklung/Betrieb.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## A3 — Schutz für die Haupt- und die Test-Version einrichten
- **Worum geht es?** Aktuell könnte man aus Versehen direkt etwas Fehlerhaftes in die Live-Version schieben. Wir können einen Schutz einschalten: Änderungen müssen erst geprüft werden, bevor sie hineindürfen.
- **Frage an euch:** Diesen Schutz einschalten?
- **Mein Vorschlag:** Ja — für die Live-Version streng (Prüfung + zweites Augenpaar), für die Testumgebung etwas lockerer.
- **Vorteil:** kein versehentliches Kaputtmachen der Live-Version. **Risiko:** minimal mehr Aufwand pro Änderung — bei zwei Personen gut verschmerzbar. **Wie machen es andere:** ist Industrie-Standard.
- **Betrifft:** Entwicklung/Betrieb.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## A4 — Eigene Testumgebung mit eigenen Testdaten einrichten
- **Worum geht es?** Wir möchten eine getrennte Testumgebung, die eine eigene Test-Datenbank nutzt — damit man neue Sachen ausprobieren kann, ohne echte Nutzerdaten zu berühren.
- **Frage an euch:** Diese getrennte Testumgebung einrichten?
- **Mein Vorschlag:** Ja. Sie trennt echte Daten sauber ab und man sieht jede Änderung vorab in einer Vorschau.
- **Vorteil:** echte Daten sind sicher, Fehler fallen vor dem Start auf. **Risiko:** eine zweite Datenbank bedeutet etwas Pflege und geringe Zusatzkosten. **Wie machen es andere:** eine Testumgebung vor dem Livegang ist üblich.
- **Betrifft:** Entwicklung/Betrieb (ermöglicht später, alle drei Nutzer-Typen gefahrlos zu testen).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## A5 — Feste Zuständigkeit und Vorlage für Änderungen festlegen
- **Worum geht es?** Bisher ist nicht festgelegt, wer Änderungen gegenprüfen muss und in welcher Form sie beschrieben werden. Wir können eine feste Zuständigkeit (z. B. Florian prüft) und eine kleine Beschreibungs-Vorlage einführen.
- **Frage an euch:** Wollen wir das einführen?
- **Mein Vorschlag:** Ja, aber bewusst schlank, damit es kein Bürokratie-Aufwand für zwei Personen wird.
- **Vorteil:** klare Verantwortung, einheitliche Beschreibungen. **Risiko:** bei zwei Personen leicht zu viel des Guten — deshalb minimal halten.
- **Betrifft:** Entwicklung/Betrieb.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

---

# Teil B — Wie wir künftig Anforderungen aufschreiben
*Reine Form-Fragen. Es geht darum, wie wir „was die App können soll" notieren.*
*Betrifft in diesem Teil die **Dokumentation** — nicht direkt die drei App-Nutzer.*

## B1 — Wie fein schreiben wir Anforderungen auf?
- **Worum geht es?** Schreiben wir viele kleine, genaue Anforderungen — oder wenige große pro Funktion?
- **Mein Vorschlag:** Bei wichtigen Bereichen (Anmeldung, Vermittlung) fein und prüfbar, bei allgemeinen Themen gröber.
- **Vorteil:** kleine Punkte sind einzeln testbar. **Risiko:** zu fein wird unübersichtlich. **Wie machen es andere:** üblich ist „eine Anforderung = eine überschaubare Aufgabe".
- **Betrifft:** Dokumentation.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## B2 — In welcher Form beschreiben wir, wann etwas „fertig" ist?
- **Worum geht es?** Als einfache Häkchen-Liste in normaler Sprache, oder in einem strengen Schema („Wenn … dann …")?
- **Mein Vorschlag:** Einfache Häkchen-Liste — leichter zu pflegen, reicht für uns zwei.
- **Vorteil:** schnell und verständlich. **Risiko:** das strenge Schema lohnt sich erst, wenn Tests automatisch laufen. **Wie machen es andere:** das strenge Schema nur mit passender Technik dahinter.
- **Betrifft:** Dokumentation.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## B3 — Wie kennzeichnen wir, was wichtig ist?
- **Worum geht es?** Nach den Stufen „Muss / Sollte / Kann / Vorerst nicht" — oder mit Zahlen von 1 bis 3?
- **Mein Vorschlag:** Die Wort-Stufen „Muss / Sollte / Kann / Vorerst nicht".
- **Vorteil:** trennt klar, was für den Start zwingend ist. **Risiko:** ohne Disziplin wird alles zu „Muss". **Wie machen es andere:** die Wort-Stufen sind der übliche Standard.
- **Betrifft:** Dokumentation.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## B4 — Wie verknüpfen wir Entscheidungen mit Anforderungen?
- **Worum geht es?** Es gibt Notizen, *warum* wir etwas so entschieden haben (Entscheidungs-Notizen), und Notizen, *was* gebaut wird (Anforderungen). Verweisen wir nur in eine Richtung oder in beide?
- **Mein Vorschlag:** Nur in eine Richtung verweisen — das ist einfacher zu pflegen.
- **Vorteil:** wartungsarm. **Risiko:** beidseitige Verweise laufen auseinander, wenn man einen vergisst.
- **Betrifft:** Dokumentation.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## B5 — Alles in einer Datei oder aufteilen?
- **Worum geht es?** Sammeln wir alle Anforderungen in einem Dokument oder pro Bereich in einer eigenen Datei?
- **Mein Vorschlag:** Vorerst alles in einer Datei; aufteilen erst, wenn es wirklich viel wird.
- **Vorteil:** leicht durchsuchbar. **Risiko:** ab sehr vielen Einträgen unübersichtlich. **Wie machen es andere:** viele starten mit einer Datei und teilen später auf.
- **Betrifft:** Dokumentation.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

---

# Teil C — Prüfung von Unternehmen und Hilfsorganisationen
*Das Vertrauens-Thema. Heute werden nur Hilfsorganisationen geprüft, Unternehmen gar nicht.*

> Nützlich zu wissen: Für Deutschland gibt es zwei kostenlose amtliche Prüf-Möglichkeiten.
> **Erstens** eine automatische Prüfung der Umsatzsteuer-Identifikationsnummer eines Unternehmens
> über einen offiziellen EU-Dienst (er heißt „VIES"). **Zweitens** ein amtliches Verzeichnis aller
> gemeinnützigen Organisationen, die überhaupt Spendenbescheinigungen ausstellen dürfen (geführt vom
> Bundeszentralamt für Steuern). Ein automatisch abfragbares Handelsregister gibt es in Deutschland dagegen nicht.

## C1 — Sollen auch Unternehmen geprüft werden (nicht nur Hilfsorganisationen)?
- **Worum geht es?** Bisher prüfen wir nur, ob eine Hilfsorganisation echt ist. Bei Unternehmen prüfen wir nichts — jeder könnte sich als Firma ausgeben. Das passt schlecht zu einer Plattform, die auf Vertrauen und Steuerbelege setzt.
- **Frage an euch:** Führen wir auch für Unternehmen eine Echtheitsprüfung ein?
- **Mein Vorschlag:** Ja. Das beseitigt das Ungleichgewicht und schützt uns vor gefälschten Konten.
- **Vorteil:** beidseitiges Vertrauen, weniger Betrugsrisiko, starkes Argument im Verkauf. **Risiko:** etwas Bau-Aufwand und eine kleine zusätzliche Hürde bei der Anmeldung. **Wie machen es andere:** vertrauens-sensible Geschäftsplattformen (z. B. die Firmenkonto-Anbieter Mercury, Brex, Ramp) prüfen jedes Unternehmen vor der Freischaltung.
- **Betrifft:** **Unternehmen** (neue Prüfung) + **Hilfsorganisation** (bestehende Prüfung) + **Verwalter** (führt die Prüfung durch).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## C2 — Anmeldung heißt „Antrag stellen", nicht sofort „alles dürfen"
- **Worum geht es?** Soll man sich nach der Anmeldung nur umschauen dürfen — und erst nach bestandener Prüfung wirklich handeln (etwas anbieten, Kontakt sehen, Belege erhalten)?
- **Mein Vorschlag:** Ja.
- **Vorteil:** „nur schauen" und „wirklich handeln" sind sauber getrennt; ungeprüfte Konten können keinen Schaden anrichten. **Risiko:** manche springen ab, bevor die Prüfung durch ist. **Wie machen es andere:** viele Anbieter geben sensible Funktionen erst nach bestandener Prüfung frei.
- **Betrifft:** **Unternehmen** + **Hilfsorganisation** (beide dürfen erst nach Prüfung handeln).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## C3 — Wie streng prüfen wir Unternehmen? (die eigentliche Kernfrage)
- **Worum geht es?** Wenn die automatische Prüfung der Umsatzsteuer-Nummer in Ordnung ist: sofort und vollautomatisch freischalten — oder trotzdem immer noch einmal ein Mensch draufschauen?
- **Mein Vorschlag:** Wenn alles grün ist (gültige Nummer, Firmen-E-Mail, keine kostenlose Privat-Adresse), automatisch freischalten; in allen Zweifelsfällen ein Mensch.
- **Vorteil:** der Normalfall läuft ohne Handarbeit, Freischaltung in Minuten. **Risiko:** die automatische Prüfung bestätigt nur, dass die Nummer gültig ist — nicht, dass die anmeldende Person wirklich zu dieser Firma gehört. **Wie machen es andere:** spezialisierte Prüf-Dienste (z. B. „Goodstack") prüfen automatisch und schalten nur bei Auffälligkeiten einen Menschen dazu.
- **Betrifft:** **Unternehmen** + **Verwalter** (bei Zweifelsfällen).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## C4 — Umgang mit kostenlosen Privat-E-Mail-Adressen und Pflichtangaben
- **Worum geht es?** Lehnen wir bei Unternehmen kostenlose Privat-Adressen (z. B. Gmail, GMX, web.de) grundsätzlich ab? Welche Angaben sind Pflicht?
- **Mein Vorschlag:** Bei Unternehmen kostenlose Privat-Adressen ablehnen. Bei Hilfsorganisationen erlauben (viele kleine Vereine nutzen so etwas), dafür dort ein Nachweis-Dokument zur Pflicht machen.
- **Vorteil:** filtert bei Firmen billig gefälschte Konten heraus. **Risiko:** bei Hilfsorganisationen würde ein pauschales Verbot echte, kleine Vereine aussperren. **Wie machen es andere:** bei Firmen die E-Mail-Adresse mit dem Firmen-Eintrag abgleichen; bei Vereinen stattdessen auf amtliches Register und Dokument setzen.
- **Betrifft:** **Unternehmen** (Adressen-Regel) + **Hilfsorganisation** (Dokument-Pflicht).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## C5 — Zusätzliche Sicherheitsabfrage bei heiklen Aktionen
- **Worum geht es?** Bei besonders wichtigen Schritten (z. B. den Wareneingang bestätigen — das löst später eine Spendenbescheinigung aus) könnten wir eine zusätzliche Bestätigung verlangen. Möglich sind: eine erneute Bestätigung per E-Mail, ein Einmal-Code, oder eine App mit wechselndem Code.
- **Mein Vorschlag:** Zum Start die einfachste Variante (erneute Bestätigung per E-Mail); die App-Variante später als Option.
- **Vorteil:** schützt die steuerlich wichtige Aktion vor Missbrauch. **Risiko:** zu strenge Sicherheit bremst die Nutzung und erzeugt Support-Aufwand. **Wie machen es andere:** gestuft — einfache Bestätigung für die meisten, strengere nur für kritische Rollen (wie beim Online-Banking).
- **Betrifft:** vor allem **Hilfsorganisation** (bestätigt den Wareneingang) + **Unternehmen**; **Verwalter** hat den Überblick.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

---

# Teil D — Wie eine Vermittlung genau abläuft
*Die Vermittlung ist das Herzstück. Hier legen wir die Spielregeln fest.*

> Wichtigste Erkenntnis aus der Recherche: Fast alle bekannten Sachspenden-Plattformen führen
> Angebot und Bedarf **nicht per Automatik** zusammen, sondern über einen betreuten Katalog, bei dem
> ein Team mitschaut. Echte vollautomatische Vermittlung ist die Ausnahme. Das spricht für einen
> betreuten, nicht vollautomatischen Start.

## D1 — Wie entsteht eine Vermittlung?
- **Worum geht es?** (a) vollautomatisch, (b) das System schlägt vor und ein Mensch gibt frei, oder (c) rein von Hand?
- **Mein Vorschlag:** (b) — Vorschlag durch das System, Freigabe durch einen Menschen.
- **Vorteil:** sichert am Anfang Qualität und Vertrauen; lässt sich später stärker automatisieren. **Risiko:** die Handarbeit ist aufwändig und wird selbst zum Engpass, wenn viel läuft. **Wie machen es andere:** bekannte Sachspenden-Plattformen (Good360, In Kind Direct, Innatura) arbeiten mit betreutem Katalog; sehr junge Marktplätze (Airbnb, Lieferdienste) haben anfangs alles von Hand vermittelt. Wichtig: zuerst genug Angebot (Firmen-Überschüsse) aufbauen, sonst läuft die Vermittlung leer.
- **Betrifft:** **Verwalter** (gibt die Vermittlung frei) + **Unternehmen** + **Hilfsorganisation** (beide sind Teil der Vermittlung).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## D2 — Die feste Stationen-Abfolge einer Vermittlung
- **Worum geht es?** Eine Vermittlung durchläuft feste Stationen: vorgeschlagen → von der Hilfsorganisation bestätigt → vom Unternehmen bestätigt → unterwegs → geliefert → abgeschlossen. Die echten Kontaktdaten werden erst sichtbar, nachdem **beide** Seiten bestätigt haben.
- **Mein Vorschlag:** So lassen.
- **Vorteil:** klar nachvollziehbarer Ablauf; Kontaktdaten erst nach beidseitiger Zusage schützt die Privatsphäre. **Risiko:** viele Stationen bedeuten etwas mehr Aufwand; „geliefert" und „abgeschlossen" müssen klar definiert sein. **Wie machen es andere:** entspricht dem normalen Bestell-Ablauf im Online-Handel.
- **Betrifft:** **Unternehmen** + **Hilfsorganisation** (beide bestätigen nacheinander).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## D3 — Darf ein Bedarf in Teilen gedeckt werden?
- **Worum geht es?** Wenn eine Hilfsorganisation z. B. 100 Stück braucht: Dürfen mehrere Unternehmen je einen Teil liefern? Und zählt jede Teil-Lieferung als eine eigene Vermittlung aus dem Jahres-Kontingent?
- **Mein Vorschlag:** Teil-Lieferungen erlauben und die Restmenge mitzählen; jede bestätigte Vermittlung verbraucht eine Einheit aus dem Kontingent.
- **Vorteil:** deckt echte Bedarfe (große Menge, viele kleine Spender) und erhöht die Erfüllungsquote. **Risiko:** die Restmengen-Zählung ist fehleranfällig; das Kontingent pro Teil-Lieferung könnte Unternehmen abschrecken. **Wie machen es andere:** Katalog-Modelle rechnen die verfügbare Menge herunter wie ein Warenkorb.
- **Betrifft:** **Unternehmen** (mehrere je Bedarf, Kontingent) + **Hilfsorganisation** (ein Bedarf, viele Teil-Lieferungen).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## D4 — Was passiert bei Abbruch, und wird das Kontingent erstattet?
- **Worum geht es?** Unterscheiden wir zwei Fälle — „Rücknahme vor dem Versand" und „Scheitern nach dem Versand"? Und bekommt das Unternehmen sein Kontingent zurück?
- **Mein Vorschlag:** Zwei Fälle unterscheiden. Erstattung nur, wenn es ohne Verschulden der Hilfsorganisation scheitert; eine reine Rücknahme wird nicht erstattet.
- **Vorteil:** faire, nachvollziehbare Regeln und saubere Erfolgs-Statistik. **Risiko:** „wer ist schuld?" kann strittig sein und braucht dann eine Klärung durch uns. **Wie machen es andere:** übliche Trennung von „Storno" und „Reklamation" wie im Online-Handel.
- **Betrifft:** **Unternehmen** (Kontingent-Erstattung) + **Hilfsorganisation** (Verschulden) + **Verwalter** (Klärung bei Streit).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## D5 — Was passiert mit liegengebliebenen Vermittlungen?
- **Worum geht es?** Wenn eine vorgeschlagene Vermittlung zu lange unbeantwortet bleibt, läuft sie automatisch ab.
- **Mein Vorschlag:** Nach 14 Tagen ohne Reaktion automatisch verfallen lassen; das Kontingent wird dann nicht verbraucht.
- **Vorteil:** hält die Liste sauber und blockiert kein Kontingent. **Risiko:** zu kurze Frist frustriert ehrenamtlich arbeitende Organisationen — deshalb vorher eine Erinnerung schicken. **Wie machen es andere:** Ablauf-Fristen mit Vorwarnung sind üblich (z. B. bei reservierten Tickets).
- **Betrifft:** **Unternehmen** + **Hilfsorganisation** (Frist gilt für beide; Erinnerung vor Ablauf).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## D6 — Woher kommt der Umwelt-Nutzen (z. B. eingespartes CO₂)?
- **Worum geht es?** Zeigen wir den Umwelt-Nutzen anhand einer gepflegten Tabelle mit festen Werten pro Warenkategorie — oder darf ihn jeder selbst eintragen?
- **Mein Vorschlag:** Feste, gepflegte Werte pro Kategorie (keine freie Eingabe). Der Spendenwert ist ein getrenntes Thema (siehe E3).
- **Vorteil:** einheitliche, glaubwürdige Zahlen, die man nicht schönrechnen kann. **Risiko:** die Werte müssen fachlich fundiert und aktuell sein, sonst droht der Vorwurf der Schönfärberei. **Wie machen es andere:** Nachhaltigkeits-Werkzeuge rechnen mit hinterlegten Standard-Werten statt freier Eingabe.
- **Betrifft:** **Unternehmen** (sieht den Umwelt-Nutzen für Berichte) + **Verwalter** (pflegt die Werte-Tabelle).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

---

# Teil E — Große Produkt- und Rechtsfragen
*Diese vier Themen sind heute noch nicht umgesetzt. Sie bestimmen, was die Plattform kann und wo sie rechtlich haftet.*

## E1 — Bauen wir als Nächstes die eigentliche Vermittlung?
- **Worum geht es?** Das Kernstück — aus einem Bedarf und einem Überschuss wird eine verbindliche Vermittlung — gibt es heute noch **nicht** als echten Ablauf. Es liegen nur Beispiel-Daten vor; niemand kann bisher wirklich eine Vermittlung auslösen.
- **Frage an euch:** Bauen wir diesen Ablauf als nächstes großes Vorhaben (nach der Prüfung aus Teil C)?
- **Mein Vorschlag:** Ja, direkt nach Anmeldung und Prüfung — ohne diesen Ablauf gibt es kein Produkt.
- **Vorteil:** macht die Plattform überhaupt erst nutzbar; alles andere hängt daran. **Risiko:** großes Vorhaben; und ohne genügend Firmen-Angebote läuft es leer. **Wie machen es andere:** siehe D1 — betreuter Start, zuerst Angebot aufbauen.
- **Betrifft:** **Unternehmen** + **Hilfsorganisation** (nutzen die Vermittlung) + **Verwalter** (betreut sie).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## E2 — Wie und wann wird bezahlt?
- **Worum geht es?** Heute werden die Tarife der Firmen von Hand freigeschaltet — es gibt noch keine echte Bezahlung. Brauchen wir zum Start eine automatische Bezahlung (z. B. über den Bezahldienst Stripe), oder starten wir mit Freischaltung von Hand und ergänzen die Bezahlung kurz danach?
- **Mein Vorschlag:** Zum Start Freischaltung von Hand; automatische Bezahlung direkt danach.
- **Vorteil:** schneller startklar, individuelle Absprachen möglich, kein Technik-Aufwand jetzt. **Risiko:** Handarbeit skaliert nicht und wirkt bei Selbstbedienungs-Kunden unprofessionell. **Wie machen es andere:** bei individuellen Preisen zunächst von Hand abrechnen, später auf automatische Bezahlung umstellen, sobald die Preise einheitlich sind und das Volumen steigt.
- **Betrifft:** **Unternehmen** (zahlt) + **Verwalter** (schaltet den Tarif frei). Für Hilfsorganisationen kostenlos.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## E3 — Bewertung des Spendenwerts (Steuer- und Haftungsfrage)
- **Worum geht es?** Der ausgewiesene Spendenwert ergibt sich aus Menge mal einem **selbst angegebenen** Einzelwert. Dieser Wert steht auf der Spendenbescheinigung und ist damit steuerlich relevant. Ein zu hoch angesetzter Wert ist ein echtes Risiko — für beide Seiten und für uns als Plattform.
- **Frage an euch:** Bleibt der Wert selbst angegeben (mit einer Haftungs-Bestätigung), oder verlangen wir einen Nachweis, eine Obergrenze oder die Prüfung des Modells durch einen Steuerberater?
- **Mein Vorschlag:** Das entscheidet ihr als Gründer, und wir holen einen Steuerberater dazu. Wir dokumentieren die Entscheidung gesondert. **Bitte hier nichts raten.**
- **Vorteil:** ein sauber gelöstes Bewertungs- und Nachweis-Modell ist ein echter Vertrauens-Vorsprung. **Risiko (wichtig, geprüft):** Nach dem Einkommensteuergesetz haftet bei einem überhöht bescheinigten Wert **vorrangig die ausstellende Hilfsorganisation** — mit spürbaren Beträgen (30 Prozent des Zuwendungsbetrags, bei betrieblichen Spenden zusätzlich 15 Prozent). Ein bloß behaupteter Wert ist rechtlich angreifbar. **Wie machen es andere:** Für selbst angegebene Werte auf Plattformen ließ sich keine belastbare Standard-Praxis finden. Empfehlung deshalb: Werte **nie ungeprüft** auf die Bescheinigung übernehmen, sondern einen Beleg (z. B. Kaufbeleg) verlangen. *(Das ist keine Rechtsberatung — für den Einzelfall bitte den Steuerberater fragen.)*
- **Betrifft:** vor allem **Hilfsorganisation** (stellt die Bescheinigung aus und haftet) + **Unternehmen** (gibt den Wert an) + **Verwalter** (Regeln und Belege).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## E4 — Wer darf rein, und wie testen Interessenten die App?
- **Worum geht es?** Heute kommt man nur mit Einladung hinein, und die Vorführ-Version steckt in der Anmelde-Maske. Frage: Bleiben wir vorerst bei „nur mit Einladung"? Bekommt die Vorführ-Version einen eigenen, klar getrennten Einstieg? Und bieten wir Interessenten ein Formular „Zugang anfragen" an?
- **Mein Vorschlag:** Vorerst nur mit Einladung (bis die Prüfung aus Teil C steht); Vorführ-Version als eigener Einstieg; „Zugang anfragen"-Formular anbieten.
- **Vorteil:** „nur mit Einladung" sorgt für Qualität und passt zur Prüf-Pflicht; das Formular sammelt schon vor dem Start Interessenten. **Risiko:** zu geschlossen bremst das Wachstum; gesammelte Interessenten muss man auch aktiv nachfassen. **Wie machen es andere:** bekannte Anbieter (z. B. Superhuman, Robinhood) starteten mit Warteliste und Einladungen; Firmenkonto-Anbieter schalten erst nach bestandener Prüfung frei.
- **Betrifft:** **Unternehmen** + **Hilfsorganisation** (Zugang/Anmeldung) + **Verwalter** (lädt ein, verwaltet Anfragen).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

---

# Teil F — Aussehen und Bedienung der App
*Weniger dringend. Wenn die Zeit knapp wird, zuerst hier kürzen.*

## F1 — Anmelde-Funktion echt scharfschalten?
- **Worum geht es?** Soll die Anmeldung mit echten Konten jetzt scharfgeschaltet werden — zunächst in der Testumgebung, oder auch schon in der Live-Version? Solange das nicht geschieht, kann man die eingeloggten Ansichten nicht richtig testen.
- **Mein Vorschlag:** In der Testumgebung scharfschalten (hängt mit A4 zusammen); in der Live-Version erst, wenn die Prüf-Regeln aus Teil C stehen.
- **Vorteil:** man kann die eingeloggten Abläufe endlich echt testen. **Risiko:** die Live-Version ohne fertige Prüfung öffnen würde gefälschte Konten hereinlassen — deshalb an Teil C koppeln. **Wie machen es andere:** erst in der Testumgebung, dann live, wenn die Zugangsregeln stehen.
- **Betrifft:** **alle drei** — Verwalter, Unternehmen und Hilfsorganisation melden sich alle an.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## F2 — Vorführ-Version: gemeinsamer Zugang oder eigener je Besucher?
- **Worum geht es?** Sehen alle Interessenten dasselbe gemeinsame Vorführ-Konto (mit dem Risiko, dass sie sich gegenseitig in die Quere kommen), oder bekommt jeder Besucher eine eigene, abgeschottete Spielwiese?
- **Mein Vorschlag:** Eigene, abgeschottete Spielwiese je Besucher — sofern der Aufwand vertretbar ist.
- **Vorteil:** jeder kann gefahrlos „echt" klicken, ohne fremde Eingaben zu sehen. **Risiko:** die abgeschottete Variante ist etwas aufwändiger zu bauen. **Wie machen es andere:** beides ist verbreitet; die abgeschottete Variante gilt als sauberer.
- **Betrifft:** **Interessenten** (künftige Unternehmen und Hilfsorganisationen), die die App vor der Anmeldung ausprobieren.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## F3 — „Zugang anfragen"-Formular (gleiche Frage wie E4)
- **Worum geht es?** Bleiben wir bei „nur mit Einladung" und bieten ein „Zugang anfragen"-Formular an? Das ist dieselbe Frage wie E4 — hier nur die konkrete Umsetzung im Aussehen.
- **Mein Vorschlag:** Wie in E4 entscheiden, hier nur entsprechend umsetzen.
- **Betrifft:** **Unternehmen** + **Hilfsorganisation** (dieselben Nutzer wie in E4).
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## F4 — Schriftart in dichten Ansichten
- **Worum geht es?** Verwenden wir die geschwungene Schrift (mit kleinen Häkchen an den Buchstaben) nur für Überschriften und die Marke — und in datenreichen Ansichten (z. B. Tabellen) eine schlichtere Schrift?
- **Mein Vorschlag:** Geschwungene Schrift nur für Überschriften/Marke, in dichten Ansichten die schlichte Schrift.
- **Vorteil:** klare Gliederung, wirkt professioneller. **Risiko:** reine Geschmacksfrage — nicht überbewerten. **Wie machen es andere:** verbreitetes Muster: auffällige Schrift für Überschriften, schlichte für Inhalte.
- **Betrifft:** **alle drei** — betrifft die gesamte Oberfläche.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

## F5 — Farben für Unternehmen und Hilfsorganisationen
- **Worum geht es?** Legen wir feste Akzentfarben fest — z. B. eine kühle Farbe (Türkis/Grün) für den Unternehmens-Bereich und eine andere für den Bereich der Hilfsorganisationen?
- **Mein Vorschlag:** Florian legt die Marken-Farben fest; ich setze sie dann um.
- **Vorteil:** man erkennt sofort, in welchem Bereich man sich befindet. **Risiko:** auf gute Lesbarkeit achten (Kontrast, Farbfehlsichtigkeit) — Farbe nie als einziges Unterscheidungsmerkmal. **Wie machen es andere:** bereichsabhängige Farben sind üblich, mit Blick auf Barrierefreiheit.
- **Betrifft:** **Unternehmen** und **Hilfsorganisation** (je eigene Farbe); der **Verwalter** hat eine eigene Verwaltungs-Ansicht.
- **Entscheidung (20.07.2026):** siehe Ergebnis-Tabelle oben.

---

## Nur zur Information — hier ist nichts zu entscheiden

Damit Florian den Stand kennt:

- **Schon erledigt:** die verpflichtende Zustimmung zu den Nutzungsbedingungen ist eingebaut; ein Fehler beim Laden der Schriftarten wurde behoben; die Verschlüsselung der Landing-Page ist abgesichert.
- **Bewusst später:** ein schlaues Einlesen von Listen per künstlicher Intelligenz (ein einfaches, verlässliches Einlesen reicht zum Start); weitere Verwaltungs-Funktionen.
- **Noch zu erledigende Programmier-Arbeit (keine Gründer-Entscheidung):** Deutsch/Englisch überall in der Oberfläche; bessere Bedienung auf dem Handy; der Bereich für Dokumente und Unterschriften.

---

## Reihenfolge im Gespräch (Vorschlag)

1. **Teil A und B** zuerst — schnell abzuhaken, wärmt auf (ca. 15 Minuten).
2. **Teil C** und der Zusammenhang **E4 / F1 / F3** — das ist das Fundament, alles Weitere hängt daran (ca. 30 Minuten).
3. **Teil D** und **E1, E2** — der eigentliche Ablauf und dessen Reihenfolge (ca. 30 Minuten).
4. **E3 (Steuer)** — nur die Richtung festlegen, Steuerberater dazuholen (ca. 5 Minuten).
5. **F2, F4, F5** — Aussehen; falls die Zeit knapp wird, zuerst weglassen.
