const KEY = 'ns2_save_v1';

export class SaveSystem {
  constructor() {
    this.key = KEY;
    this._cache = null;
    this.lastError = null;
    this._invalidRawPresent = false;
  }

  load() {
    this.lastError = null;
    this._invalidRawPresent = false;
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      let data;
      try { data = JSON.parse(raw); }
      catch (e) { this.lastError = 'Save corrompido (JSON inválido). Os dados não foram apagados.'; this._invalidRawPresent = true; console.warn('Save parse failed', e); return null; }
      if (!data || typeof data !== 'object') { this.lastError = 'Save inválido. Os dados não foram apagados.'; this._invalidRawPresent = true; return null; }
      if (data.version !== 1) { this.lastError = `Versão de save incompatível (${data.version}). Os dados não foram apagados.`; this._invalidRawPresent = true; return null; }
      this._cache = data;
      return data;
    } catch (e) {
      console.warn('Save load failed', e);
      this.lastError = 'Falha ao ler save. Os dados não foram apagados.';
      this._invalidRawPresent = true;
      return null;
    }
  }

  get() {
    if (this._cache) return this._cache;
    if (this.lastError) return null;
    return this.load();
  }

  hasValidSave() {
    const d = this.get();
    return !!(d && d.version === 1 && d.timestamp);
  }

  save(patch = {}) {
    try {
      if (this._invalidRawPresent) {
        console.warn('Save skipped: invalid existing save present. Clear explicitly before overwriting.');
        return false;
      }
      const current = this.get() || { version: 1 };
      const payload = { ...current, ...patch, version: 1, timestamp: Date.now() };
      localStorage.setItem(this.key, JSON.stringify(payload));
      this._cache = payload;
      this.lastError = null;
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  }

  clear() {
    try { localStorage.removeItem(this.key); } catch (_) {}
    this._cache = null;
    this.lastError = null;
    this._invalidRawPresent = false;
  }
}
