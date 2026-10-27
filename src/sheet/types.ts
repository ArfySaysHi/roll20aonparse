/** One Roll20 attribute. `current` and `max` are written together in a single save. */
export interface AttributeWrite {
  name: string;
  current?: string;
  max?: string;
}

/** Everything the page-side script needs to build one character. Plain data, JSON-safe. */
export interface SheetImport {
  /** Character name. */
  name: string;
  /** Plain attributes and repeating-section attributes (`repeating_<section>_<rowId>_<field>`). */
  attributes: AttributeWrite[];
  /** Row ids per repeating section, in display order (written to `_reporder_repeating_<section>`). */
  rowOrders: Record<string, string[]>;
  /** Fields that were present on the page but could not be read; shown to the person. */
  warnings: string[];
}
