// v1.9 足迹存档。与旧功能使用不同 key，便于未来独立迁移到云端。
const FootprintsStorage = (() => {
  "use strict";
  const TRAVEL_KEY = "xiaoluXiaogTravelV1";
  const TRANSPORT_KEY = "xiaoluXiaogTransportV1";
  const VERSION = 1;
  const travelEmpty = () => ({ schemaVersion: VERSION, records: [] });
  const transportEmpty = () => ({ schemaVersion: VERSION, entries: {}, custom: [], achievementDates: {} });

  function read(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback();
    } catch (error) {
      console.warn(`读取足迹存档失败（${key}），已使用安全默认值，原内容未被覆盖。`, error);
      return fallback();
    }
  }
  function write(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch (error) { console.warn(`保存足迹存档失败（${key}）。`, error); return false; }
  }
  function travel() {
    const data = read(TRAVEL_KEY, travelEmpty);
    return { ...travelEmpty(), ...data, records: Array.isArray(data.records) ? data.records : [] };
  }
  function transport() {
    const data = read(TRANSPORT_KEY, transportEmpty);
    return {
      ...transportEmpty(), ...data,
      entries: data.entries && typeof data.entries === "object" && !Array.isArray(data.entries) ? data.entries : {},
      custom: Array.isArray(data.custom) ? data.custom : [],
      achievementDates: data.achievementDates && typeof data.achievementDates === "object" ? data.achievementDates : {}
    };
  }
  function saveTravel(data) { return write(TRAVEL_KEY, { ...data, schemaVersion: VERSION }); }
  function saveTransport(data) { return write(TRANSPORT_KEY, { ...data, schemaVersion: VERSION }); }
  function saveTransportAchievementDates(ids) {
    const data = transport(), now = new Date().toISOString();
    ids.forEach(id => { if (!data.achievementDates[id]) data.achievementDates[id] = now; });
    saveTransport(data);
    return data.achievementDates;
  }
  return { TRAVEL_KEY, TRANSPORT_KEY, travel, transport, saveTravel, saveTransport, saveTransportAchievementDates };
})();
