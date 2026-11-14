/* Report card data model and canvas render (no DOM). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BLFA_REPORT = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var W = 1200;
  var H = 630;

  var STATUS_COLORS = {
    breaks: '#E85D04',
    weakens: '#D4A017',
    unknown: '#8B9CB3',
    holds: '#3D9A6A'
  };

  function buildReportCardModel(audit, env, meta) {
    if (!audit || !env) return null;
    var sum = audit.summary(env);
    var rows = (audit.ROWS || []).map(function (r, idx) {
      var v = audit.evaluate(r.id, env);
      var num = 'R' + (idx < 9 ? '0' : '') + (idx + 1);
      return { id: r.id, num: num, short: r.short, status: v.status, label: audit.STATUS[v.status].label };
    });
    return {
      title: 'Beyond LEO Fire Audit',
      scenario: {
        dest: meta && meta.dest ? meta.dest : '',
        envId: meta && meta.envId ? meta.envId : env.id,
        subtitle: meta && meta.subtitle ? meta.subtitle : env.name,
        g: env.g,
        p: env.p,
        o2: env.o2
      },
      counts: sum.counts,
      rules: rows,
      siteUrl: meta && meta.siteUrl ? meta.siteUrl : 'beyond-leo-fire-audit',
      footer: 'Data: NASA PSI / FLEX (CC0) · Beyond LEO Fire Audit · NASA Space Apps 2026'
    };
  }

  function countLine(counts) {
    var parts = [];
    if (counts.breaks) parts.push(counts.breaks + ' break' + (counts.breaks === 1 ? '' : 's'));
    if (counts.weakens) parts.push(counts.weakens + ' weaken' + (counts.weakens === 1 ? '' : 's'));
    if (counts.unknown) parts.push(counts.unknown + ' unknown');
    if (counts.holds) parts.push(counts.holds + ' hold' + (counts.holds === 1 ? '' : 's'));
    return parts.join(' · ');
  }

  function drawReportCard(canvas, model, theme) {
    if (!canvas || !model) return false;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    canvas.width = W;
    canvas.height = H;
    var dark = !theme || theme === 'dark';
    var bg = dark ? '#0B0E14' : '#F5F0E8';
    var text = dark ? '#E8ECF4' : '#1A1F2E';
    var muted = dark ? '#9AA8BC' : '#5A6578';
    var surface = dark ? '#141A24' : '#FFFFFF';
    var brand = '#E85D04';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = brand;
    ctx.beginPath();
    ctx.moveTo(56, 92);
    ctx.bezierCurveTo(62, 118, 98, 128, 98, 152);
    ctx.bezierCurveTo(98, 168, 78, 178, 56, 178);
    ctx.bezierCurveTo(56, 164, 66, 154, 72, 142);
    ctx.bezierCurveTo(78, 148, 80, 154, 81, 160);
    ctx.bezierCurveTo(84, 150, 84, 132, 81, 118);
  ctx.closePath();
    ctx.fill();

    ctx.fillStyle = text;
    ctx.font = '600 36px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(model.title, 120, 88);

    ctx.fillStyle = muted;
    ctx.font = '500 22px "IBM Plex Mono", monospace';
    ctx.fillText(model.scenario.subtitle, 56, 148);

    ctx.fillStyle = surface;
    ctx.strokeStyle = dark ? '#2A3444' : '#D8D0C4';
    ctx.lineWidth = 2;
    roundRect(ctx, 56, 178, W - 112, 56, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = text;
    ctx.font = '600 20px "IBM Plex Mono", monospace';
    ctx.fillText(countLine(model.counts), 72, 214);

    var rowH = 24;
    var gap = 5;
    var colW = (W - 112 - 12) / 2;
    model.rules.forEach(function (r, i) {
      var col = i < 5 ? 0 : 1;
      var row = i % 5;
      var x = 56 + col * (colW + 12);
      var y = 248 + row * (rowH + gap);
      ctx.fillStyle = surface;
      roundRect(ctx, x, y, colW, rowH, 6);
      ctx.fill();
      ctx.fillStyle = muted;
      ctx.font = '500 14px "IBM Plex Mono", monospace';
      ctx.fillText(r.num, x + 12, y + 16);
      ctx.fillStyle = text;
      ctx.font = '500 15px "Space Grotesk", system-ui, sans-serif';
      var short = r.short.length > 28 ? r.short.slice(0, 26) + '…' : r.short;
      ctx.fillText(short, x + 52, y + 16);
      var colColor = STATUS_COLORS[r.status] || muted;
      ctx.fillStyle = colColor;
      ctx.font = '600 13px "IBM Plex Mono", monospace';
      var lw = ctx.measureText(r.label).width;
      ctx.fillText(r.label, x + colW - 12 - lw, y + 16);
    });

    ctx.fillStyle = muted;
    ctx.font = '400 15px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(model.siteUrl, 56, H - 48);
    ctx.font = '400 14px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(model.footer, 56, H - 24);
    return true;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function downloadReportPng(canvas, filename) {
    return new Promise(function (resolve, reject) {
      if (!canvas || !canvas.toBlob) {
        reject(new Error('Canvas export unavailable'));
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('PNG encode failed'));
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename || 'beyond-leo-fire-audit-report.png';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        resolve(blob);
      }, 'image/png');
    });
  }

  return {
    REPORT_W: W,
    REPORT_H: H,
    buildReportCardModel: buildReportCardModel,
    countLine: countLine,
    drawReportCard: drawReportCard,
    downloadReportPng: downloadReportPng
  };
});