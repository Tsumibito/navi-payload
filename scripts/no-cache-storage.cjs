class FakeCache {
  async match() {
    return null;
  }

  async put() {
    return undefined;
  }

  async delete() {
    return false;
  }
}

class FakeCacheStorage {
  async open() {
    return new FakeCache();
  }
}

globalThis.CacheStorage = FakeCacheStorage;
globalThis.caches = new FakeCacheStorage();
