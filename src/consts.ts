export const DATASTAR = "datastar" as const;
export const DATASTAR_REQUEST = "Datastar-Request";
export const VERSION = "1.0.0-RC.4";

// The default duration for retrying SSE on connection reset. This is part of the underlying retry mechanism of SSE.
export const DefaultSseRetryDurationMs = 1000;

// Should elements be patched using the ViewTransition API?
export const DefaultElementsUseViewTransitions = false;

// Should a given set of signals patch if they are missing?
export const DefaultPatchSignalsOnlyIfMissing = false;
export const DatastarDatalineSelector = "selector"
export const DatastarDatalinePatchMode = "mode"
export const DatastarDatalineElements = "elements"
export const DatastarDatalineNamespace = "namespace"
export const DatastarDatalineUseViewTransition = "useViewTransition"
export const DatastarDatalineSignals = "signals"
export const DatastarDatalineOnlyIfMissing = "onlyIfMissing"
export const DatastarDatalinePaths = "paths"

// The mode in which an element is patched into the DOM.
export const ElementPatchModes = [
    // Morph entire element, preserving state
    "outer",
    // Morph inner HTML only, preserving state
    "inner",
    // Replace entire element, reset state
    "replace",
    // Insert at beginning inside target
    "prepend",
    // Insert at end inside target
    "append",
    // Insert before target element
    "before",
    // Insert after target element
    "after",
    // Remove target element from DOM
    "remove",
] as const;

export const NamespaceTypes = [
    "svg",
    "mathml",
] as const;

// Default value for ElementPatchMode
export const DefaultElementPatchMode = "outer";

// The type protocol on top of SSE which allows for core pushed based communication between the server and the client.
export const EventTypes = [
    // An event for patching HTML elements into the DOM.
    "datastar-patch-elements",
    // An event for patching signals.
    "datastar-patch-signals",
] as const;