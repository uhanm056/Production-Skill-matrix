# SkillPlan — Yanfeng Planá nad Lužnicí

Webová aplikace pro digitalizaci matice dovedností (skill matrix) a týdenního rozpisu směn
napříč všemi výrobními projekty závodu Yanfeng Automotive Interiors, Planá nad Lužnicí.

## Účel

1. **Matice dovedností** — přehled kvalifikací operátorů podle projektů a pozic (nahrazuje papírové/Excel matice)
2. **Týdenní rozpis směn** — koordinátor výroby každý týden sestaví rozpis a pošle team leaderům; aplikace automaticky kontroluje kvalifikace
3. **Přehled rizik** — pozice s nedostatečným pokrytím (0 nebo 1 samostatný operátor)

## Aktuální stav

- Celá aplikace je v jednom souboru `skillplan.html` (~690 kB, obsahuje embedovanou knihovnu SheetJS/XLSX)
- **První úkol v Code:** rozdělit na strukturu `index.html` + `css/` + `js/` + `lib/xlsx.full.min.js`, funkčnost zachovat 1:1

## Datový model (localStorage, klíč `skillplan_yanfeng_v2`)

```js
{
  projects: [{ id, name, positions: [string] }],
  operators: [{ id, name, skills: { "projId::pozice": 0-4 } }],
  plans: { "YYYY-MM-DD(pondělí)": { projId: { pozice: { R:[opId], O:[opId], N:[opId] } } } },
  notes: { "YYYY-MM-DD": { projId: "text — dovolená, nemoc, poznámky" } }
}
```

## Business pravidla (NEMĚNIT bez konzultace)

### Úrovně kvalifikace (0–4, dle oficiální metodiky závodu)
- **0** = nezaškolený (N/A)
- **1** = pracuje pouze pod dohledem TL/operátora s kvalifikací 4
- **2** = samostatný, ale ne v požadované efektivitě → **od úrovně 2 se počítá jako "zaškolen"**
- **3** = plní kvalitativní požadavky v plné efektivitě
- **4** = odborník, může zaškolovat nové operátory

### Barevné prahy (pokrytí % zaškolených)
- zelená ≥ 90 % · oranžová 70–89 % · červená < 70 %
- Barva se VŽDY odvozuje od hodnoty, nikdy fixně od směny/projektu

### Kontroly v rozpisu směn
- Přiřazení operátora s úrovní 0 → červený rámeček + varování "NENÍ ZAŠKOLEN"
- Úroveň 1 → oranžový rámeček + "pouze pod dohledem"
- Operátor už přiřazený jinde ve stejné směně/týdnu/projektu → indikace "⚠ již v rozpisu"

### Sjednocené názvy pozic (RENAME_MAP — aplikuje se i při importu)
- Usw1/Usw2/Us.Wel → US Welding (1/2)
- VIB / Wib → Vibrační svařování
- RW → Rework
- PNCH → Punching
- Fleece + PNCH → Fleece + Punching

### Směny v rozpisu
- Ranní / Odpolední / Noční (NE dny v týdnu, NE směny A–D)
- Týdny číslované jako CW (ISO týden), pondělí jako klíč

## Projekty a pozice (výchozí, z reálných rozpisů CW29)

Prefix, G463, GBDP, SK336/W206, W177 (MFA2), W247 (MFA2), Mbeam X540, OV 51/64, Foam, Slush/Sewing, IMM.
Každý projekt má TL a TR jako první pozice. Pozice viz `DEFAULT_PROJECTS` v kódu.

## Import oficiálních skill matric (.xlsx)

Formát (šablona PL-LSHR-FR-LWI-04-01-01):
- Řádek s "Proces:" → název procesu (sloupec E)
- Řádek 7: "Jméno / Operace" (sl. B), "Pozice" (sl. D), pracoviště od sl. E s krokem 6 sloupců
- Bloky zaměstnanců: jméno + pozice (OP/TL/TR), score řádek o 3–8 řádků níže
- Score řádek: hodnota ve sl. pracoviště, max (=5) ve sl. +2; **jen buňky s max=5 jsou platné**
- POZOR: SheetJS vrací prázdné řádky jako [] — proto dynamické hledání score řádku, ne pevný offset
- Import prochází VŠECHNY listy (Směna A–D, TL+TR, Skill Matrix…); listy bez headeru přeskočí
- Párování: projekt dle názvu (case-insensitive contains), operátor dle normalizovaného jména

## Technická omezení (závodní IT prostředí)

- **Žádný backend** — IT blokuje HTTP triggery a konektory; vše client-side
- **Žádné CDN za runtime** — knihovny musí být v repu (XLSX embedovaná/lokální); závodní síť blokuje externí zdroje
- **Hosting: GitHub Pages** — účet `uhanm056` (SharePoint/OneDrive HTML soubory stahují místo spuštění)
- Data: localStorage + export/import JSON pro sdílení mezi počítači
- Cílové prohlížeče: Edge/Chrome na závodních PC, plná funkčnost offline po načtení

## Design

- Yanfeng styl: tmavě modrá #0B2E59 (hlavička/struktura), bílé/světlé pozadí #F2F4F6
- Signature prvek: **kvadrantové čtverce** (4 čtvrtiny = úroveň 0–4) — odpovídá papírové matici, kterou tým zná
- Barvy směn: A #0B5FA5 · B #0E7A55 · C #A0521B · D #5B3FA8 (používané jinde v ekosystému)
- Čeština ve všem UI; stručné texty bez korporátního balastu
- Tisková verze rozpisu pro TL (@media print — skrýt navigaci, tlačítka, picker)

## Roadmap (priorita shora)

1. Refaktor na strukturu souborů + Git + GitHub Pages deploy
2. Otestovat import všech oficiálních matic (IMM ověřeno, Prefix ověřit)
3. Export týdenního rozpisu do tisknutelného PDF/formátu pro TL
4. Import operátorů z týdenních rozpisů CW (formát viz interní soubory)
5. Historie/trend připravenosti po měsících
6. Později: SQL Server backend až IT zpřístupní server Cz3250vm0048 (místo localStorage)

## Konvence pro Claude Code

- Vždy zachovat zpětnou kompatibilitu localStorage dat (migrace, ne breaking changes)
- Po každé změně ověřit: `node --check` na JS, otevřít v prohlížeči, otestovat import IMM matice
- Nekomitovat reálná jména zaměstnanců ani exporty dat (přidat do .gitignore: *.json zálohy, *.xlsx)
- Commit messages česky, stručně
