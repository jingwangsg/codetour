// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict"
});

window.addEventListener("load", () => {
  mermaid.run({
    querySelector: ".mermaid",
    suppressErrors: true
  });
});
