const main = document.querySelector("main");
if (main) {
  const selector = 'img:not(.no-lightbox), svg[role="img"]:not(.no-lightbox), .mermaid svg:not(.no-lightbox), .zoomable-image';
  const dialog = document.createElement("dialog");
  dialog.className = "lecture-lightbox";
  dialog.innerHTML = '<button type="button" class="lightbox-close" aria-label="Закрыть изображение">×</button><div class="lightbox-stage"></div><p></p>';
  document.body.append(dialog);
  const stage = dialog.querySelector(".lightbox-stage");
  const caption = dialog.querySelector("p");
  let previousFocus;

  const prepare = figure => {
    if (figure.classList.contains("zoomable-image")) return;
    const description = figure.getAttribute("aria-label") || figure.getAttribute("alt") ||
      figure.closest("figure")?.querySelector("figcaption")?.textContent || "изображение";
    figure.dataset.lightboxDescription = description;
    figure.classList.add("zoomable-image");
    figure.tabIndex = 0;
    figure.setAttribute("role", "button");
    figure.setAttribute("aria-label", `Развернуть: ${description}`);
  };
  const scan = node => {
    if (!(node instanceof Element)) return;
    if (node.matches(selector)) prepare(node);
    node.querySelectorAll(selector).forEach(prepare);
  };
  scan(main);
  new MutationObserver(records => records.forEach(record =>
    record.addedNodes.forEach(scan))).observe(main, {childList: true, subtree: true});

  const open = figure => {
    previousFocus = figure;
    stage.replaceChildren();
    const description = figure.dataset.lightboxDescription || "изображение";
    if (figure instanceof HTMLImageElement) {
      const image = document.createElement("img");
      image.src = figure.currentSrc || figure.src;
      image.alt = description;
      stage.append(image);
    } else {
      const clone = figure.cloneNode(true);
      clone.classList.remove("zoomable-image");
      clone.removeAttribute("tabindex");
      clone.setAttribute("role", "img");
      clone.setAttribute("aria-label", description);
      const wrapper = document.createElement("div");
      const originalWrapper = figure.closest('.segment-chart, .line-wave-scroll, .ia-figure, .spectrum-plot, .ber-plot, .interactive-plot, .mermaid');
      if (originalWrapper) wrapper.className = originalWrapper.className;
      wrapper.append(clone);
      stage.append(wrapper);
    }
    caption.textContent = figure.closest("figure")?.querySelector("figcaption")?.textContent || description;
    dialog.showModal();
    dialog.querySelector("button").focus();
  };
  main.addEventListener("click", event => {
    const figure = event.target.closest(selector);
    if (!figure) return;
    event.preventDefault();
    open(figure);
  });
  main.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target.matches(selector)) return;
    event.preventDefault();
    open(event.target);
  });
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {if (event.target === dialog) dialog.close();});
  dialog.addEventListener("close", () => previousFocus?.focus());
}
