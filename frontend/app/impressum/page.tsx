import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum – Parlascanned",
  description: "Impressum und rechtliche Angaben zu Parlascanned",
};

function FactBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "var(--t-label)",
          color: "var(--color-muted)",
          letterSpacing: "0.09em",
          textTransform: "uppercase" as const,
          fontWeight: 600,
          marginBottom: "var(--sp-sm)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--t-base)",
          color: "var(--color-navy)",
          lineHeight: 1.75,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        style={{
          fontSize: "var(--t-title)",
          color: "var(--color-navy)",
          fontWeight: 600,
          marginBottom: "var(--sp-sm)",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: "var(--t-body)",
          color: "var(--color-description)",
          lineHeight: 1.8,
          maxWidth: "65ch",
        }}
      >
        {children}
      </div>
    </section>
  );
}

const linkClass =
  "transition-colors duration-150 hover:text-[var(--color-navy)] underline underline-offset-[3px]";

export default function ImpressumPage() {
  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        paddingTop: "var(--sp-xl)",
        paddingBottom: "var(--sp-2xl)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--sp-2xl)" }}>
        <p
          style={{
            fontSize: "var(--t-label)",
            color: "var(--color-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: "var(--sp-sm)",
          }}
        >
          Rechtliches
        </p>
        <h1
          style={{
            fontSize: "var(--t-page)",
            color: "var(--color-navy)",
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: "var(--sp-xs)",
          }}
        >
          Impressum
        </h1>
        <p
          style={{
            fontSize: "var(--t-body)",
            color: "var(--color-description)",
          }}
        >
          Angaben gemäß § 5 TMG
        </p>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 1,
          background: "var(--color-lavender)",
          marginBottom: "var(--sp-xl)",
        }}
      />

      {/* ── Key facts grid ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--sp-xl) var(--sp-2xl)",
          marginBottom: "var(--sp-2xl)",
        }}
      >
        <FactBlock label="Verantwortlicher">
          <p>Robert Kübler</p>
          <p>Horstdyk 53</p>
          <p>47803 Krefeld</p>
          <p>Deutschland</p>
        </FactBlock>

        <FactBlock label="Kontakt">
          <a
            href="mailto:robert.jo.kuebler@gmail.com"
            className={linkClass}
            style={{ color: "var(--color-purple)" }}
          >
            robert.jo.kuebler@gmail.com
          </a>
        </FactBlock>

        <FactBlock label="Umsatzsteuer">
          <p>Kleinunternehmer gem. § 19 UStG</p>
          <p
            style={{
              fontSize: "var(--t-body)",
              color: "var(--color-description)",
              marginTop: "var(--sp-xs)",
            }}
          >
            Keine USt-IdNr. erforderlich
          </p>
        </FactBlock>

        <FactBlock label="Streitschlichtung">
          <p
            style={{
              fontSize: "var(--t-body)",
              color: "var(--color-description)",
              marginBottom: "var(--sp-xs)",
            }}
          >
            Keine Teilnahme an Verbraucherstreitschlichtung.
          </p>
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            style={{
              fontSize: "var(--t-small)",
              color: "var(--color-purple)",
            }}
          >
            EU-Streitschlichtungsplattform →
          </a>
        </FactBlock>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 1,
          background: "var(--color-lavender)",
          marginBottom: "var(--sp-xl)",
        }}
      />

      {/* ── Legal boilerplate ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-lg)",
        }}
      >
        <LegalSection title="Haftung für Inhalte">
          <p>
            Als Diensteanbieter bin ich gemäß § 7 Abs. 1 TMG für eigene Inhalte
            auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
            §§ 8 bis 10 TMG bin ich als Diensteanbieter jedoch nicht
            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
            überwachen oder nach Umständen zu forschen, die auf eine
            rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung
            oder Sperrung der Nutzung von Informationen nach den allgemeinen
            Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist
            jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
            Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
            Rechtsverletzungen werde ich diese Inhalte umgehend entfernen.
          </p>
        </LegalSection>

        <LegalSection title="Haftung für Links">
          <p>
            Mein Angebot enthält Links zu externen Websites Dritter, auf deren
            Inhalte ich keinen Einfluss habe. Deshalb kann ich für diese fremden
            Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
            Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
            verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
            Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige
            Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine
            permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch
            ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.
            Bei Bekanntwerden von Rechtsverletzungen werde ich derartige Links
            umgehend entfernen.
          </p>
        </LegalSection>

        <LegalSection title="Urheberrecht">
          <p>
            Die durch den Seitenbetreiber erstellten Inhalte und Werke auf
            diesen Seiten unterliegen dem deutschen Urheberrecht. Die
            Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
            schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht
            kommerziellen Gebrauch gestattet. Die verwendeten Daten stammen von{" "}
            <a
              href="https://www.abgeordnetenwatch.de"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
              style={{ color: "var(--color-purple)" }}
            >
              abgeordnetenwatch.de
            </a>{" "}
            und dem{" "}
            <a
              href="https://dip.bundestag.de"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
              style={{ color: "var(--color-purple)" }}
            >
              Dokumentations- und Informationssystem des Deutschen Bundestages
              (DIP)
            </a>{" "}
            und stehen unter den jeweiligen Nutzungsbedingungen dieser Anbieter.
          </p>
        </LegalSection>
      </div>
    </div>
  );
}
