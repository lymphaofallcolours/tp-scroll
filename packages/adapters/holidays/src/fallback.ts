import type { Holiday, HolidayProvider } from "./provider.js";

export class FallbackHolidayProvider implements HolidayProvider {
  readonly name = "fallback";
  private readonly cache = new Map<string, ReadonlyArray<Holiday>>();

  constructor(
    private readonly primary: HolidayProvider,
    private readonly fallback: HolidayProvider,
  ) {}

  async forCountry(countryCode: string, year: number): Promise<ReadonlyArray<Holiday>> {
    const key = `${countryCode.toUpperCase()}:${year}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    let result: ReadonlyArray<Holiday>;
    try {
      result = await this.primary.forCountry(countryCode, year);
    } catch {
      result = await this.fallback.forCountry(countryCode, year);
    }
    this.cache.set(key, result);
    return result;
  }
}
