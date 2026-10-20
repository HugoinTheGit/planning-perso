/* Adaptateur Supabase : expose la même interface minimale que la base de Claude
   (collection/doc/set/delete/get/onSnapshot) pour que la page fonctionne hors Claude. */
(function () {
  var cfg = window.SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  var sb = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
  });
  var session = null;
  var listeners = [];
  function grab(s) {
    if (s && s.provider_token && window.GoogleApi) window.GoogleApi.setToken(s.provider_token);
  }
  function uid() { return session && session.user ? session.user.id : null; }
  function fail(r) { if (r && r.error) throw r.error; return r; }

  function snapDocs(rows, mapRow) {
    var docs = rows.map(function (r) { var m = mapRow(r); return { id: m.id, data: function () { return m.data; } }; });
    return { docs: docs, empty: !docs.length, metadata: { hasPendingWrites: false } };
  }

  var DAYS = {
    list: function (limit) {
      return sb.from("days").select("day,tasks,note").order("day", { ascending: false }).limit(limit || 2000).then(fail).then(function (r) {
        return snapDocs(r.data || [], function (x) { return { id: x.day, data: { taches: x.tasks || [], notes: x.note || "" } }; });
      });
    },
    set: function (id, body) {
      return sb.from("days").upsert({ user_id: uid(), day: id, tasks: body.taches || [], note: body.notes || "" }, { onConflict: "user_id,day" }).then(fail);
    },
    del: function (id) { return sb.from("days").delete().eq("day", id).then(fail); }
  };

  function settingsGet(col) {
    return sb.from("settings").select(col).maybeSingle().then(fail).then(function (r) { return r.data; });
  }
  function settingsSet(col, value) {
    var row = { user_id: uid() };
    row[col] = value;
    return sb.from("settings").upsert(row, { onConflict: "user_id" }).then(fail);
  }
  var DOCS = {
    "reglages/tags": {
      get: function () { return settingsGet("tags").then(function (d) { return d ? { exists: true, data: function () { return { liste: d.tags || [] }; } } : { exists: false, data: function () { return {}; } }; }); },
      set: function (b) { return settingsSet("tags", (b && b.liste) || []); }
    },
    "reglages/prefs": {
      get: function () { return settingsGet("prefs").then(function (d) { var has = d && d.prefs && Object.keys(d.prefs).length; return has ? { exists: true, data: function () { return d.prefs; } } : { exists: false, data: function () { return {}; } }; }); },
      set: function (b) { return settingsSet("prefs", b || {}); }
    }
  };

  /* Abonnement : lecture initiale puis relecture au retour sur l'onglet et toutes les 45 s. */
  function watch(read, cb, errCb) {
    var stopped = false, busy = false, lastSig = null;
    function tick() {
      if (stopped || busy || !uid()) return;
      busy = true;
      read().then(function (snap) {
        busy = false;
        if (stopped) return;
        var sig = JSON.stringify(snap.docs ? snap.docs.map(function (d) { return [d.id, d.data()]; }) : [snap.exists, snap.exists && snap.data()]);
        if (sig === lastSig) return;
        lastSig = sig;
        cb(snap);
      }, function (e) { busy = false; if (errCb && lastSig === null) errCb(e); });
    }
    tick();
    var iv = setInterval(tick, 45000);
    function vis() { if (document.visibilityState === "visible") tick(); }
    document.addEventListener("visibilitychange", vis);
    return function () { stopped = true; clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }

  function mkCollection(name) {
    var lim = 2000;
    var col = {
      doc: function (id) {
        return {
          set: function (b) { return name === "jours" ? DAYS.set(id, b) : Promise.resolve(); },
          delete: function () { return name === "jours" ? DAYS.del(id) : Promise.resolve(); }
        };
      },
      limit: function (n) { lim = n; return col; },
      get: function () { return name === "jours" ? DAYS.list(lim) : Promise.resolve(snapDocs([], function () {})); },
      onSnapshot: function (cb, errCb) { return watch(function () { return col.get(); }, cb, errCb); }
    };
    return col;
  }
  var db = {
    collection: mkCollection,
    doc: function (path) {
      var d = DOCS[path];
      if (!d) throw new Error("document inconnu : " + path);
      return {
        get: d.get,
        set: function (b) { return d.set(b); },
        onSnapshot: function (cb, errCb) { return watch(d.get, cb, errCb); }
      };
    }
  };

  window.PlanningCloud = {
    init: function () {
      return sb.auth.getSession().then(function (r) {
        session = r && r.data ? r.data.session : null;
        grab(session);
        sb.auth.onAuthStateChange(function (ev, s) {
          var was = uid();
          session = s;
          grab(s);
          if (uid() !== was) listeners.forEach(function (f) { try { f(ev); } catch (e) {} });
        });
        return session ? db : null;
      }, function () { return null; });
    },
    user: function () { return session && session.user ? { id: session.user.id, email: session.user.email || "" } : null; },
    onUserChange: function (f) { listeners.push(f); },
    signIn: function () {
      return sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: location.origin + location.pathname,
          scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
          queryParams: { access_type: "offline", prompt: "consent" }
        }
      });
    },
    signOut: function () {
      if (window.GoogleApi) window.GoogleApi.clearToken();
      session = null;
      var done = function () {
        try {
          Object.keys(localStorage).forEach(function (k) { if (k.indexOf("sb-") === 0 || k === "__signed") localStorage.removeItem(k); });
        } catch (e) {}
      };
      return sb.auth.signOut({ scope: "local" }).then(done, done);
    }
  };
})();
