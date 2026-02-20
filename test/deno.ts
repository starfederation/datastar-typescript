import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { ServerSentEventGenerator } from "../npm/esm/web/serverSentEventGenerator.js";
import type { Jsonifiable } from "../src/types.ts";

// This server is used for testing the web standard based sdk
serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === "/") {
    return new Response(
      `<html><head><script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@1.0.0-RC.7/bundles/datastar.js"></script></head><body><div id="toMerge" data-signals:foo="'World'" data-init="@get('/merge')">Hello</div></body></html>`,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  } else if (url.pathname.includes("/merge")) {
    const reader = await ServerSentEventGenerator.readSignals(req);

    if (!reader.success) {
      console.error("Error while reading signals", reader.error);
      return new Response(`Error while reading signals`);
    }

    if (!("foo" in reader.signals)) {
      console.error("The foo signal is not present");
      return new Response("The foo signal is not present");
    }

    return ServerSentEventGenerator.stream((stream) => {
      stream.patchElements(
        `<div id="toMerge">Hello ${reader.signals.foo}</div>`,
      );
    });
  } else if (url.pathname.includes("/test")) {
    const reader = await ServerSentEventGenerator.readSignals(req);
    if (reader.success === true) {
      const events = reader.signals.events;
      if (isEventArray(events)) {
        return ServerSentEventGenerator.stream((stream) => {
          testEvents(stream, events);
        });
      }
    }
  } else if (url.pathname.includes("await")) {
    return ServerSentEventGenerator.stream(async (stream) => {
      stream.patchElements('<div id="toMerge">Merged</div>');
      await delay(5000);
      stream.patchElements('<div id="toMerge">After 5 seconds</div>');
    });
  }

  return new Response(`Path not found: ${req.url}`, {
    headers: { "Content-Type": "text/html" },
  });
});

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isEventArray(
  events: unknown,
): events is (Record<string, Jsonifiable> & { type: string })[] {
  return events instanceof Array && events.every((event) => {
    return typeof event === "object" && event !== null &&
      typeof event.type === "string";
  });
}

function testEvents(
  stream: ServerSentEventGenerator,
  events: Record<string, Jsonifiable>[],
) {
  events.forEach((event) => {
    const { type, ...e } = event;
    switch (type) {
      case "patchElements": {
        const { elements, mode, selector, useViewTransition, namespace, ...options } = e;
        const patchOptions: Record<string, unknown> = { ...options };
        if (mode && mode !== "outer") patchOptions.mode = mode;
        if (selector) patchOptions.selector = selector;
        if (useViewTransition !== undefined) patchOptions.useViewTransition = useViewTransition;
        if (namespace) patchOptions.namespace = namespace;
        stream.patchElements((elements as string) || "", patchOptions);
        break;
      }
      case "removeElements": {
        const { selector, elements, ...options } = e;
        stream.removeElements(selector as string | undefined, elements as string | undefined, options);
        break;
      }
      case "patchSignals": {
        const { signals, "signals-raw": signalsRaw, ...options } = e;
        if (signalsRaw) {
          stream.patchSignals(signalsRaw as string, options || undefined);
        } else if (signals) {
          stream.patchSignals(JSON.stringify(signals), options || undefined);
        }
        break;
      }
      case "removeSignals": {
        const { paths, ...options } = e;
        stream.removeSignals(paths, options);
        break;
      }
      case "executeScript": {
        const { script, autoRemove = true, attributes, ...options } = e;
        stream.executeScript(script as string, { autoRemove, attributes, ...options });
        break;
      }
    }
  });
}
