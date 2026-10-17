// Independent of the application bundle: keep recovery available if it cannot load.
(function () {
  function showRecovery() {
    const status = document.getElementById('startup-status');
    if (!status) return; // React has already mounted.
    status.setAttribute('role', 'alert');
    document.getElementById('startup-message').textContent = '網站暫時無法載入，請確認網路後重新載入。';
    document.getElementById('startup-reload').hidden = false;
  }
  document.getElementById('startup-reload').addEventListener('click', function () {
    window.location.reload();
  });
  window.addEventListener('error', function (event) {
    if (event.target === window || (event.target instanceof HTMLScriptElement && event.target.type === 'module')) {
      showRecovery();
    }
  }, true);
  setTimeout(showRecovery, 15000);
}());
