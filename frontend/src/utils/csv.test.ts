import { serializeCSVField } from "./csv";

test("escapes delimiters, quotes and spreadsheet formulas", () => {
  expect(serializeCSVField('one, "two"')).toBe('"one, ""two"""');
  expect(serializeCSVField("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
  expect(serializeCSVField(null)).toBe('""');
  expect(serializeCSVField(2026)).toBe('"2026"');
});
