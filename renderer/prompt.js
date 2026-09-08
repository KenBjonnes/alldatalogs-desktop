'use strict';
(function () {
  var api = window.promptApi;
  var q = api ? api.init() : { message: '', defaultValue: '' };
  var msg = document.getElementById('msg');
  var val = document.getElementById('val');
  msg.textContent = q.message || 'Enter a value:';
  val.value = q.defaultValue || '';
  var done = false;
  function submit(v) { if (done) return; done = true; if (api) api.submit(v); }
  document.getElementById('ok').addEventListener('click', function () { submit(val.value); });
  document.getElementById('cancel').addEventListener('click', function () { submit(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submit(val.value); }
    else if (e.key === 'Escape') { e.preventDefault(); submit(null); }
  });
  val.focus();
  val.select();
})();
