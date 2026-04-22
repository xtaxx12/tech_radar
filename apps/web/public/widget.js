/**
 * Tech Radar LATAM — Embeddable Events Widget
 *
 * Uso mínimo:
 *   <div id="tech-radar-events"></div>
 *   <script src="https://tech-radar-latam.vercel.app/widget.js"
 *           data-api-key="trk_..."
 *           data-api-url="https://tech-radar-api.onrender.com"
 *           data-country="Ecuador"
 *           data-limit="5"
 *           data-target="#tech-radar-events"></script>
 *
 * Parámetros data-*:
 *   - api-key    (requerido): tu API key emitida por Tech Radar LATAM
 *   - api-url    (opcional): default https://tech-radar-api.onrender.com
 *   - target     (opcional): selector CSS del contenedor. Si se omite, el widget
 *                            se inserta justo después del tag <script>.
 *   - country, city, source, tag, q, limit: filtros. Ver /public/docs.
 *   - theme      (opcional): "dark" (default) | "light"
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var apiKey = script.getAttribute('data-api-key');
  if (!apiKey) {
    console.warn('[tech-radar-widget] Falta data-api-key');
    return;
  }

  var apiUrl = (script.getAttribute('data-api-url') || 'https://tech-radar-api.onrender.com').replace(/\/$/, '');
  var targetSelector = script.getAttribute('data-target');
  var theme = script.getAttribute('data-theme') || 'dark';

  var params = new URLSearchParams();
  ['country', 'city', 'source', 'tag', 'q'].forEach(function (name) {
    var value = script.getAttribute('data-' + name);
    if (value) params.set(name, value);
  });
  params.set('limit', script.getAttribute('data-limit') || '5');
  params.set('upcoming', 'true');

  var host = document.createElement('div');
  host.className = 'trk-widget trk-theme-' + theme;
  if (targetSelector) {
    var target = document.querySelector(targetSelector);
    if (!target) {
      console.warn('[tech-radar-widget] target "' + targetSelector + '" no existe');
      return;
    }
    target.appendChild(host);
  } else {
    script.parentNode.insertBefore(host, script.nextSibling);
  }

  injectStyles(theme);
  host.innerHTML = '<div class="trk-loading">Cargando eventos…</div>';

  fetch(apiUrl + '/public/v1/events?' + params.toString(), {
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' }
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      renderEvents(host, data.events || [], apiUrl);
    })
    .catch(function (err) {
      host.innerHTML =
        '<div class="trk-error">No se pudieron cargar los eventos. ' + escapeHtml(err.message || '') + '</div>';
    });

  function renderEvents(root, events, baseUrl) {
    if (!events.length) {
      root.innerHTML = '<div class="trk-empty">No hay eventos próximos que coincidan con estos filtros.</div>';
      return;
    }

    var header =
      '<div class="trk-header">' +
      '<span class="trk-eyebrow">Eventos tech en LATAM</span>' +
      '<a class="trk-powered" href="https://tech-radar-latam.vercel.app" target="_blank" rel="noopener">' +
      'powered by Tech Radar LATAM</a>' +
      '</div>';

    var items = events
      .map(function (event) {
        var dateLabel = formatDate(event.date);
        var tagsHtml = (event.tags || [])
          .slice(0, 3)
          .map(function (tag) {
            return '<span class="trk-tag">' + escapeHtml(tag) + '</span>';
          })
          .join('');
        return (
          '<a class="trk-item" href="' +
          escapeAttr(event.url) +
          '" target="_blank" rel="noopener">' +
          '<div class="trk-item-top">' +
          '<span class="trk-source trk-src-' +
          escapeAttr(event.source) +
          '">' +
          escapeHtml((event.source || '').toUpperCase()) +
          '</span>' +
          '<span class="trk-date">' +
          escapeHtml(dateLabel) +
          '</span>' +
          '</div>' +
          '<div class="trk-title">' +
          escapeHtml(event.title) +
          '</div>' +
          '<div class="trk-meta">' +
          escapeHtml(event.city || '') +
          (event.city && event.country ? ', ' : '') +
          escapeHtml(event.country || '') +
          '</div>' +
          (tagsHtml ? '<div class="trk-tags">' + tagsHtml + '</div>' : '') +
          '</a>'
        );
      })
      .join('');

    root.innerHTML = header + '<div class="trk-list">' + items + '</div>';
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('es', { month: 'short', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function injectStyles(theme) {
    if (document.getElementById('trk-widget-styles')) return;
    var dark = theme !== 'light';
    var css = [
      '.trk-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; ',
      'max-width: 420px; margin: 0 auto; padding: 16px; border-radius: 18px; ',
      'background: ' + (dark ? '#0b1020' : '#f7f8fb') + '; ',
      'color: ' + (dark ? '#ffffff' : '#0b1020') + '; ',
      'border: 1px solid ' + (dark ? '#253265' : '#e5e7eb') + '; }',
      '.trk-widget * { box-sizing: border-box; }',
      '.trk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }',
      '.trk-eyebrow { font-size: 10px; letter-spacing: 0.15em; color: #7c9cff; font-weight: 700; text-transform: uppercase; }',
      '.trk-powered { font-size: 10px; color: ' + (dark ? '#8893bd' : '#6b7280') + '; text-decoration: none; }',
      '.trk-powered:hover { text-decoration: underline; }',
      '.trk-list { display: flex; flex-direction: column; gap: 10px; }',
      '.trk-item { display: block; padding: 12px; border-radius: 12px; text-decoration: none; ',
      'background: ' + (dark ? '#121a33' : '#ffffff') + '; ',
      'border: 1px solid ' + (dark ? '#253265' : '#e5e7eb') + '; ',
      'color: inherit; transition: transform 120ms ease, border-color 120ms ease; }',
      '.trk-item:hover { transform: translateY(-1px); border-color: #7c9cff; }',
      '.trk-item-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }',
      '.trk-source { font-weight: 700; letter-spacing: 0.12em; }',
      '.trk-src-gdg { color: #4285f4; }',
      '.trk-src-meetup { color: #ed1c40; }',
      '.trk-src-eventbrite { color: #f05537; }',
      '.trk-src-community { color: #7c9cff; }',
      '.trk-date { color: ' + (dark ? '#8893bd' : '#6b7280') + '; }',
      '.trk-title { font-size: 14px; font-weight: 600; line-height: 1.35; margin-bottom: 4px; }',
      '.trk-meta { font-size: 12px; color: ' + (dark ? '#8893bd' : '#6b7280') + '; margin-bottom: 8px; }',
      '.trk-tags { display: flex; flex-wrap: wrap; gap: 4px; }',
      '.trk-tag { font-size: 10px; padding: 2px 8px; border-radius: 999px; ',
      'background: ' + (dark ? '#2d3e7d' : '#eef2ff') + '; color: ' + (dark ? '#ffffff' : '#4338ca') + '; }',
      '.trk-loading, .trk-empty, .trk-error { text-align: center; padding: 24px 8px; ',
      'color: ' + (dark ? '#8893bd' : '#6b7280') + '; font-size: 13px; }',
      '.trk-error { color: #ff6363; }'
    ].join('');

    var style = document.createElement('style');
    style.id = 'trk-widget-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
