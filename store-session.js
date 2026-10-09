/* ==========================================================
   PUNTOS DE VENTA (multi-local)
   Compartido por admin.html, index.html y led.html (y la app LED,
   que lo empaqueta junto a led.html).

   Cada local tiene su propio arbol en la Realtime Database:
     storeList/{storeId}: { name, createdAt }   indice para los selectores
     stores/{storeId}/screens/{screenId}/...    content | config | led
   y los permisos salen de la cuenta:
     users/{uid}: { role, stores: { pv1: true }, profile: { email, lastLogin } }

   Roles: superadmin (todos los locales), manager (edita sus locales),
   player (solo lectura: las cuentas de los TV y carteles LED).
   El aislamiento real lo hacen las reglas (database.rules.json); esto
   solo resuelve que local mostrar.
   ========================================================== */
(function (global) {
  'use strict';

  var ROLE_LABELS = {
    superadmin: 'Administrador general',
    manager: 'Encargado',
    player: 'Reproductor'
  };

  var LAST_STORE_PREFIX = 'hp_store_';

  // Unico lugar que arma rutas de un local: path('pv1', 'screens', 'default', 'led')
  function path(storeId) {
    var parts = ['stores', storeId];
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== '') parts.push(arguments[i]);
    }
    return parts.join('/');
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
  }

  // Lee rol y locales de la cuenta. El perfil (email, ultimo ingreso) lo
  // escribe el propio usuario: asi el superadmin ve las cuentas nuevas en
  // "Accesos" sin tener que copiar UIDs desde la consola de Firebase.
  function resolve(db, user) {
    db.ref('users/' + user.uid + '/profile').update({
      email: user.email || '',
      lastLogin: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () { /* sin reglas publicadas todavia: no bloquea */ });

    return Promise.all([
      db.ref('users/' + user.uid).once('value'),
      db.ref('storeList').once('value')
    ]).then(function (res) {
      var u = res[0].val() || {};
      var list = res[1].val() || {};
      var role = ROLE_LABELS[u.role] ? u.role : null;
      var isSuper = role === 'superadmin';
      var assigned = u.stores || {};

      var stores = Object.keys(list)
        .filter(function (id) { return isSuper || assigned[id] === true; })
        .map(function (id) { return { id: id, name: (list[id] && list[id].name) || id }; })
        .sort(byName);

      return {
        uid: user.uid,
        email: user.email || '',
        role: role,
        isSuper: isSuper,
        canEdit: isSuper || role === 'manager',
        stores: stores,
        allStores: list
      };
    });
  }

  function findStore(ctx, id) {
    if (!ctx || !id) return null;
    for (var i = 0; i < ctx.stores.length; i++) {
      if (ctx.stores[i].id === id) return ctx.stores[i];
    }
    return null;
  }

  // Elige el local: el preferido si la cuenta lo tiene, si no el ultimo usado,
  // si no el unico. Con varios y ninguno recordado devuelve null (hay que preguntar).
  function pick(ctx, preferred) {
    if (findStore(ctx, preferred)) return preferred;
    var last = recall(ctx.uid);
    if (findStore(ctx, last)) return last;
    if (ctx.stores.length === 1) return ctx.stores[0].id;
    return null;
  }

  function remember(uid, storeId) {
    try { localStorage.setItem(LAST_STORE_PREFIX + uid, storeId); } catch (e) { /* silenciar */ }
  }

  function recall(uid) {
    try { return localStorage.getItem(LAST_STORE_PREFIX + uid); } catch (e) { return null; }
  }

  function forget(uid) {
    try { localStorage.removeItem(LAST_STORE_PREFIX + uid); } catch (e) { /* silenciar */ }
  }

  /* ----------------------------------------------------------
     Overlays de los reproductores (index.html y led.html)
     Estilo propio, oscuro, igual en los dos: el admin usa los suyos.
     ---------------------------------------------------------- */
  var CSS =
    '.hp-store-overlay{position:fixed;inset:0;z-index:950;display:flex;align-items:center;justify-content:center;' +
      'padding:16px;background:#0B0B0C;color:#F6F5F3;cursor:auto;overflow-y:auto;' +
      'font-family:Manrope,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.hp-store-box{width:100%;max-width:420px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);' +
      'border-radius:16px;padding:2.4rem 2.2rem}' +
    '.hp-store-logo{font-size:1.5rem;font-weight:700;letter-spacing:-0.02em;margin-bottom:.3em}' +
    '.hp-store-logo span{color:#50d753}' +
    '.hp-store-eyebrow{font-size:.7rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;' +
      'color:rgba(246,245,243,0.52);margin-bottom:1.8rem}' +
    '.hp-store-title{font-size:1.05rem;font-weight:700;margin-bottom:.35em}' +
    '.hp-store-text{font-size:.85rem;line-height:1.5;color:rgba(246,245,243,0.6);margin-bottom:1.4rem}' +
    '.hp-store-list{display:grid;gap:10px}' +
    '.hp-store-item{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;text-align:left;' +
      'background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:inherit;' +
      'font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;transition:border-color .15s}' +
    '.hp-store-item:hover,.hp-store-item:focus-visible{border-color:#50d753;outline:none}' +
    '.hp-store-item .dot{width:8px;height:8px;border-radius:50%;background:#50d753;opacity:.7;flex:none}' +
    '.hp-store-item .tag{margin-left:auto;font-size:.7rem;font-weight:600;color:#50d753}' +
    '.hp-store-meta{margin-top:1.4rem;font:12px/1.6 Consolas,ui-monospace,monospace;color:rgba(246,245,243,0.35);word-break:break-all}' +
    '.hp-store-btn{margin-top:1.2rem;padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);' +
      'background:transparent;color:rgba(246,245,243,0.8);font:inherit;font-size:.85rem;cursor:pointer}' +
    '.hp-store-btn:hover{border-color:#50d753;color:#50d753}';

  var overlayEl = null;

  function ensureOverlay() {
    if (!document.getElementById('hp-store-css')) {
      var style = document.createElement('style');
      style.id = 'hp-store-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'hp-store-overlay';
      document.body.appendChild(overlayEl);
    }
    overlayEl.style.display = 'flex';
    return overlayEl;
  }

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function boxHtml(eyebrow, inner) {
    return '<div class="hp-store-box">' +
      '<div class="hp-store-logo">Home<span>Point</span></div>' +
      '<div class="hp-store-eyebrow">' + esc(eyebrow) + '</div>' + inner + '</div>';
  }

  // Seleccion de local para cuentas con acceso a varios (superadmin probando)
  function showPicker(opts) {
    var el = ensureOverlay();
    el.innerHTML = boxHtml(opts.eyebrow || 'Punto de venta',
      '<div class="hp-store-title">¿Qué punto de venta mostrar?</div>' +
      '<div class="hp-store-text">Tu cuenta tiene acceso a varios locales. La elección se recuerda en este equipo.</div>' +
      '<div class="hp-store-list"></div>' +
      (opts.onLogout ? '<button type="button" class="hp-store-btn">Cerrar sesión</button>' : ''));
    var list = el.querySelector('.hp-store-list');
    var logout = el.querySelector('.hp-store-btn');
    if (logout) logout.addEventListener('click', function () { hideOverlay(); opts.onLogout(); });
    opts.stores.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hp-store-item';
      b.innerHTML = '<span class="dot"></span>' + esc(s.name) +
        (s.id === opts.current ? '<span class="tag">Actual</span>' : '');
      b.addEventListener('click', function () { hideOverlay(); opts.onPick(s.id); });
      list.appendChild(b);
    });
    if (list.firstChild) list.firstChild.focus();
  }

  // Cuenta sin local asignado: se muestra el UID para poder habilitarla
  function showGate(opts) {
    var el = ensureOverlay();
    el.innerHTML = boxHtml(opts.eyebrow || 'Punto de venta',
      '<div class="hp-store-title">' + esc(opts.title) + '</div>' +
      '<div class="hp-store-text">' + esc(opts.message) + '</div>' +
      '<div class="hp-store-meta">' + esc(opts.email || '') + (opts.uid ? '<br>UID: ' + esc(opts.uid) : '') + '</div>' +
      (opts.onLogout ? '<button type="button" class="hp-store-btn">Cerrar sesión</button>' : ''));
    var btn = el.querySelector('.hp-store-btn');
    if (btn) btn.addEventListener('click', function () { hideOverlay(); opts.onLogout(); });
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.style.display = 'none';
  }

  global.StoreSession = {
    ROLE_LABELS: ROLE_LABELS,
    path: path,
    resolve: resolve,
    pick: pick,
    findStore: findStore,
    remember: remember,
    recall: recall,
    forget: forget,
    showPicker: showPicker,
    showGate: showGate,
    hideOverlay: hideOverlay
  };
})(window);
