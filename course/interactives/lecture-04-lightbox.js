const images = document.querySelectorAll("main img:not(.no-lightbox)");
if (images.length) {
  const dialog = document.createElement("dialog");
  dialog.className = "lecture-lightbox";
  dialog.innerHTML = '<button type="button" class="lightbox-close" aria-label="Закрыть изображение">×</button><img alt=""><p></p>';
  document.body.append(dialog);
  const enlarged = dialog.querySelector("img");
  const caption = dialog.querySelector("p");
  let previousFocus;
  for (const image of images) {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `Развернуть: ${image.alt || "изображение"}`);
    const open = () => {
      previousFocus = document.activeElement;
      enlarged.src = image.currentSrc || image.src;
      enlarged.alt = image.alt;
      caption.textContent = image.closest("figure")?.querySelector("figcaption")?.textContent || image.alt;
      dialog.showModal();
      dialog.querySelector("button").focus();
    };
    image.addEventListener("click", open);
    image.addEventListener("keydown", event => {if (event.key === "Enter" || event.key === " ") {event.preventDefault(); open();}});
  }
  const close = () => dialog.close();
  dialog.querySelector("button").addEventListener("click", close);
  dialog.addEventListener("click", event => {if (event.target === dialog) close();});
  dialog.addEventListener("close", () => previousFocus?.focus());
}
