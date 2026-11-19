import chat from "../../Online/netlify/functions/chat.js";
import exitFeedback from "../../Online/netlify/functions/exit-feedback.js";
import sendReport from "../../Online/netlify/functions/send-report.js";

/**
 * Landingpage-Worker: statische Assets plus die drei Formular-Endpunkte.
 *
 * Die Endpunkte liegen weiterhin unter /.netlify/functions/… — der Pfad steht so
 * in der Website und im Chat-Widget. Ihn hier beizubehalten heißt: kein einziges
 * HTML muss angefasst werden, und solange Netlify parallel läuft, verhalten sich
 * beide Deployments identisch. /api/<name> funktioniert zusätzlich, damit der
 * Netlify-Name später verschwinden kann, ohne dass etwas bricht.
 *
 * Der Funktionscode selbst bleibt unverändert im Netlify-Format (`exports.handler`
 * mit einem event-Objekt). Die Übersetzung passiert unten in toEvent/toResponse —
 * eine Kopie der drei Dateien im Worker-Stil wäre zwei Quellen für dieselbe Logik,
 * und genau dort entstehen die Abweichungen, die niemand bemerkt.
 */

const HANDLERS = {
  chat: chat.handler,
  "exit-feedback": exitFeedback.handler,
  "send-report": sendReport.handler
};

/** Request → Netlify-Function-Event. */
async function toEvent(request) {
  const url = new URL(request.url);
  const headers = {};
  for (const [key, value] of request.headers) headers[key.toLowerCase()] = value;

  return {
    httpMethod: request.method,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? null : await request.text(),
    isBase64Encoded: false
  };
}

/** Netlify-Function-Ergebnis → Response. */
function toResponse(result) {
  const { statusCode = 200, headers = {}, body = "" } = result ?? {};

  return new Response(body, { status: statusCode, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const match = url.pathname.match(/^\/(?:\.netlify\/functions|api)\/([a-z-]+)\/?$/);
    if (match) {
      const handler = HANDLERS[match[1]];
      if (!handler) return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });

      // Die Funktionen lesen ihre Konfiguration aus process.env. In Workers
      // kommen Variablen und Secrets über env herein; nodejs_compat stellt ein
      // process-Objekt bereit, das wir vor dem ersten Aufruf befüllen.
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === "string" && process.env[key] === undefined) process.env[key] = value;
      }

      try {
        return toResponse(await handler(await toEvent(request), ctx));
      } catch (error) {
        console.error(`function ${match[1]} failed:`, error instanceof Error ? error.message : error);
        return new Response(JSON.stringify({ error: "server_error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
