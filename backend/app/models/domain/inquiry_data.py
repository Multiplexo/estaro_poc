from pydantic import BaseModel


class Ort(BaseModel):
    land: str | None = None
    postleitzahl: str | None = None
    stadt: str | None = None


class Kundeninformationen(BaseModel):
    empfaengertyp: str | None = None
    kunde: str | None = None
    anrede: str | None = None
    name: str | None = None
    namenszusatz: str | None = None
    ansprechpartner: str | None = None
    zusatz: str | None = None
    strassePostfach: str | None = None
    ort: Ort | None = None


class Beleginformationen(BaseModel):
    belegdatum: str | None = None
    lieferdatum: str | None = None
    valuta: str | None = None
    zahlungskondition: str | None = None
    vorgang: str | None = None
    projektnummer: str | None = None
    lagerinfoBeleg: str | None = None
    druckprozessVariante: str | None = None


class Lieferadresse(BaseModel):
    lieferanschrift: str | None = None
    anrede: str | None = None
    name: str | None = None
    namenszusatz: str | None = None
    ansprechpartner: str | None = None
    zusatz: str | None = None
    entladevorschriften: str | None = None
    avisierungTel: str | None = None
    buchungsportalZustellung: str | None = None
    strassePostfach: str | None = None
    ort: Ort | None = None


class Rechnungsadresse(BaseModel):
    rechnungsanschrift: str | None = None
    anrede: str | None = None
    name: str | None = None
    ansprechpartner: str | None = None
    strassePostfach: str | None = None
    ort: Ort | None = None


class Belegdetails(BaseModel):
    belegmatchcode: str | None = None
    ihrZeichen: str | None = None
    ihreBelegnummer: str | None = None
    belegZu: str | None = None
    versandart: str | None = None
    lieferbedingung: str | None = None
    zahlungsaufteilung: str | None = None
    sprache: str | None = None
    kostenstelle: str | None = None
    kostentraeger: str | None = None
    buchungskreis: str | None = None
    abweichenderErloescode: str | None = None
    memo: str | None = None
    label: str | None = None


class PreisUndSteuerbasis(BaseModel):
    besteuerungsart: str | None = None
    abweichendeBesteuerung: str | None = None
    preiskennzeichen: str | None = None
    euUstidNr: str | None = None
    euLaenderkuerzel: str | None = None
    waehrung: str | None = None
    kurs: str | None = None


class Angebotsdetails(BaseModel):
    angebotGueltigBis: str | None = None
    status: str | None = None
    rueckmeldungZumAngebot: str | None = None
    kundenquelle: str | None = None


class InquiryPosition(BaseModel):
    nr: str | None = None
    typ: str | None = None
    artikel: str | None = None
    bezeichnung: str | None = None
    dimensionstext: str | None = None
    bezeichnung2: str | None = None
    langtext: str | None = None
    zubehoertext: str | None = None
    zusatzinfos: str | None = None
    lagerinfoPOS: str | None = None
    manuelleME: str | None = None
    menge: str | None = None
    mengeneinheit: str | None = None
    mengeInBasiseinheit: str | None = None
    gesamtgewicht: str | None = None
    lagerbestand: str | None = None
    memo: str | None = None
    verfuegbar: str | None = None
    zeugnis: str | None = None
    einzelpreis: str | None = None
    gesamtpreis: str | None = None
    kalkulatorischerEK: str | None = None
    roherloes: str | None = None
    rabatt: str | None = None


class InquiryData(BaseModel):
    kundeninformationen: Kundeninformationen | None = None
    beleginformationen: Beleginformationen | None = None
    lieferadresse: Lieferadresse | None = None
    rechnungsadresse: Rechnungsadresse | None = None
    kopftext: str | None = None
    belegdetails: Belegdetails | None = None
    preisUndSteuerbasis: PreisUndSteuerbasis | None = None
    angebotsdetails: Angebotsdetails | None = None
    positionen: list[InquiryPosition] | None = None
