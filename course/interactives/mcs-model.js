// Rates are in Mbit/s when symbolRate is in Msymbol/s; Shannon uses MHz.
export const modes = [
  {id: 1, modulation: "QPSK", qm: 2, rc: .5},
  {id: 2, modulation: "QPSK", qm: 2, rc: .75},
  {id: 3, modulation: "16-QAM", qm: 4, rc: .5},
  {id: 4, modulation: "16-QAM", qm: 4, rc: .75},
  {id: 5, modulation: "64-QAM", qm: 6, rc: .75},
];
export const rates = (mode, rho = .8, symbolRate = 1) => ({information: symbolRate * mode.qm * mode.rc, useful: rho * symbolRate * mode.qm * mode.rc});
export function parseBer(csv) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const keys = header.split(",");
  return lines.map(line => Object.fromEntries(line.split(",").map((value, i) => [keys[i], keys[i] === "modulation" ? value : Number(value)])));
}
export function measuredThresholds(rows, limit = 1e-3) {
  return modes.map(mode => ({...mode, threshold: Math.min(...rows.filter(row => row.scheme === mode.id && row.ber <= limit).map(row => row.snr_db))}));
}
// Step model: quality improves monotonically beyond the first passing sample.
export const availableModes = (catalog, snr) => catalog.filter(mode => snr >= mode.threshold);
export function bestMode(catalog, snr, rho = .8) {
  return availableModes(catalog, snr).reduce((best, mode) => !best || rates(mode, rho).useful > rates(best, rho).useful ? mode : best, null);
}
export const transmissionTime = (megabits, mbps) => megabits / mbps;
export const linearSnr = db => 10 ** (db / 10);
export const capacity = (mhz, db) => mhz * Math.log2(1 + linearSnr(db));
export function checkNumber(value, expected, tolerance = .011) {
  if (String(value).trim() === "") return false;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && Math.abs(parsed - expected) <= tolerance;
}
