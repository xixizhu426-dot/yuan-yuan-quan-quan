export const STORE_KEY = 'yuan-yuan-quan-quan:works:v1';
export const SNAPSHOT_KEY = 'yuan-yuan-quan-quan:snapshots:v1';
export const PHOTO_WALL_KEY = 'yuan-yuan-quan-quan:photo-wall:v1';
export const RELAY_ROOM_KEY = 'yuan-yuan-quan-quan:relay-rooms:v1';

const isWork = (value) => value && typeof value.id === 'string'
  && typeof value.title === 'string'
  && typeof value.createdAt === 'string'
  && typeof value.image === 'string'
  && value.image.startsWith('data:image/png');

const makeId = () => globalThis.crypto?.randomUUID?.()
  ?? `work-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function createWorkStore(storage) {
  const list = () => {
    try {
      const parsed = JSON.parse(storage.getItem(STORE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isWork) : [];
    } catch {
      return [];
    }
  };

  const write = (works) => storage.setItem(STORE_KEY, JSON.stringify(works));

  return {
    list,
    save(image) {
      if (typeof image !== 'string' || !image.startsWith('data:image/png')) {
        throw new Error('只能保存 PNG 作品');
      }
      const createdAt = new Date().toISOString();
      const work = { id: makeId(), title: `圆圆圈圈 ${list().length + 1}`, createdAt, image };
      write([work, ...list()]);
      return work;
    },
    remove(id) {
      write(list().filter((work) => work.id !== id));
    },
  };
}

const createCollection = (storage, key, validator) => {
  const list = () => {
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(validator) : [];
    } catch {
      return [];
    }
  };
  const write = (items) => storage.setItem(key, JSON.stringify(items));
  return {
    list,
    save(item) { write([item, ...list()]); return item; },
    remove(id) { write(list().filter((item) => item.id !== id)); },
  };
};

const isSnapshot = (value) => value && typeof value.id === 'string'
  && typeof value.image === 'string' && value.image.startsWith('data:image/png')
  && typeof value.createdAt === 'string';

export function createWorldStore(storage) {
  const works = createWorkStore(storage);
  const snapshots = createCollection(storage, SNAPSHOT_KEY, isSnapshot);
  const photoWall = createCollection(storage, PHOTO_WALL_KEY, (value) => value && typeof value.id === 'string' && typeof value.snapshotId === 'string');
  const relayRooms = createCollection(storage, RELAY_ROOM_KEY, (value) => value && typeof value.id === 'string' && Array.isArray(value.players));
  const placeSnapshot = (snapshotId) => {
    if (!snapshots.list().some((snapshot) => snapshot.id === snapshotId)) return false;
    if (photoWall.list().some((item) => item.snapshotId === snapshotId)) return false;
    photoWall.save({ id: makeId(), snapshotId, placedAt: new Date().toISOString() });
    return true;
  };

  return {
    works,
    snapshots: {
      ...snapshots,
      save(image, metadata = {}) {
        if (typeof image !== 'string' || !image.startsWith('data:image/png')) throw new Error('只能保存 PNG 快照');
        return snapshots.save({ id: makeId(), image, createdAt: new Date().toISOString(), ...metadata });
      },
    },
    photoWall,
    relayRooms,
    placeSnapshot,
  };
}
