import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { splitBody, splitSectionNodes } from "../../src/parser/split";
import { findNpcNodes } from "../../src/parser/dom/nodes";
import type { NpcNodes, RawSection } from "../../src/parser/types";

function nodesFrom(html: string): Node[] {
  const div = document.createElement("div");
  div.innerHTML = html;
  return [...div.childNodes];
}

const field = (label: string, text: string) => ({ kind: "field", label, text });
const plain = (text: string) => ({ kind: "text", text });

const labelsOf = (s: RawSection) => s.entries.flatMap((e) => (e.kind === "field" ? [e.label] : []));

function fieldText(s: RawSection, label: string): string {
  const entry = s.entries.find((e) => e.kind === "field" && e.label === label);
  if (!entry) throw new Error(`no field labelled "${label}"`);
  return entry.text;
}

const squash = (s: string) => s.replace(/\s+/g, "");

describe("splitBody", () => {
  describe("fields", () => {
    test("returns nothing for no nodes", () => {
      expect(splitBody([])).toEqual([]);
    });

    test("reads one label and its text", () => {
      expect(splitBody(nodesFrom("<b>AC</b> 44"))).toEqual([field("AC", "44")]);
    });

    test("reads two labels on one line", () => {
      expect(splitBody(nodesFrom("<b>A</b> 1 <b>B</b> 2"))).toEqual([
        field("A", "1"),
        field("B", "2"),
      ]);
    });

    test("keeps the last entry", () => {
      const result = splitBody(nodesFrom("<b>A</b> 1<br><b>B</b> 2"));

      expect(result).toEqual([field("A", "1"), field("B", "2")]);
    });

    test("keeps entries in page order", () => {
      const result = splitBody(nodesFrom("<b>C</b> 3<br><b>A</b> 1<br><b>B</b> 2"));

      expect(result.map((e) => (e.kind === "field" ? e.label : null))).toEqual(["C", "A", "B"]);
    });

    test("keeps a repeated label as a second entry", () => {
      const result = splitBody(nodesFrom("<b>Melee</b> one<br><b>Melee</b> two"));

      expect(result).toEqual([field("Melee", "one"), field("Melee", "two")]);
    });

    test("trims whitespace inside the label", () => {
      expect(splitBody(nodesFrom("<b>Spells Prepared </b>(CL 20th)"))).toEqual([
        field("Spells Prepared", "(CL 20th)"),
      ]);
    });

    test("handles no space between the label and its text", () => {
      expect(splitBody(nodesFrom("<b>Spells Prepared</b>(CL 20th)"))).toEqual([
        field("Spells Prepared", "(CL 20th)"),
      ]);
    });

    test("trims leading double spaces from the text", () => {
      expect(splitBody(nodesFrom("<b>Ranged</b>  <i>+5 bow</i>"))).toEqual([
        field("Ranged", "+5 bow"),
      ]);
    });

    test("keeps a field with empty text", () => {
      expect(splitBody(nodesFrom("<b>A</b><b>B</b> 2"))).toEqual([field("A", ""), field("B", "2")]);
    });
  });

  describe("inline tags and spacing", () => {
    test("keeps text inside <i>, with the surrounding spaces", () => {
      const result = splitBody(nodesFrom("<b>Melee</b> <i>+5 sword </i>+35"));

      expect(result).toEqual([field("Melee", "+5 sword +35")]);
    });

    test("keeps text inside an <i> nested in an <a>", () => {
      const result = splitBody(nodesFrom('<b>Source</b> <a href="#"><i>Bestiary pg. 12</i></a>'));

      expect(result).toEqual([field("Source", "Bestiary pg. 12")]);
    });

    test("does not glue words together across inline tags", () => {
      expect(splitBody(nodesFrom("<b>A</b> one <i>two</i> three"))).toEqual([
        field("A", "one two three"),
      ]);
    });

    test("skips HTML comments", () => {
      expect(splitBody(nodesFrom("<b>A</b> 1 <!-- hidden -->2"))).toEqual([field("A", "1 2")]);
    });
  });

  describe("line breaks", () => {
    test("turns <br> into a newline inside a value", () => {
      expect(splitBody(nodesFrom("<b>A</b> 1<br>2<br>3"))).toEqual([field("A", "1\n2\n3")]);
    });

    test("keeps a blank line made by two <br>", () => {
      expect(splitBody(nodesFrom("<b>A</b> 1<br><br>2"))).toEqual([field("A", "1\n\n2")]);
    });

    test("trims a trailing <br> from the value", () => {
      expect(splitBody(nodesFrom("<b>A</b> 1<br>"))).toEqual([field("A", "1")]);
    });

    test("a continuation line belongs to the label above it", () => {
      const result = splitBody(
        nodesFrom(
          "<b>Spell-Like Abilities</b> (CL 20th)<br>Constant—detect evil<br>3/day—heal<br><b>Next</b> x",
        ),
      );

      expect(result).toEqual([
        field("Spell-Like Abilities", "(CL 20th)\nConstant—detect evil\n3/day—heal"),
        field("Next", "x"),
      ]);
    });
  });

  describe("text without a label", () => {
    test("keeps text before the first label as a text entry", () => {
      expect(splitBody(nodesFrom("hello <b>A</b> 1"))).toEqual([plain("hello"), field("A", "1")]);
    });

    test("keeps text with no label at all", () => {
      expect(splitBody(nodesFrom("just prose<br><br>more prose"))).toEqual([
        plain("just prose\n\nmore prose"),
      ]);
    });

    test("drops whitespace-only text before the first label", () => {
      expect(splitBody(nodesFrom("  <b>A</b> 1"))).toEqual([field("A", "1")]);
    });

    test("a <br> before the first label creates no entry", () => {
      expect(splitBody(nodesFrom("<br><b>A</b> 1"))).toEqual([field("A", "1")]);
    });
  });

  describe("empty bold tags", () => {
    test("an empty <b> is content, not a label", () => {
      expect(splitBody(nodesFrom("<b>A</b> 1<b> </b>2"))).toEqual([field("A", "1 2")]);
    });

    test("an empty <b> before any label creates no entry", () => {
      expect(splitBody(nodesFrom("<b></b><b>A</b> 1"))).toEqual([field("A", "1")]);
    });
  });

  describe("decisions recorded as tests", () => {
    test("does not strip trailing separators", () => {
      expect(splitBody(nodesFrom("<b>Init</b> +9;"))).toEqual([field("Init", "+9;")]);
      expect(splitBody(nodesFrom("<b>Str</b> 28,"))).toEqual([field("Str", "28,")]);
    });

    test("does not rewrite en dashes", () => {
      expect(splitBody(nodesFrom("<b>AC</b> \u20131 size"))).toEqual([field("AC", "\u20131 size")]);
    });

    test("does not collapse spaces inside a value", () => {
      expect(splitBody(nodesFrom("<b>A</b> one  two"))).toEqual([field("A", "one  two")]);
    });

    test("keeps a shared tail on the last label of a line", () => {
      const result = splitBody(
        nodesFrom("<b>Fort</b> +25, <b>Ref</b> +14, <b>Will</b> +23; +4 vs. poison"),
      );

      expect(result).toEqual([
        field("Fort", "+25,"),
        field("Ref", "+14,"),
        field("Will", "+23; +4 vs. poison"),
      ]);
    });
  });
});

describe("splitSectionNodes", () => {
  test("returns null when the section is absent", () => {
    expect(splitSectionNodes(null)).toBeNull();
  });

  test("separates the heading from the entries", () => {
    expect(splitSectionNodes(nodesFrom("<h3>Defense</h3><b>AC</b> 44<br><b>SR</b> 34"))).toEqual({
      heading: "Defense",
      entries: [field("AC", "44"), field("SR", "34")],
    });
  });

  test("trims the heading text", () => {
    expect(splitSectionNodes(nodesFrom("<h3> Defense </h3>"))?.heading).toBe("Defense");
  });

  test("a heading alone gives no entries", () => {
    expect(splitSectionNodes(nodesFrom("<h3>Empty</h3>"))).toEqual({
      heading: "Empty",
      entries: [],
    });
  });

  test("never lists the heading as an entry", () => {
    const section = splitSectionNodes(nodesFrom("<h3>Description</h3>Some prose"));

    expect(section?.entries).toEqual([plain("Some prose")]);
  });

  test.each(["h1", "h2", "h3"])("accepts <%s> as the heading", (tag) => {
    const section = splitSectionNodes(nodesFrom(`<${tag}>Title</${tag}><b>A</b> 1`));

    expect(section).toEqual({ heading: "Title", entries: [field("A", "1")] });
  });

  test("only reads the nodes it was given, not the siblings after them", () => {
    const all = nodesFrom("<h3>X</h3><b>A</b> 1<h3>Y</h3><b>B</b> 2");

    expect(splitSectionNodes(all.slice(0, 3))?.entries).toEqual([field("A", "1")]);
  });

  describe("throws when the contract is broken", () => {
    test("first node is not a heading", () => {
      expect(() => splitSectionNodes(nodesFrom("<b>A</b> 1"))).toThrow(/heading/);
    });

    test("first node is a text node", () => {
      expect(() => splitSectionNodes(nodesFrom("oops<h3>X</h3>"))).toThrow(/heading/);
    });

    test("the list is empty", () => {
      expect(() => splitSectionNodes([])).toThrow(/heading/);
    });

    test("first node is a heading-like tag that is not one", () => {
      expect(() => splitSectionNodes(nodesFrom("<h4>X</h4><b>A</b> 1"))).toThrow(/heading/);
    });
  });
});

const SECTIONS = [
  "details",
  "defense",
  "offense",
  "statistics",
  "ecology",
  "specialAbilities",
  "description",
] as const;

describe("solar fixture", () => {
  let npc: NpcNodes;

  const section = (key: (typeof SECTIONS)[number]): RawSection => {
    const result = splitSectionNodes(npc[key]);
    if (!result) throw new Error(`fixture is missing ${key}`);
    return result;
  };

  beforeAll(() => {
    const html = readFileSync("./fixtures/solar.html", "utf8");
    const doc = new DOMParser().parseFromString(html, "text/html");
    npc = findNpcNodes(doc);
  });

  describe("every section", () => {
    test.each([...SECTIONS])("%s: loses no text", (key) => {
      const nodes = npc[key]!;
      const s = section(key);

      const rebuilt =
        s.heading + s.entries.map((e) => (e.kind === "field" ? e.label : "") + e.text).join("");
      const original = nodes.map((n) => n.textContent ?? "").join("");

      expect(squash(rebuilt)).toBe(squash(original));
    });

    test.each([...SECTIONS])("%s: entries are tidy", (key) => {
      for (const e of section(key).entries) {
        expect(e.text).toBe(e.text.trim());

        if (e.kind === "field") {
          expect(e.label).toBe(e.label.trim());
          expect(e.label).not.toBe("");
        } else {
          expect(e.text).not.toBe("");
        }
      }
    });

    test.each([...SECTIONS])("%s: stops before the angel category list", (key) => {
      expect(JSON.stringify(section(key))).not.toContain("Creatures in");
    });
  });

  test("details", () => {
    expect(section("details")).toEqual({
      heading: "Solar CR 23",
      entries: [
        field("Source", "Pathfinder RPG Bestiary pg. 12"),
        field("XP", "819,200\nNG Large outsider (angel, extraplanar, good)"),
        field("Init", "+9;"),
        field(
          "Senses",
          "darkvision 60 ft., low-light vision, detect evil, detect snares and pits, true seeing; Perception +33",
        ),
        field("Aura", "protective aura"),
      ],
    });
  });

  test("defense", () => {
    expect(section("defense")).toEqual({
      heading: "Defense",
      entries: [
        field(
          "AC",
          "44, touch 11, flat-footed 42 (+14 armor, +1 Dex, +1 dodge, +19 natural, \u20131 size; +4 deflection vs. evil)",
        ),
        field("hp", "363 (22d10+242); regeneration 15 (evil artifacts, effects, and spells)"),
        field("Fort", "+25,"),
        field("Ref", "+14,"),
        field("Will", "+23; +4 vs. poison, +4 resistance vs. evil"),
        field("DR", "15/epic and evil;"),
        field("Immune", "acid, cold, petrification;"),
        field("Resist", "electricity 10, fire 10;"),
        field("SR", "34"),
      ],
    });
  });

  describe("offense", () => {
    test("labels, in order", () => {
      expect(labelsOf(section("offense"))).toEqual([
        "Speed",
        "Melee",
        "Ranged",
        "Space",
        "Reach",
        "Spell-Like Abilities",
        "Spells Prepared",
      ]);
    });

    test("single-line fields", () => {
      const s = section("offense");

      expect(fieldText(s, "Speed")).toBe(
        "50 ft., fly 150 ft. (good); 35 ft., fly 100 ft. (good) in armor",
      );
      expect(fieldText(s, "Melee")).toBe(
        "+5 dancing greatsword +35/+30/+25/+20 (3d6+18) or slam +30 (2d8+13)",
      );
      expect(fieldText(s, "Ranged")).toBe(
        "+5 composite longbow (+9 Str bonus) +31/+26/+21/+16 (2d6+14 plus slaying arrow)",
      );
      expect(fieldText(s, "Space")).toBe("10 ft.,");
      expect(fieldText(s, "Reach")).toBe("10 ft.");
    });

    test("Spell-Like Abilities keeps its five lines", () => {
      const lines = fieldText(section("offense"), "Spell-Like Abilities").split("\n");

      expect(lines).toHaveLength(5);
      expect(lines[0]).toBe("(CL 20th)");
      expect(lines[1]).toMatch(/^Constant—detect evil/);
      expect(lines[2]).toMatch(/^At Will—aid, animate objects/);
      expect(lines[3]).toMatch(/^3\/day—blade barrier/);
      expect(lines[4]).toMatch(/^1\/day—greater restoration/);
    });

    test("Spells Prepared keeps its eleven lines", () => {
      const lines = fieldText(section("offense"), "Spells Prepared").split("\n");

      expect(lines).toHaveLength(11);
      expect(lines[0]).toBe("(CL 20th)");
      expect(lines[1]).toBe("9th—etherealness, mass heal, miracle, storm of vengeance (DC 27)");
    });
  });

  describe("statistics", () => {
    test("labels, in order", () => {
      expect(labelsOf(section("statistics"))).toEqual([
        "Str",
        "Dex",
        "Con",
        "Int",
        "Wis",
        "Cha",
        "Base Atk",
        "CMB",
        "CMD",
        "Feats",
        "Skills",
        "Languages",
        "SQ",
      ]);
    });

    test("values", () => {
      const s = section("statistics");

      expect(fieldText(s, "Str")).toBe("28,");
      expect(fieldText(s, "Cha")).toBe("25");
      expect(fieldText(s, "Base Atk")).toBe("+22;");
      expect(fieldText(s, "CMB")).toBe("+32;");
      expect(fieldText(s, "CMD")).toBe("47");
      expect(fieldText(s, "Feats")).toMatch(/^Cleave, Deadly Aim, Dodge/);
      expect(fieldText(s, "Skills")).toMatch(/^Craft \(any one\) \+31, Diplomacy \+32/);
      expect(fieldText(s, "Languages")).toBe("Celestial, Draconic, Infernal; truespeech");
      expect(fieldText(s, "SQ")).toBe("change shape (alter self)");
    });
  });

  test("ecology", () => {
    expect(section("ecology")).toEqual({
      heading: "Ecology",
      entries: [
        field("Environment", "any good-aligned plane"),
        field("Organization", "solitary or pair"),
        field(
          "Treasure",
          "double (+5 full plate, +5 dancing greatsword, +5 composite longbow [+9 Str bonus])",
        ),
      ],
    });
  });

  describe("special abilities", () => {
    // Here the bold text is an ability NAME, not a field name.
    test("labels are the ability names", () => {
      expect(labelsOf(section("specialAbilities"))).toEqual(["Spells", "Slaying Arrow (Su)"]);
    });

    test("values", () => {
      const s = section("specialAbilities");

      expect(fieldText(s, "Spells")).toMatch(
        /^Solars can cast divine spells as 20th-level clerics\./,
      );
      expect(fieldText(s, "Slaying Arrow (Su)")).toBe(
        "A solar\u2019s bow needs no ammunition, and automatically creates a slaying arrow of the solar\u2019s choice when drawn.",
      );
    });
  });

  describe("description", () => {
    test("is one unlabeled entry", () => {
      const s = section("description");

      expect(s.heading).toBe("Description");
      expect(s.entries).toHaveLength(1);
      expect(s.entries[0].kind).toBe("text");
    });

    test("starts with the prose, not the heading", () => {
      const text = section("description").entries[0].text;

      expect(text).toMatch(/^Solars are the greatest type of angel/);
      expect(text).not.toMatch(/^Description/);
    });

    test("keeps eight paragraphs separated by blank lines", () => {
      const paragraphs = section("description").entries[0].text.split("\n\n");

      expect(paragraphs).toHaveLength(8);
      expect(paragraphs.at(-1)).toBe(
        "All angels respect the power and wisdom of solars, and though these mightiest of angels usually work alone, they sometimes command multiple armies led by planetars, acting as great field marshals for massive incursions against the legions of Hell or the hordes of the Abyss.",
      );
    });
  });
});
