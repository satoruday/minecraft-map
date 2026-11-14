/**
 * ぼうけんマップ 同期用 Apps Script
 *
 * スプレッドシートの「拡張機能 → Apps Script」にこのファイルの中身を貼りつけて使う。
 * 合言葉は「プロジェクトの設定 → スクリプト プロパティ」に PASSPHRASE として保存する（コードに書かない）。
 * 手順は SETUP-SHEETS.md を参照。
 *
 * API（アプリからは POST・Content-Type: text/plain で送る）
 *   POST { key, ops: [ {op:'upsertPin', pin}, {op:'deletePin', id, updatedAt},
 *                      {op:'upsertType', type}, {op:'deleteType', id, updatedAt} ] }
 *   GET  ?key=...   （読むだけ）
 *   → { ok:true, results:[...], pins:[...], types:[...] }   deleted のものは返さない
 *   → { ok:false, error:'bad-key' | 'no-passphrase' | 'busy' | 'bad-request' }
 * 競合は updatedAt が新しい方を採用。削除は deleted フラグ（論理削除）。
 */

var SHEETS = {
  pins: {
    cols: ['id', 'type', 'dim', 'x', 'y', 'z', 'name', 'kana', 'memo', 'size', 'link', 'created', 'updatedAt', 'deleted'],
    text: ['id', 'type', 'dim', 'name', 'kana', 'memo', 'size', 'link'],
    time: ['created', 'updatedAt'],
    content: ['x', 'z', 'name', 'type'],
    prefix: 'p'
  },
  types: {
    cols: ['id', 'emoji', 'name', 'kana', 'dim', 'color', 'isBiome', 'updatedAt', 'deleted'],
    text: ['id', 'emoji', 'name', 'kana', 'dim', 'color'],
    time: ['updatedAt'],
    content: ['name', 'emoji'],
    prefix: 'c'
  }
};

/** はじめに1回だけエディタから実行する（シートの準備と承認のため） */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) { openTable_(ss, name); });
  var key = PropertiesService.getScriptProperties().getProperty('PASSPHRASE');
  Logger.log(key ? 'じゅんびできました。つぎはデプロイです。'
                 : 'シートはできました。スクリプト プロパティに PASSPHRASE を追加してください。');
}

function doGet(e) {
  return respond_(e && e.parameter ? e.parameter.key : '', []);
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad-request' }); }
  if (!body || typeof body !== 'object') return json_({ ok: false, error: 'bad-request' });
  return respond_(body.key, Array.isArray(body.ops) ? body.ops : []);
}

/** シートを直接編集したら、その行の updatedAt を今の時刻にする（シンプルトリガー） */
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (!SHEETS[sh.getName()]) return;
  var top = Math.max(e.range.getRow(), 2), bottom = e.range.getLastRow();
  if (bottom < top) return;
  var header = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  var uc = header.indexOf('updatedAt') + 1;
  if (uc < 1) return;
  if (e.range.getColumn() === uc && e.range.getLastColumn() === uc) return;
  var now = Date.now(), vals = [];
  for (var r = top; r <= bottom; r++) vals.push([now]);
  sh.getRange(top, uc, vals.length, 1).setValues(vals);
}

/* ---------------- ここから下は内部処理 ---------------- */

function respond_(key, ops) {
  var secret = PropertiesService.getScriptProperties().getProperty('PASSPHRASE');
  if (!secret) return json_({ ok: false, error: 'no-passphrase' });
  if (String(key == null ? '' : key) !== String(secret)) return json_({ ok: false, error: 'bad-key' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'busy' });
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pins = openTable_(ss, 'pins'), types = openTable_(ss, 'types');
    var results = ops.map(function (op) { return applyOp_(op, pins, types); });
    commit_(pins);
    commit_(types);
    return json_({
      ok: true,
      results: results,
      pins: pins.rows.map(function (r) { return pinOut_(r, pins.idx); }).filter(Boolean),
      types: types.rows.map(function (r) { return typeOut_(r, types.idx); }).filter(Boolean)
    });
  } finally {
    lock.releaseLock();
  }
}

function openTable_(ss, name) {
  var def = SHEETS[name];
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var header = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
  while (header.length && header[header.length - 1] === '') header.pop();
  var added = [];
  def.cols.forEach(function (c) { if (header.indexOf(c) < 0) { header.push(c); added.push(c); } });
  if (added.length) {
    if (sh.getMaxColumns() < header.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
    var rows = sh.getMaxRows() - 1;
    if (rows > 0) {
      added.forEach(function (c) {
        var col = header.indexOf(c) + 1;
        if (def.text.indexOf(c) >= 0) sh.getRange(2, col, rows, 1).setNumberFormat('@');
        if (def.time.indexOf(c) >= 0) sh.getRange(2, col, rows, 1).setNumberFormat('0');
      });
    }
  }
  var idx = {};
  header.forEach(function (h, i) { if (h && idx[h] == null) idx[h] = i; });
  var last = sh.getLastRow();
  var values = last > 1 ? sh.getRange(2, 1, last - 1, header.length).getValues() : [];
  var t = { sh: sh, def: def, header: header, idx: idx, values: values, rows: [], byId: {}, dirty: false };
  values.forEach(function (row) {
    var hasContent = def.content.some(function (c) { var v = row[idx[c]]; return v !== '' && v != null; });
    var id = String(row[idx.id] == null ? '' : row[idx.id]).trim();
    if (!id) {
      if (!hasContent) return;
      // シートに手で書いた行には id をつける
      id = newId_(def.prefix);
      row[idx.id] = id;
      if (idx.created != null && !num_(row[idx.created])) row[idx.created] = Date.now();
      if (!num_(row[idx.updatedAt])) row[idx.updatedAt] = Date.now();
      t.dirty = true;
    }
    if (t.byId[id]) return; // 同じ id が2つあれば上の行を使う
    t.byId[id] = row;
    t.rows.push(row);
  });
  return t;
}

function commit_(t) {
  if (!t.dirty || !t.values.length) return;
  var need = t.values.length + 1;
  if (t.sh.getMaxRows() < need) t.sh.insertRowsAfter(t.sh.getMaxRows(), need - t.sh.getMaxRows());
  // = や + ではじまる文字が数式にならないように ' をつけて書く（シート上では見えない）
  var out = t.values.map(function (row) {
    return row.map(function (v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; });
  });
  t.sh.getRange(2, 1, out.length, t.header.length).setValues(out);
}

function applyOp_(op, pins, types) {
  if (!op || typeof op !== 'object') return 'bad';
  switch (op.op) {
    case 'upsertPin': return upsert_(pins, op.pin, pinCells_);
    case 'deletePin': return remove_(pins, op.id, op.updatedAt);
    case 'upsertType': return upsert_(types, op.type, typeCells_);
    case 'deleteType': return remove_(types, op.id, op.updatedAt);
  }
  return 'bad';
}

function upsert_(t, rec, toCells) {
  if (!rec || typeof rec !== 'object' || !rec.id) return 'bad';
  var id = String(rec.id), ts = num_(rec.updatedAt) || Date.now();
  var row = t.byId[id];
  if (row && (num_(row[t.idx.updatedAt]) || 0) > ts) return 'stale';
  var cells = toCells(rec);
  if (!cells) return 'bad';
  cells.id = id;
  cells.updatedAt = ts;
  cells.deleted = false;
  if (!row) {
    row = t.header.map(function () { return ''; });
    t.byId[id] = row;
    t.rows.push(row);
    t.values.push(row);
  }
  Object.keys(cells).forEach(function (k) {
    if (t.idx[k] == null) return;
    row[t.idx[k]] = cells[k];
  });
  t.dirty = true;
  return 'ok';
}

function remove_(t, id, updatedAt) {
  var row = t.byId[String(id)];
  if (!row) return 'ok';
  var ts = num_(updatedAt) || Date.now();
  if ((num_(row[t.idx.updatedAt]) || 0) > ts) return 'stale';
  row[t.idx.deleted] = true;
  row[t.idx.updatedAt] = ts;
  t.dirty = true;
  return 'ok';
}

function pinCells_(p) {
  var x = num_(p.x), z = num_(p.z), y = num_(p.y);
  if (x == null || z == null) return null;
  return {
    type: str_(p.type) || 'other', dim: dim_(p.dim),
    x: Math.round(x), y: y == null ? '' : Math.round(y), z: Math.round(z),
    name: str_(p.name), kana: str_(p.kana), memo: str_(p.memo),
    size: size_(p.size), link: str_(p.link), created: num_(p.created) || Date.now()
  };
}

function typeCells_(t) {
  return {
    emoji: str_(t.emoji), name: str_(t.name), kana: str_(t.kana),
    dim: typeDim_(t.dim), color: str_(t.color), isBiome: !!t.isBiome
  };
}

function pinOut_(row, ix) {
  var g = function (k) { return ix[k] == null ? '' : row[ix[k]]; };
  if (bool_(g('deleted'))) return null;
  var x = num_(g('x')), z = num_(g('z')), y = num_(g('y'));
  if (x == null || z == null) return null;
  var o = {
    id: str_(g('id')), type: str_(g('type')) || 'other', dim: dim_(g('dim')),
    x: Math.round(x), y: y == null ? null : Math.round(y), z: Math.round(z),
    name: str_(g('name')), kana: str_(g('kana')), memo: str_(g('memo')),
    link: str_(g('link')) || null, created: num_(g('created')) || 0, updatedAt: num_(g('updatedAt')) || 0
  };
  var size = size_(g('size'));
  if (size) o.size = size;
  return o;
}

function typeOut_(row, ix) {
  var g = function (k) { return ix[k] == null ? '' : row[ix[k]]; };
  if (bool_(g('deleted'))) return null;
  var name = str_(g('name'));
  if (!name) return null;
  return {
    id: str_(g('id')), emoji: str_(g('emoji')) || '📍', name: name, kana: str_(g('kana')),
    dim: typeDim_(g('dim')), color: str_(g('color')), isBiome: bool_(g('isBiome')),
    updatedAt: num_(g('updatedAt')) || 0
  };
}

function num_(v) {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v.getTime === 'function') return v.getTime();
  var s = String(v).trim()
    .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); })
    .replace(/[－−ー]/g, '-').replace(/，/g, '');
  if (s === '' || s === '-') return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}
function str_(v) { return v == null ? '' : String(v).trim(); }
function bool_(v) { return v === true || /^(true|1|yes|はい|○|✓|✔)$/i.test(String(v == null ? '' : v).trim()); }
function dim_(v) { return /nether|ネザー/i.test(String(v)) ? 'nether' : 'over'; }
function typeDim_(v) {
  var s = String(v == null ? '' : v);
  if (/^(over|オーバー)/i.test(s)) return 'over';
  if (/^(nether|ネザー)/i.test(s)) return 'nether';
  return 'both';
}
function size_(v) {
  var s = str_(v);
  if (/^[sml]$/.test(s)) return s;
  return { 'ちいさい': 's', 'ふつう': 'm', 'おおきい': 'l' }[s] || '';
}
function newId_(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
