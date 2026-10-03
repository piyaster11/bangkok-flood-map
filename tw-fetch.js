/* ThaiWater's API currently answers HTTP 429 to browser requests that carry a third-party Referer.
   Send no Referer to that one API (other requests, e.g. map tiles, are unaffected). */
(function () {
  var orig = window.fetch;
  window.fetch = function (input, init) {
    try {
      var u = typeof input === 'string' ? input : (input && input.url) || '';
      if (/^https:\/\/api-v3\.thaiwater\.net\//.test(u)) init = Object.assign({}, init, { referrerPolicy: 'no-referrer' });
    } catch (e) {}
    return orig.call(this, input, init);
  };
})();
