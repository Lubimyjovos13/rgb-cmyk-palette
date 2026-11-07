/* ============================================================
   RGB & CMYK — интерактивная палитра
   Смешение в диаграммах считается «по-настоящему»:
   RGB  — сложение света (аддитивно, как на экране);
   CMYK — умножение красок (субтрактивно, как на бумаге).
   ============================================================ */

(function () {
    "use strict";

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0").toUpperCase();

    /* ------------------------- Вкладки ------------------------- */
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const panels = Array.from(document.querySelectorAll(".panel"));

    function activateTab(key) {
        tabs.forEach((t) => {
            const on = t.dataset.tab === key;
            t.classList.toggle("active", on);
            t.setAttribute("aria-selected", String(on));
        });
        panels.forEach((p) => {
            const on = p.id === key + "-panel";
            p.classList.toggle("active", on);
            p.hidden = !on;
        });
        // canvas нельзя рисовать, пока элемент скрыт (нулевые размеры)
        if (key === "rgb") drawVenn("rgb");
        else drawVenn("cmyk");
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => activateTab(tab.dataset.tab));
        // навигация стрелками внутри группы вкладок
        tab.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = tabs.indexOf(tab);
            const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
            next.focus();
            activateTab(next.dataset.tab);
        });
    });

    /* ------------------------ Состояние ------------------------ */
    const rgb = { r: 230, g: 255, b: 255 };
    const cmyk = { c: 0, m: 0, y: 0, k: 0 };

    /* ------------------ Пересчёт между моделями ------------------ */
    function rgbToCmyk(r, g, b) {
        const rr = r / 255, gg = g / 255, bb = b / 255;
        const k = 1 - Math.max(rr, gg, bb);
        if (k >= 1 - 1e-9) return { c: 0, m: 0, y: 0, k: 100 };
        return {
            c: Math.round(((1 - rr - k) / (1 - k)) * 100),
            m: Math.round(((1 - gg - k) / (1 - k)) * 100),
            y: Math.round(((1 - bb - k) / (1 - k)) * 100),
            k: Math.round(k * 100),
        };
    }

    // Классическая (не ICC) формула — та же, что в большинстве веб-конвертеров
    function cmykToRgb(c, m, y, k) {
        const f = (v) => 1 - v / 100;
        return {
            r: Math.round(255 * f(c) * f(k)),
            g: Math.round(255 * f(m) * f(k)),
            b: Math.round(255 * f(y) * f(k)),
        };
    }

    /* ============================ RGB ============================ */
    const rgbUI = {
        r: { slider: document.getElementById("r-slider"), input: document.getElementById("r-value"), bar: document.getElementById("r-bar") },
        g: { slider: document.getElementById("g-slider"), input: document.getElementById("g-value"), bar: document.getElementById("g-bar") },
        b: { slider: document.getElementById("b-slider"), input: document.getElementById("b-value"), bar: document.getElementById("b-bar") },
    };
    const rgbPreview = document.getElementById("rgb-preview");
    const rgbHexEl = document.getElementById("rgb-hex");
    const rgbCodeEl = document.getElementById("rgb-code");
    const rgbCrossEl = document.getElementById("rgb-cross");

    function renderRGB() {
        const { r, g, b } = rgb;

        ["r", "g", "b"].forEach((key) => {
            const ui = rgbUI[key];
            if (ui.slider.value !== String(rgb[key])) ui.slider.value = rgb[key];
            if (ui.input.value !== String(rgb[key])) ui.input.value = rgb[key];
            ui.bar.style.width = (rgb[key] / 255) * 100 + "%";
        });

        const css = `rgb(${r}, ${g}, ${b})`;
        rgbPreview.style.backgroundColor = css;
        rgbHexEl.textContent = "#" + toHex(r) + toHex(g) + toHex(b);
        rgbCodeEl.textContent = css;

        const alt = rgbToCmyk(r, g, b);
        rgbCrossEl.textContent = `= cmyk(${alt.c}%, ${alt.m}%, ${alt.y}%, ${alt.k}%)`;

        drawVenn("rgb");
    }

    function bindRGB(key) {
        const { slider, input } = rgbUI[key];

        slider.addEventListener("input", () => {
            rgb[key] = clamp(Number(slider.value), 0, 255);
            renderRGB();
        });

        input.addEventListener("input", () => {
            const raw = Number(input.value);
            if (input.value === "" || Number.isNaN(raw)) return;
            rgb[key] = clamp(Math.round(raw), 0, 255);
            renderRGB();
        });

        input.addEventListener("blur", () => {
            const raw = Number(input.value);
            rgb[key] = clamp(Number.isFinite(raw) ? Math.round(raw) : 0, 0, 255);
            renderRGB();
        });
    }

    ["r", "g", "b"].forEach(bindRGB);

    document.querySelectorAll("#rgb-presets .preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            rgb.r = Number(btn.dataset.r);
            rgb.g = Number(btn.dataset.g);
            rgb.b = Number(btn.dataset.b);
            renderRGB();
        });
    });

    /* ============================ CMYK ============================ */
    const cmykUI = {
        c: { slider: document.getElementById("c-slider"), input: document.getElementById("c-value"), bar: document.getElementById("c-bar") },
        m: { slider: document.getElementById("m-slider"), input: document.getElementById("m-value"), bar: document.getElementById("m-bar") },
        y: { slider: document.getElementById("y-slider"), input: document.getElementById("y-value"), bar: document.getElementById("y-bar") },
        k: { slider: document.getElementById("k-slider"), input: document.getElementById("k-value"), bar: document.getElementById("k-bar") },
    };
    const cmykPreview = document.getElementById("cmyk-preview");
    const cmykHexEl = document.getElementById("cmyk-hex");
    const cmykCodeEl = document.getElementById("cmyk-code");
    const cmykCrossEl = document.getElementById("cmyk-cross");

    // Цвета красок для схемы. Берём чистые субтрактивные первичные:
    // именно с ними умножение даёт ровно те же значения, что формула
    // cmykToRgb, — поэтому центр диаграммы совпадает с превью.
    const INK = {
        c: [0, 255, 255],
        m: [255, 0, 255],
        y: [255, 255, 0],
    };

    function renderCMYK() {
        const { c, m, y, k } = cmyk;

        ["c", "m", "y", "k"].forEach((key) => {
            const ui = cmykUI[key];
            if (ui.slider.value !== String(cmyk[key])) ui.slider.value = cmyk[key];
            if (ui.input.value !== String(cmyk[key])) ui.input.value = cmyk[key];
            ui.bar.style.width = cmyk[key] + "%";
        });

        const out = cmykToRgb(c, m, y, k);
        const css = `rgb(${out.r}, ${out.g}, ${out.b})`;

        cmykPreview.style.backgroundColor = css;
        cmykHexEl.textContent = "#" + toHex(out.r) + toHex(out.g) + toHex(out.b);
        cmykCodeEl.textContent = `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;
        cmykCrossEl.textContent = `= rgb(${out.r}, ${out.g}, ${out.b})`;

        // Ползунок каждой краски: от белой бумаги к собственному цвету краски
        ["c", "m", "y"].forEach((key) => {
            const [r, g, b] = INK[key];
            const track = document.getElementById(key + "-track");
            if (track) {
                track.style.background =
                    `linear-gradient(to right, #fdfdfd, rgb(${r}, ${g}, ${b}))`;
            }
        });

        drawVenn("cmyk");
    }

    function bindCMYK(key) {
        const { slider, input } = cmykUI[key];

        slider.addEventListener("input", () => {
            cmyk[key] = clamp(Number(slider.value), 0, 100);
            renderCMYK();
        });

        input.addEventListener("input", () => {
            const raw = Number(input.value);
            if (input.value === "" || Number.isNaN(raw)) return;
            cmyk[key] = clamp(Math.round(raw), 0, 100);
            renderCMYK();
        });

        input.addEventListener("blur", () => {
            const raw = Number(input.value);
            cmyk[key] = clamp(Number.isFinite(raw) ? Math.round(raw) : 0, 0, 100);
            renderCMYK();
        });
    }

    ["c", "m", "y", "k"].forEach(bindCMYK);

    document.querySelectorAll("#cmyk-presets .preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            cmyk.c = Number(btn.dataset.c);
            cmyk.m = Number(btn.dataset.m);
            cmyk.y = Number(btn.dataset.y);
            cmyk.k = Number(btn.dataset.k);
            renderCMYK();
        });
    });

    /* ========================= Диаграммы ========================= */
    const W = 280, H = 250, R = 74;
    const POS = {
        top:  { x: 140, y: 96 },
        left: { x: 104, y: 168 },
        right:{ x: 176, y: 168 },
    };

    function prepareCanvas(id) {
        const canvas = document.getElementById(id);
        if (!canvas) return null;
        const ctx = canvas.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        if (canvas.width !== Math.round(W * dpr)) {
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        return ctx;
    }

    function ring(ctx, cx, cy, r) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }

    function drawVenn(model) {
        const ctx = prepareCanvas(model === "rgb" ? "rgb-venn" : "cmyk-venn");
        if (!ctx) return;

        if (model === "rgb") {
            /* ---------- RGB: свет складывается ----------
               Фон — чистый чёрный (нет света). Каждый круг залит
               чистым первичным цветом с прозрачностью, равной
               интенсивности канала, а режим "lighter" складывает
               свет. Итог в центре = ровно rgb(r, g, b).           */
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, W, H);

            const circles = [
                { a: rgb.r / 255, color: "255,0,0",     pos: POS.top,   label: "R" },
                { a: rgb.g / 255, color: "0,255,0",     pos: POS.left,  label: "G" },
                { a: rgb.b / 255, color: "0,0,255",     pos: POS.right, label: "B" },
            ];

            ctx.globalCompositeOperation = "lighter";
            circles.forEach((c) => {
                if (c.a <= 0) return;
                ctx.fillStyle = `rgba(${c.color}, ${c.a})`;
                ring(ctx, c.pos.x, c.pos.y, R);
                ctx.fill();
            });
            ctx.globalCompositeOperation = "source-over";

            // Обводка видна даже когда канал выключен
            circles.forEach((c) => {
                ctx.strokeStyle = `rgba(${c.color}, ${0.2 + c.a * 0.6})`;
                ctx.lineWidth = c.a > 0 ? 1.5 : 1.2;
                if (c.a <= 0) ctx.setLineDash([4, 4]);
                ring(ctx, c.pos.x, c.pos.y, R);
                ctx.stroke();
                ctx.setLineDash([]);
            });

            ctx.font = "700 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            circles.forEach((c) => {
                ctx.fillStyle = `rgba(255,255,255,${c.a > 0 ? 0.9 : 0.45})`;
                const dx = c.pos === POS.top ? 0 : (c.pos === POS.left ? -R + 16 : R - 16);
                const dy = c.pos === POS.top ? -R + 16 : R - 16;
                ctx.fillText(c.label, c.pos.x + dx, c.pos.y + dy);
            });
        } else {
            /* ---------- CMYK: краска вычитает свет ----------
               Белая бумага, поверх — круги красок в режиме "multiply".
               Прозрачность круга = доля краски, поэтому при 0 %
               остаётся чистая бумага, а в центре получается
               тот же цвет, что в большом превью.                    */
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, W, H);

            const circles = [
                { a: cmyk.c / 100, ink: INK.c, pos: POS.top,   label: "C", name: "cyan" },
                { a: cmyk.m / 100, ink: INK.m, pos: POS.left,  label: "M", name: "magenta" },
                { a: cmyk.y / 100, ink: INK.y, pos: POS.right, label: "Y", name: "yellow" },
            ];

            ctx.globalCompositeOperation = "multiply";
            circles.forEach((c) => {
                if (c.a <= 0) return;
                ctx.fillStyle = `rgba(${c.ink.join(",")}, ${c.a})`;
                ring(ctx, c.pos.x, c.pos.y, R);
                ctx.fill();
            });
            ctx.globalCompositeOperation = "source-over";

            circles.forEach((c) => {
                // Обводка тёмнее краски, иначе голубая линия теряется на белом
                const [ir, ig, ib] = c.ink;
                const dark = `rgba(${Math.round(ir * 0.45)}, ${Math.round(ig * 0.5)}, ${Math.round(ib * 0.55)}, ${0.55 + c.a * 0.4})`;
                ctx.strokeStyle = dark;
                ctx.lineWidth = c.a > 0 ? 1.5 : 1.2;
                if (c.a <= 0) ctx.setLineDash([4, 4]);
                ring(ctx, c.pos.x, c.pos.y, R);
                ctx.stroke();
                ctx.setLineDash([]);
            });

            // Чёрная краска гасит весь участок (умножение на (1 - K))
            if (cmyk.k > 0) {
                ctx.globalCompositeOperation = "multiply";
                ctx.fillStyle = `rgba(0, 0, 0, ${cmyk.k / 100})`;
                ctx.fillRect(0, 0, W, H);
                ctx.globalCompositeOperation = "source-over";
            }

            ctx.font = "700 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            circles.forEach((c) => {
                ctx.fillStyle = "rgba(25,30,50,0.72)";
                const dx = c.pos === POS.top ? 0 : (c.pos === POS.left ? -R + 16 : R - 16);
                const dy = c.pos === POS.top ? -R + 16 : R - 16;
                ctx.fillText(c.label, c.pos.x + dx, c.pos.y + dy);
            });
        }
    }

    /* ------------------------- Прочее ------------------------- */
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            drawVenn("rgb");
            drawVenn("cmyk");
        }, 150);
    });

    document.addEventListener("keydown", (e) => {
        if (e.target.matches("input")) return;
        if (e.key === "1") { activateTab("rgb"); document.getElementById("tab-rgb").focus(); }
        if (e.key === "2") { activateTab("cmyk"); document.getElementById("tab-cmyk").focus(); }
    });

    /* ------------------------- Старт ------------------------- */
    renderRGB();
    renderCMYK();
})();
