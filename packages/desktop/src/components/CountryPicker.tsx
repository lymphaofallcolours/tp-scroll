import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

import { COUNTRIES, findCountry, flagFor, type Country } from "../data/countries.js";

import styles from "./CountryPicker.module.css";

type Props = {
  readonly value: string; // ISO-2
  readonly onChange: (code: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
};

// Public-domain TopoJSON world atlas (110m resolution). Vite serves it from a
// CDN at runtime so we don't bundle the ~30KB ourselves. The map view loads
// lazily — only when the user toggles it on.
const WORLD_GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const matches = (q: string, c: Country): boolean => {
  if (q.length === 0) return true;
  const lc = q.toLowerCase();
  return c.code.toLowerCase().startsWith(lc) || c.name.toLowerCase().includes(lc);
};

/**
 * Two-mode country picker. List mode is the default — type-ahead text input
 * with a scrollable result list rendered immediately below. Map mode flips to
 * a simple zoomable world map; clicking a country polygon selects it.
 *
 * Display flag is rendered from the ISO-2 code via regional-indicator
 * codepoints, so no external flag library is needed.
 */
export const CountryPicker = ({
  value,
  onChange,
  placeholder = "Type a country name or code…",
  ariaLabel,
}: Props): JSX.Element => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "map">("list");

  const selected = findCountry(value);
  const results = useMemo(
    () => COUNTRIES.filter((c) => matches(query, c)).slice(0, 60),
    [query],
  );

  const pick = (code: string): void => {
    onChange(code);
    setQuery("");
    setOpen(false);
  };

  // ISO-3 ↔ ISO-2 mapping is baked into world-atlas via the `id` field
  // (numeric ISO-3166 numeric codes). We compare against a lookup we
  // generate from COUNTRIES + the numeric->alpha2 table below.
  const numericToAlpha2 = useMemo(() => buildNumericTable(), []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.summary}>
        <span className={styles.flag} aria-hidden="true">
          {selected ? flagFor(selected.code) : "🏳"}
        </span>
        <span className={styles.code}>{selected?.code ?? value ?? "—"}</span>
        <span className={styles.name}>{selected?.name ?? "unset"}</span>
        <button
          type="button"
          className={styles.modeBtn}
          onClick={() => {
            setMode((m) => (m === "list" ? "map" : "list"));
            setOpen(true);
          }}
        >
          {mode === "list" ? "pick from map" : "pick from list"}
        </button>
      </div>

      {mode === "list" && (
        <>
          <input
            type="text"
            className={styles.input}
            placeholder={placeholder}
            aria-label={ariaLabel ?? "Country picker"}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <ul className={styles.results} role="listbox">
              {results.length === 0 ? (
                <li className={styles.empty}>No matches</li>
              ) : (
                results.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      className={`${styles.row} ${value === c.code ? styles.rowActive : ""}`}
                      onClick={() => pick(c.code)}
                    >
                      <span className={styles.flag} aria-hidden="true">
                        {flagFor(c.code)}
                      </span>
                      <span className={styles.rowName}>{c.name}</span>
                      <span className={styles.rowCode}>{c.code}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}

      {mode === "map" && (
        <div className={styles.mapWrap}>
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 150 }}
            style={{ width: "100%", height: 280 }}
          >
            <ZoomableGroup>
              <Geographies geography={WORLD_GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const code = numericToAlpha2.get(String(geo.id));
                    const isSelected = code === value;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => code && pick(code)}
                        style={{
                          default: {
                            fill: isSelected
                              ? "var(--accent-trip)"
                              : "var(--surface-sunk)",
                            stroke: "var(--surface-edge)",
                            strokeWidth: 0.4,
                            outline: "none",
                          },
                          hover: {
                            fill: "var(--accent-trip-soft)",
                            stroke: "var(--ink-tertiary)",
                            strokeWidth: 0.6,
                            outline: "none",
                            cursor: code ? "pointer" : "not-allowed",
                          },
                          pressed: {
                            fill: "var(--accent-trip)",
                            outline: "none",
                          },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
          <p className={styles.mapHint}>
            Click a country to select it · scroll to zoom · drag to pan
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * world-atlas tags polygons with the numeric ISO-3166 country code. To map
 * those back to the ISO-2 codes the rest of the app uses, we keep a small
 * numeric→alpha2 table covering every country that has a polygon. Generated
 * by hand from the IANA registry — the list is stable enough that pinning it
 * here is cheaper than pulling in another data dep.
 */
const buildNumericTable = (): Map<string, string> => {
  const entries: Array<[string, string]> = [
    ["004", "AF"], ["008", "AL"], ["010", "AQ"], ["012", "DZ"], ["016", "AS"],
    ["020", "AD"], ["024", "AO"], ["028", "AG"], ["031", "AZ"], ["032", "AR"],
    ["036", "AU"], ["040", "AT"], ["044", "BS"], ["048", "BH"], ["050", "BD"],
    ["051", "AM"], ["052", "BB"], ["056", "BE"], ["060", "BM"], ["064", "BT"],
    ["068", "BO"], ["070", "BA"], ["072", "BW"], ["076", "BR"], ["084", "BZ"],
    ["086", "IO"], ["090", "SB"], ["092", "VG"], ["096", "BN"], ["100", "BG"],
    ["104", "MM"], ["108", "BI"], ["112", "BY"], ["116", "KH"], ["120", "CM"],
    ["124", "CA"], ["132", "CV"], ["136", "KY"], ["140", "CF"], ["144", "LK"],
    ["148", "TD"], ["152", "CL"], ["156", "CN"], ["158", "TW"], ["170", "CO"],
    ["174", "KM"], ["175", "YT"], ["178", "CG"], ["180", "CD"], ["184", "CK"],
    ["188", "CR"], ["191", "HR"], ["192", "CU"], ["196", "CY"], ["203", "CZ"],
    ["204", "BJ"], ["208", "DK"], ["212", "DM"], ["214", "DO"], ["218", "EC"],
    ["222", "SV"], ["226", "GQ"], ["231", "ET"], ["232", "ER"], ["233", "EE"],
    ["234", "FO"], ["238", "FK"], ["239", "GS"], ["242", "FJ"], ["246", "FI"],
    ["250", "FR"], ["254", "GF"], ["258", "PF"], ["260", "TF"], ["262", "DJ"],
    ["266", "GA"], ["268", "GE"], ["270", "GM"], ["275", "PS"], ["276", "DE"],
    ["288", "GH"], ["292", "GI"], ["296", "KI"], ["300", "GR"], ["304", "GL"],
    ["308", "GD"], ["312", "GP"], ["316", "GU"], ["320", "GT"], ["324", "GN"],
    ["328", "GY"], ["332", "HT"], ["340", "HN"], ["344", "HK"], ["348", "HU"],
    ["352", "IS"], ["356", "IN"], ["360", "ID"], ["364", "IR"], ["368", "IQ"],
    ["372", "IE"], ["376", "IL"], ["380", "IT"], ["384", "CI"], ["388", "JM"],
    ["392", "JP"], ["398", "KZ"], ["400", "JO"], ["404", "KE"], ["408", "KP"],
    ["410", "KR"], ["414", "KW"], ["417", "KG"], ["418", "LA"], ["422", "LB"],
    ["426", "LS"], ["428", "LV"], ["430", "LR"], ["434", "LY"], ["438", "LI"],
    ["440", "LT"], ["442", "LU"], ["446", "MO"], ["450", "MG"], ["454", "MW"],
    ["458", "MY"], ["462", "MV"], ["466", "ML"], ["470", "MT"], ["474", "MQ"],
    ["478", "MR"], ["480", "MU"], ["484", "MX"], ["492", "MC"], ["496", "MN"],
    ["498", "MD"], ["499", "ME"], ["500", "MS"], ["504", "MA"], ["508", "MZ"],
    ["512", "OM"], ["516", "NA"], ["520", "NR"], ["524", "NP"], ["528", "NL"],
    ["531", "CW"], ["533", "AW"], ["534", "SX"], ["535", "BQ"], ["540", "NC"],
    ["548", "VU"], ["554", "NZ"], ["558", "NI"], ["562", "NE"], ["566", "NG"],
    ["570", "NU"], ["574", "NF"], ["578", "NO"], ["580", "MP"], ["583", "FM"],
    ["584", "MH"], ["585", "PW"], ["586", "PK"], ["591", "PA"], ["598", "PG"],
    ["600", "PY"], ["604", "PE"], ["608", "PH"], ["612", "PN"], ["616", "PL"],
    ["620", "PT"], ["624", "GW"], ["626", "TL"], ["630", "PR"], ["634", "QA"],
    ["638", "RE"], ["642", "RO"], ["643", "RU"], ["646", "RW"], ["652", "BL"],
    ["654", "SH"], ["659", "KN"], ["660", "AI"], ["662", "LC"], ["663", "MF"],
    ["666", "PM"], ["670", "VC"], ["674", "SM"], ["678", "ST"], ["682", "SA"],
    ["686", "SN"], ["688", "RS"], ["690", "SC"], ["694", "SL"], ["702", "SG"],
    ["703", "SK"], ["704", "VN"], ["705", "SI"], ["706", "SO"], ["710", "ZA"],
    ["716", "ZW"], ["724", "ES"], ["728", "SS"], ["729", "SD"], ["732", "EH"],
    ["740", "SR"], ["748", "SZ"], ["752", "SE"], ["756", "CH"], ["760", "SY"],
    ["762", "TJ"], ["764", "TH"], ["768", "TG"], ["772", "TK"], ["776", "TO"],
    ["780", "TT"], ["784", "AE"], ["788", "TN"], ["792", "TR"], ["795", "TM"],
    ["796", "TC"], ["798", "TV"], ["800", "UG"], ["804", "UA"], ["807", "MK"],
    ["818", "EG"], ["826", "GB"], ["834", "TZ"], ["840", "US"], ["850", "VI"],
    ["854", "BF"], ["858", "UY"], ["860", "UZ"], ["862", "VE"], ["876", "WF"],
    ["882", "WS"], ["887", "YE"], ["894", "ZM"],
  ];
  return new Map(entries);
};
