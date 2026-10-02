/**
 * Computer-use boundary (NOT implemented yet — no fake behaviour).
 * Observe -> Plan -> Act -> Observe -> Verify loop needs a Windows driver.
 * Planned: screenshots via Electron desktopCapturer; input via a native helper (e.g. nut.js),
 * gated by an app allowlist and per-action confirmation. Office files should prefer
 * direct file generation (docx/xlsx/pptx libraries) over GUI control whenever possible.
 */
export interface ComputerDriver {
  observeScreen(): Promise<{ png: Uint8Array; width: number; height: number }>;
  openApplication(name: string): Promise<void>;
  click(x: number, y: number, opts?: { double?: boolean }): Promise<void>;
  type(text: string): Promise<void>;
  hotkey(keys: string[]): Promise<void>;
  scroll(dx: number, dy: number): Promise<void>;
}
