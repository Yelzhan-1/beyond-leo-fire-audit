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
  var H = 548;

  var STATUS = {
    breaks: { text: '#FF8F6B', bg: '#3A1810' },
    weakens: { text: '#F5B84A', bg: '#2A2110' },
    unknown: { text: '#C5D0E0', bg: '#1A2233' },
    holds: { text: '#2FD89A', bg: '#0F2A21' }
  };

  function fmtG(g) {
    if (g == null || !isFinite(g)) return '';
    return g < 0.01 ? '0 g' : (Math.round(g * 100) / 100) + ' g';
  }

  function fmtP(p) {
    if (p == null || !isFinite(p)) return '';
    return (Math.round(p * 10) / 10).toFixed(1) + ' kPa';
  }

  function fmtO2(o2) {
    if (o2 == null || !isFinite(o2)) return '';
    var s = o2 % 1 ? o2.toFixed(1) : String(Math.round(o2));
    return s + '% O\u2082';
  }

  function scenarioLineFromEnv(env) {
    if (!env || typeof env.g !== 'number') return '';
    return fmtG(env.g) + ' · ' + fmtP(env.p) + ' · ' + fmtO2(env.o2);
  }

  function buildReportCardModel(audit, env, meta) {
    if (!audit || !env) return null;
    var sum = audit.summary(env);
    var rows = (audit.ROWS || []).map(function (r, idx) {
      var v = audit.evaluate(r.id, env);
      var num = 'R' + (idx < 9 ? '0' : '') + (idx + 1);
      return { id: r.id, num: num, short: r.short, status: v.status, label: audit.STATUS[v.status].label };
    });
    var m = meta || {};
    return {
      title: 'Beyond LEO Fire Audit',
      scenario: {
        dest: m.dest || '',
        envId: m.envId || env.id,
        subtitle: m.subtitle || env.name,
        line: m.scenarioLine || scenarioLineFromEnv(env),
        g: env.g,
        p: env.p,
        o2: env.o2
      },
      counts: sum.counts,
      rules: rows,
      siteUrl: m.siteUrl || 'https://blfa-wip.vercel.app',
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

  function drawFlameGlyph(ctx, x, y, scale) {
    var s = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#E85D04';
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.bezierCurveTo(17.2, 8.6, 23, 12.2, 23, 18.2);
    ctx.bezierCurveTo(23, 22, 17, 26, 9, 22.2);
    ctx.bezierCurveTo(9, 18.6, 11.4, 16.6, 12.6, 13.4);
    ctx.bezierCurveTo(14.2, 14.8, 14.8, 16.2, 15, 17.6);
    ctx.bezierCurveTo(16.4, 15.4, 16.6, 11.4, 16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFC55C';
    ctx.beginPath();
    ctx.moveTo(16, 17.4);
    ctx.bezierCurveTo(16.7, 19.4, 19, 20.6, 19, 22.8);
    ctx.arc(16, 22.8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPill(ctx, x, y, text, status) {
    var pal = STATUS[status] || STATUS.unknown;
    ctx.font = '600 16px "IBM Plex Mono", monospace';
    var tw = ctx.measureText(text).width;
    var padX = 14;
    var w = tw + padX * 2;
    var h = 32;
    roundRect(ctx, x, y - h + 8, w, h, 16);
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.fillStyle = pal.text;
    ctx.fillText(text, x + padX, y);
    return w + 10;
  }

  function drawReportCard(canvas, model, theme) {
    if (!canvas || !model) return false;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    canvas.width = W;
    canvas.height = H;
    var dark = !theme || theme === 'dark';
    var bg = dark ? '#0B0E14' : '#F5F0E8';
    var text = dark ? '#EDF0F5' : '#1A1F2E';
    var muted = dark ? '#B8C0CE' : '#5A6578';
    var surface = dark ? '#141A24' : '#FFFFFF';
    var borderColor = dark ? '#2E3A4F' : '#D8D0C4';
    var marginL = 56;
    var gapText = 8;
    var gapBeforePills = 16;
    var titleSize = 34;
    var subtitleSize = 19;
    var scenarioSize = 17;
    var flameScale = 1.22;
    var flameW = 32 * flameScale;
    var textX = marginL + Math.round(flameW) + 16;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var titleBaseline = 52;
    var subtitleBaseline = titleBaseline + gapText + Math.round(subtitleSize * 0.82);
    var scenarioBaseline = subtitleBaseline + gapText + Math.round(scenarioSize * 0.82);
    var pillBaseline = scenarioBaseline + gapBeforePills + 26;
    var headerTop = titleBaseline - Math.round(titleSize * 0.78);
    var headerBottom = subtitleBaseline;
    var flameCenterY = (headerTop + headerBottom) / 2;
    var flameTopY = flameCenterY - (14 * flameScale);
    drawFlameGlyph(ctx, marginL, flameTopY, flameScale);

    ctx.fillStyle = text;
    ctx.font = '700 ' + titleSize + 'px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(model.title, textX, titleBaseline);

    ctx.fillStyle = muted;
    ctx.font = '500 ' + subtitleSize + 'px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(model.scenario.subtitle, textX, subtitleBaseline);

    var scenarioLine = model.scenario.line || scenarioLineFromEnv(model.scenario);
    if (scenarioLine) {
      ctx.fillStyle = dark ? '#B8C0CE' : '#5A6578';
      ctx.font = '500 ' + scenarioSize + 'px "IBM Plex Mono", monospace';
      ctx.fillText(scenarioLine, textX, scenarioBaseline);
    }

    var cx = marginL;
    var cy = pillBaseline;
    var keys = ['breaks', 'weakens', 'unknown', 'holds'];
    var c = model.counts;
    keys.forEach(function (k) {
      if (!c[k]) return;
      var word = countLine({ breaks: k === 'breaks' ? c[k] : 0, weakens: k === 'weakens' ? c[k] : 0, unknown: k === 'unknown' ? c[k] : 0, holds: k === 'holds' ? c[k] : 0 });
      cx += drawPill(ctx, cx, cy, word, k);
    });

    var rowH = 40;
    var gap = 8;
    var y0 = pillBaseline + 38;
    var colW = (W - 112 - 16) / 2;
    model.rules.forEach(function (r, i) {
      var col = i < 5 ? 0 : 1;
      var row = i % 5;
      var x = 56 + col * (colW + 16);
      var y = y0 + row * (rowH + gap);
      ctx.fillStyle = surface;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, colW, rowH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.font = '600 14px "IBM Plex Mono", monospace';
      ctx.fillText(r.num, x + 12, y + 22);
      ctx.fillStyle = text;
      ctx.font = '500 16px "Space Grotesk", system-ui, sans-serif';
      var short = r.short.length > 36 ? r.short.slice(0, 34) + '…' : r.short;
      ctx.fillText(short, x + 54, y + 22);
      var pal = STATUS[r.status] || STATUS.unknown;
      ctx.fillStyle = pal.text;
      ctx.font = '700 14px "IBM Plex Mono", monospace';
      var lw = ctx.measureText(r.label).width;
      ctx.fillText(r.label, x + colW - 14 - lw, y + 22);
    });

    var lastRuleBottom = y0 + 4 * (rowH + gap) + rowH;
    var footY = Math.max(lastRuleBottom + 16, H - 72);
    ctx.fillStyle = dark ? '#10151C' : '#E8E2D8';
    ctx.fillRect(0, footY, W, H - footY);
    ctx.strokeStyle = borderColor;
    ctx.beginPath();
    ctx.moveTo(0, footY);
    ctx.lineTo(W, footY);
    ctx.stroke();

    var site = model.siteUrl.replace(/^https?:\/\//, '');
    ctx.fillStyle = text;
    ctx.font = '600 18px "IBM Plex Mono", monospace';
    ctx.fillText(site, 56, footY + 32);
    ctx.fillStyle = muted;
    ctx.font = '400 15px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(model.footer, 56, footY + 58);
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