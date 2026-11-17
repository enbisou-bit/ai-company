'use strict';
// shared/carouselPresentation.js
// Decision 130 / 129：見せ方の指定（太字の範囲・手順番号）の検査（純関数・描画も I/O もしない）。
//   carouselImageCore（描画の前）と saveHumanRevision（保存の前）が同じ検査を使うために、ここへ置く。
//
//   指定の形: { presentationVersion: 1, copySha256, slides: [{ index, stepMarkers?, emphasis?: [{ line, text }] }] }
//   ・本文の hash に束縛する：copySha256 が、その Draft の文案の hash と一致すること
//   ・手順番号は、役割が steps の枚だけ（数量・回数の数字は本文側の検査の対象のまま）
//   ・太字は本文中の文字列で指定し、その行に 1 回だけ現れること。限定語を含む行は、限定語を太字の範囲に含めること
//   ・本文の文字は足さない・変えない

var PRESENTATION_LIMITERS = Object.freeze(['ことがある', 'こともある', '場合', 'あれば', 'なければ', 'たら', 'など', 'とどめる', 'ほど', 'ことが多い']);
var SLIDE_KEYS = Object.freeze(['index', 'stepMarkers', 'emphasis']);

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// input: { presentation, boundCopySha256, slideLines: [[本文の行...], ...]（枚ごと）, slideRoles: [...] }
// 戻り値: { ok, errors[], bySlide: { [index]: { stepMarkers?, emphasis?: [[{start,end}], ...] } } }
function validatePresentation(input) {
  var o = _isPlainObject(input) ? input : {};
  var p = o.presentation;
  if (p === undefined || p === null) return { ok: true, errors: [], bySlide: {} };
  var errs = [];
  if (!_isPlainObject(p) || p.presentationVersion !== 1) return { ok: false, errors: ['presentation_version'], bySlide: {} };
  var bound = typeof o.boundCopySha256 === 'string' ? o.boundCopySha256 : null;
  if (!bound || p.copySha256 !== bound) errs.push('presentation_unbound_to_copy_hash');
  if (!Array.isArray(p.slides)) return { ok: false, errors: errs.concat(['presentation_slides']), bySlide: {} };
  var slideLines = Array.isArray(o.slideLines) ? o.slideLines : [];
  var roles = Array.isArray(o.slideRoles) ? o.slideRoles : [];
  var bySlide = {};
  p.slides.forEach(function (s, si) {
    var sp = 'slides[' + si + ']';
    if (!_isPlainObject(s) || !Number.isInteger(s.index) || s.index < 1 || s.index > slideLines.length) { errs.push(sp + '.index'); return; }
    if (Object.keys(s).some(function (k) { return SLIDE_KEYS.indexOf(k) === -1; })) errs.push(sp + '.unknown_fields');
    if (bySlide[s.index]) { errs.push(sp + '.duplicate'); return; }
    var lines = Array.isArray(slideLines[s.index - 1]) ? slideLines[s.index - 1] : [];
    var out = {};
    if (s.stepMarkers !== undefined && typeof s.stepMarkers !== 'boolean') errs.push(sp + '.stepMarkers');
    if (s.stepMarkers === true) {
      if (roles[s.index - 1] !== 'steps') errs.push(sp + '.stepMarkers_only_on_steps_role');
      else out.stepMarkers = true;
    }
    if (s.emphasis !== undefined) {
      if (!Array.isArray(s.emphasis)) { errs.push(sp + '.emphasis'); return; }
      var ranges = lines.map(function () { return []; });
      s.emphasis.forEach(function (e, ei) {
        var ep = sp + '.emphasis[' + ei + ']';
        if (!_isPlainObject(e) || !Number.isInteger(e.line) || e.line < 0 || e.line >= lines.length || typeof e.text !== 'string' || !e.text) { errs.push(ep); return; }
        var line = lines[e.line];
        var at = line.indexOf(e.text);
        if (at === -1) { errs.push(ep + '.not_in_line'); return; }
        if (line.indexOf(e.text, at + 1) !== -1) { errs.push(ep + '.ambiguous'); return; }
        PRESENTATION_LIMITERS.forEach(function (lm) { if (line.indexOf(lm) !== -1 && e.text.indexOf(lm) === -1) errs.push(ep + '.limiter_outside:' + lm); });
        var start = Array.from(line.slice(0, at)).length;
        ranges[e.line].push({ start: start, end: start + Array.from(e.text).length });
      });
      out.emphasis = ranges;
    }
    bySlide[s.index] = out;
  });
  return errs.length ? { ok: false, errors: errs, bySlide: {} } : { ok: true, errors: [], bySlide: bySlide };
}

module.exports = { PRESENTATION_LIMITERS: PRESENTATION_LIMITERS, validatePresentation: validatePresentation };
