const cleanData = (obj) => {
  if (obj === null || obj === undefined) return null;
  try {
    const cache = new Set();
    const stringified = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return;
        cache.add(value);
      }
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'function' || key.startsWith('_')) return undefined;
      if (value && value.nodeType && value.nodeName) return undefined;
      return value;
    });
    return JSON.parse(stringified);
  } catch (e) {
    return JSON.parse(JSON.stringify(obj));
  }
};

var userData = {
  id: "some-id",
  name: "Rafael",
  username: "rafa",
  passwordHash: "123",
  permissions: ["ADMIN"],
  linkedRepresentative: undefined
};

console.log(cleanData(userData));
