/**
 * IndexedDB Storage Service (Free Tier)
 *
 * Uses localforage for IndexedDB access with localStorage-like API.
 * Provides ~50MB+ storage compared to localStorage's 5-10MB limit.
 */

import localforage from 'localforage';

// Debug logging flag - set to true to see all storage operations
let DEBUG = true;

const log = (...args) => {
  if (DEBUG) console.log('[IndexedDB]', ...args);
};

// Configure localforage instance for dynasties
const dynastyStore = localforage.createInstance({
  name: 'CFBDynastyTracker',
  storeName: 'dynasties',
  description: 'Dynasty data storage for CFB Dynasty Tracker'
});

// Storage key (matches old localStorage key for potential migration)
const DYNASTIES_KEY = 'cfb-dynasties';

// Rolling local backups (safeguard against a bad write or a browser clear).
// A ring of the last few known-good non-empty snapshots, kept under a
// separate key so a wipe of the primary key doesn't take them with it in
// the same operation. Throttled so rapid saves don't churn the ring.
const BACKUPS_KEY = 'cfb-dynasties-backups';
const MAX_BACKUPS = 3;
const BACKUP_MIN_INTERVAL_MS = 10 * 60 * 1000; // at most one snapshot / 10 min

// Snapshot the known-good state we're about to persist. Best-effort: a
// backup failure must never block or fail the real save.
async function maybeSnapshotBackup(dynasties) {
  try {
    if (!Array.isArray(dynasties) || dynasties.length === 0) return;
    const backups = (await dynastyStore.getItem(BACKUPS_KEY)) || [];
    const last = backups[backups.length - 1];
    if (last && typeof last.ts === 'number' && Date.now() - last.ts < BACKUP_MIN_INTERVAL_MS) {
      return; // throttled — a recent snapshot already covers this window
    }
    backups.push({ ts: Date.now(), dynasties });
    while (backups.length > MAX_BACKUPS) backups.shift();
    await dynastyStore.setItem(BACKUPS_KEY, backups);
  } catch (e) {
    console.warn('[IndexedDB] backup snapshot failed (non-fatal):', e?.message || e);
  }
}

/**
 * IndexedDB Storage Implementation
 *
 * All methods are async and return Promises.
 * Data structure is identical to Firebase storage for easy migration.
 */
export const indexedDBStorage = {
  /**
   * Get all dynasties from IndexedDB
   * @returns {Promise<Array>} Array of dynasty objects
   */
  async getDynasties() {
    try {
      log('getDynasties() called');
      const dynasties = await dynastyStore.getItem(DYNASTIES_KEY);
      log(`getDynasties() returned ${dynasties?.length || 0} dynasties`);
      return dynasties || [];
    } catch (error) {
      console.error('[IndexedDB] Error getting dynasties:', error);
      return [];
    }
  },

  /**
   * Save all dynasties to IndexedDB
   * @param {Array} dynasties - Array of dynasty objects
   * @param {Object} [options]
   * @param {boolean} [options.allowEmpty] - Permit overwriting a non-empty
   *   store with an empty array. Only the intentional-clear paths
   *   (deleteDynasty removing the last dynasty, clearAll) pass this.
   * @returns {Promise<void>}
   */
  async saveDynasties(dynasties, options = {}) {
    const { allowEmpty = false } = options;
    try {
      const list = Array.isArray(dynasties) ? dynasties : [];
      log(`saveDynasties() called with ${list.length} dynasties`);

      // DATA-LOSS GUARD: refuse to overwrite a non-empty store with an empty
      // array unless the caller explicitly intends it. getDynasties() returns
      // [] on a transient read error, and the local update path maps that to
      // [] and would then persist it here — silently wiping every local
      // dynasty. Only a genuine "deleted my last dynasty" / clearAll passes
      // allowEmpty, so blocking the rest is safe.
      if (list.length === 0 && !allowEmpty) {
        const existing = await dynastyStore.getItem(DYNASTIES_KEY);
        if (Array.isArray(existing) && existing.length > 0) {
          console.error(`[IndexedDB] BLOCKED empty overwrite of ${existing.length} existing dynasties (pass { allowEmpty: true } for an intentional clear).`);
          throw new Error('Refusing to overwrite existing local dynasties with an empty list');
        }
      }

      // Snapshot the good state into the rolling backup ring BEFORE the write,
      // so even a corrupt write leaves a recoverable prior copy. Throttled and
      // best-effort — never blocks the real save.
      await maybeSnapshotBackup(list);

      await dynastyStore.setItem(DYNASTIES_KEY, list);
      log('saveDynasties() complete');
    } catch (error) {
      console.error('[IndexedDB] Error saving dynasties:', error);
      throw error;
    }
  },

  /**
   * List the rolling local backup snapshots (newest last).
   * @returns {Promise<Array<{ts:number, dynasties:Array}>>}
   */
  async getBackups() {
    try {
      const backups = await dynastyStore.getItem(BACKUPS_KEY);
      return Array.isArray(backups) ? backups : [];
    } catch (error) {
      console.error('[IndexedDB] Error reading backups:', error);
      return [];
    }
  },

  /**
   * Restore a backup snapshot by timestamp. MERGES the snapshot's local
   * dynasties into the current store by id (snapshot wins on conflict) so a
   * restore can only ADD/repair dynasties, never delete ones created since.
   * @param {number} ts - The snapshot's ts (from getBackups)
   * @returns {Promise<{restored:number}>}
   */
  async restoreBackup(ts) {
    const backups = await this.getBackups();
    const snap = backups.find(b => Number(b.ts) === Number(ts));
    if (!snap || !Array.isArray(snap.dynasties)) {
      throw new Error('Backup snapshot not found');
    }
    const current = await this.getDynasties();
    const byId = new Map(current.map(d => [String(d.id), d]));
    for (const d of snap.dynasties) {
      if (d && d.id != null) byId.set(String(d.id), d);
    }
    const merged = [...byId.values()];
    await this.saveDynasties(merged);
    return { restored: snap.dynasties.length };
  },

  /**
   * Get a single dynasty by ID
   * @param {string} dynastyId - Dynasty ID
   * @returns {Promise<Object|null>} Dynasty object or null
   */
  async getDynasty(dynastyId) {
    try {
      log(`getDynasty(${dynastyId}) called`);
      const dynasties = await this.getDynasties();
      const dynasty = dynasties.find(d => String(d.id) === String(dynastyId)) || null;
      log(`getDynasty(${dynastyId}) found: ${dynasty ? dynasty.name : 'null'}`);
      return dynasty;
    } catch (error) {
      console.error('[IndexedDB] Error getting dynasty:', error);
      return null;
    }
  },

  /**
   * Create a new dynasty
   * @param {Object} dynasty - Dynasty object (must include id)
   * @returns {Promise<Object>} Created dynasty
   */
  async createDynasty(dynasty) {
    try {
      log(`createDynasty() called for "${dynasty.name}"`);
      const dynasties = await this.getDynasties();
      dynasties.push(dynasty);
      await this.saveDynasties(dynasties);
      log(`createDynasty() complete - id: ${dynasty.id}`);
      return dynasty;
    } catch (error) {
      console.error('[IndexedDB] Error creating dynasty:', error);
      throw error;
    }
  },

  /**
   * Update a dynasty by ID
   * @param {string} dynastyId - Dynasty ID
   * @param {Object} updates - Partial updates to apply
   * @returns {Promise<Object>} Updated dynasty
   */
  async updateDynasty(dynastyId, updates) {
    try {
      log(`updateDynasty(${dynastyId}) called with keys:`, Object.keys(updates));
      const dynasties = await this.getDynasties();
      const index = dynasties.findIndex(d => String(d.id) === String(dynastyId));

      if (index === -1) {
        throw new Error(`Dynasty ${dynastyId} not found`);
      }

      // Apply updates (supports dot notation for nested fields)
      const updated = { ...dynasties[index] };

      for (const [key, value] of Object.entries(updates)) {
        if (key.includes('.')) {
          // Handle dot notation (e.g., 'preseasonSetup.scheduleEntered')
          const parts = key.split('.');
          let obj = updated;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
          }
          obj[parts[parts.length - 1]] = value;
        } else {
          updated[key] = value;
        }
      }

      dynasties[index] = updated;
      await this.saveDynasties(dynasties);
      log(`updateDynasty(${dynastyId}) complete`);
      return updated;
    } catch (error) {
      console.error('[IndexedDB] Error updating dynasty:', error);
      throw error;
    }
  },

  /**
   * Delete a dynasty by ID
   * @param {string} dynastyId - Dynasty ID
   * @returns {Promise<void>}
   */
  async deleteDynasty(dynastyId) {
    try {
      log(`deleteDynasty(${dynastyId}) called`);
      const dynasties = await this.getDynasties();
      const filtered = dynasties.filter(d => String(d.id) !== String(dynastyId));
      // Intentional removal — allow the store to reach empty (deleting the
      // last dynasty). Guarded so an errant read (getDynasties → []) can't
      // wipe the store under cover of a delete: only proceed to an empty
      // result when we actually found and removed the target.
      const removedTarget = filtered.length < dynasties.length;
      await this.saveDynasties(filtered, { allowEmpty: removedTarget });
      log(`deleteDynasty(${dynastyId}) complete`);
    } catch (error) {
      console.error('[IndexedDB] Error deleting dynasty:', error);
      throw error;
    }
  },

  /**
   * Clear all dynasty data
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      log('clearAll() called');
      await dynastyStore.removeItem(DYNASTIES_KEY);
      log('clearAll() complete');
    } catch (error) {
      console.error('[IndexedDB] Error clearing data:', error);
      throw error;
    }
  },

  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebug(enabled) {
    DEBUG = enabled;
    log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  },

  /**
   * Check if IndexedDB is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      await dynastyStore.setItem('__test__', true);
      await dynastyStore.removeItem('__test__');
      return true;
    } catch (error) {
      console.error('[IndexedDB] Storage not available:', error);
      return false;
    }
  },

  /**
   * Get storage usage info
   * @returns {Promise<Object>} { used, quota, percent }
   */
  async getStorageInfo() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        return {
          used: usage,
          quota: quota,
          percent: ((usage / quota) * 100).toFixed(2)
        };
      }
      return { used: 0, quota: 0, percent: 0 };
    } catch (error) {
      console.error('[IndexedDB] Error getting storage info:', error);
      return { used: 0, quota: 0, percent: 0 };
    }
  },

  /**
   * Migrate data from localStorage to IndexedDB
   * Call this once on app init to migrate existing localStorage users
   * @returns {Promise<boolean>} True if migration occurred
   */
  async migrateFromLocalStorage() {
    try {
      const localData = localStorage.getItem('cfb-dynasties');
      if (!localData) return false;

      const existingIndexedDB = await this.getDynasties();
      if (existingIndexedDB.length > 0) {
        // Already have data in IndexedDB, don't overwrite
        console.log('[IndexedDB] Data already exists, skipping migration');
        return false;
      }

      const dynasties = JSON.parse(localData);
      await this.saveDynasties(dynasties);

      // Optionally remove localStorage after successful migration
      // localStorage.removeItem('cfb-dynasties');

      console.log('[IndexedDB] Successfully migrated from localStorage');
      return true;
    } catch (error) {
      console.error('[IndexedDB] Migration from localStorage failed:', error);
      return false;
    }
  }
};

export default indexedDBStorage;
