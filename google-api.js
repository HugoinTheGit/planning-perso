/* Adaptateur Gmail + Google Agenda hors Claude : même interface que le connecteur de Claude
   (callTool / invalidate) pour que la page fonctionne sans changement. Lecture seule. */
(function () {
  var TK = "planning-perso-gtoken-v1";
  var GM = "https://gmail.googleapis.com/gmail/v1/users/me";
  var CAL = "https://www.googleapis.com/calendar/v3";
  var cache = {};

  var conf = null, inflight = null;
  function readTok() {
    try {
      var o = JSON.parse(localStorage.getItem(TK) || "null");
      if (o && typeof o.t === "string" && o.exp > Date.now()) return o.t;
    } catch (e) {}
    return "";
  }
  function setToken(t, ttlMs) {
    try { localStorage.setItem(TK, JSON.stringify({ t: t, exp: Date.now() + (ttlMs || 55 * 60 * 1000) })); } catch (e) {}
  }
  function clearToken() { try { localStorage.removeItem(TK); } catch (e) {} }
  /* conf : { url, key, jwt() -> Promise<string> } ; sert à demander un jeton Google frais à la fonction google-token */
  function configure(c) { conf = c; }
  function getToken() {
    var t = readTok();
    if (t) return Promise.resolve(t);
    if (!conf) return Promise.resolve("");
    if (inflight) return inflight;
    inflight = Promise.resolve(conf.jwt()).then(function (jwt) {
      if (!jwt) return "";
      return fetch(conf.url + "/functions/v1/" + conf.fn, {
        method: "POST",
        headers: { Authorization: "Bearer " + jwt, apikey: conf.key, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "token" })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok && j.access_token) { setToken(j.access_token, Math.max(60000, ((j.expires_in || 3600) - 120) * 1000)); return j.access_token; }
          return "";
        });
      });
    }).catch(function () { return ""; }).then(function (t2) { inflight = null; return t2; });
    return inflight;
  }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  function api(url) {
    return getToken().then(function (tok) {
      if (!tok) throw err("needs_reauth");
      return fetch(url, { headers: { Authorization: "Bearer " + tok } }).then(function (r) {
      if (r.status === 401) { clearToken(); throw err("needs_reauth"); }
      if (r.status === 403) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var s = JSON.stringify(j);
          if (/insufficient|scope|accessNotConfigured|SERVICE_DISABLED/i.test(s)) throw err("consent_required");
          throw err("upstream_error");
        });
      }
      if (!r.ok) throw err("upstream_error");
      return r.json();
      }, function () { throw err("upstream_error"); });
    });
  }
  function qs(o) {
    return Object.keys(o).filter(function (k) { return o[k] !== undefined && o[k] !== ""; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&");
  }
  function b64(s) {
    try {
      var bin = atob(String(s || "").replace(/-/g, "+").replace(/_/g, "/"));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) { return ""; }
  }
  function hdr(m, name) {
    var hs = (m.payload && m.payload.headers) || [];
    for (var i = 0; i < hs.length; i++) if (String(hs[i].name).toLowerCase() === name) return String(hs[i].value || "");
    return "";
  }
  function isoOf(s) {
    if (!s) return undefined;
    var d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  /* ---- Gmail ---- */
  function threadMeta(id) {
    return api(GM + "/threads/" + encodeURIComponent(id) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date").then(function (t) {
      var ms = (t.messages || []).map(function (m) {
        return {
          id: m.id, threadId: m.threadId, labelIds: m.labelIds || [],
          date: new Date(Number(m.internalDate) || Date.now()).toISOString(),
          sender: hdr(m, "from"), subject: hdr(m, "subject"), snippet: m.snippet || ""
        };
      });
      return { id: t.id, messageCount: ms.length, viewUrl: "https://mail.google.com/mail/#all/" + t.id, messages: ms };
    }, function () { return null; });
  }
  function searchThreads(inp) {
    var u = GM + "/threads?" + qs({ q: inp.query, maxResults: Math.min(inp.pageSize || 25, 50), pageToken: inp.pageToken });
    return api(u).then(function (r) {
      var ids = (r.threads || []).map(function (t) { return t.id; });
      return Promise.all(ids.map(threadMeta)).then(function (list) {
        return { threads: list.filter(Boolean), nextPageToken: r.nextPageToken || "" };
      });
    });
  }
  function walk(part, out) {
    if (!part) return;
    var mt = String(part.mimeType || "");
    if (part.filename) out.att.push({ filename: part.filename, mimeType: mt });
    else if (part.body && part.body.data) {
      if (mt === "text/plain" && !out.text) out.text = b64(part.body.data);
      else if (mt === "text/html" && !out.html) out.html = b64(part.body.data);
    }
    (part.parts || []).forEach(function (p) { walk(p, out); });
  }
  function getThread(inp) {
    return api(GM + "/threads/" + encodeURIComponent(inp.threadId) + "?format=full").then(function (t) {
      return {
        id: t.id, messageCount: (t.messages || []).length, viewUrl: "https://mail.google.com/mail/#all/" + t.id,
        messages: (t.messages || []).map(function (m) {
          var o = { text: "", html: "", att: [] };
          walk(m.payload, o);
          return {
            id: m.id, threadId: m.threadId, labelIds: m.labelIds || [], snippet: m.snippet || "",
            date: new Date(Number(m.internalDate) || Date.now()).toISOString(),
            sender: hdr(m, "from"), subject: hdr(m, "subject"),
            toRecipients: hdr(m, "to").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (x) { return x.trim(); }).filter(Boolean),
            plaintextBody: o.text, htmlBody: o.html, attachments: o.att,
            viewUrl: "https://mail.google.com/mail/#all/" + t.id
          };
        })
      };
    });
  }

  /* ---- Agenda ---- */
  function listCalendars(inp) {
    return api(CAL + "/users/me/calendarList?" + qs({ maxResults: Math.min(inp.pageSize || 50, 250) })).then(function (r) {
      return { calendars: (r.items || []).map(function (c) { return { id: c.id, summary: c.summary || c.id, timeZone: c.timeZone }; }) };
    });
  }
  function listEvents(inp) {
    var id = inp.calendarId || "primary";
    var u = CAL + "/calendars/" + encodeURIComponent(id) + "/events?" + qs({
      timeMin: isoOf(inp.startTime), timeMax: isoOf(inp.endTime), singleEvents: "true", orderBy: "startTime",
      maxResults: Math.min(inp.pageSize || 50, 250), q: inp.fullText
    });
    return api(u).then(function (r) {
      return {
        summary: r.summary || "", timeZone: r.timeZone || "",
        events: (r.items || []).map(function (e) {
          var cu = e.hangoutLink || "";
          if (!cu && e.conferenceData && e.conferenceData.entryPoints) {
            var v = e.conferenceData.entryPoints.filter(function (p) { return p.entryPointType === "video"; })[0];
            if (v) cu = v.uri || "";
          }
          e.conferenceUrl = cu;
          return e;
        })
      };
    });
  }

  var TOOLS = {
    "Gmail": { search_threads: searchThreads, get_thread: getThread },
    "Google Calendar": { list_calendars: listCalendars, list_events: listEvents }
  };
  var mcp = {
    callTool: function (server, tool, input, opts) {
      var fn = TOOLS[server] && TOOLS[server][tool];
      if (!fn) return Promise.reject(err("upstream_error", "outil inconnu"));
      var stale = opts && opts.cache && opts.cache.staleTime ? opts.cache.staleTime : 0;
      var key = server + "|" + tool + "|" + JSON.stringify(input || {});
      var hit = cache[key];
      if (stale && hit && Date.now() - hit.t < stale) return Promise.resolve({ payload: hit.v });
      return fn(input || {}).then(function (v) {
        if (stale) cache[key] = { t: Date.now(), v: v };
        return { payload: v };
      });
    },
    invalidate: function (server, tool) {
      Object.keys(cache).forEach(function (k) { if (k.indexOf(server + "|" + (tool || "")) === 0) delete cache[k]; });
      return Promise.resolve();
    }
  };
  window.GoogleApi = { mcp: mcp, setToken: setToken, configure: configure, hasToken: function () { return !!readTok() || !!conf; }, clearToken: clearToken };
})();
