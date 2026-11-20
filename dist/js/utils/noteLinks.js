import { esc, safeURL } from "./helpers.js?v=65";
export function noteLinks(body) {
  return String(body)
    .split(/(https?:\/\/[^\s<>"']+)/gi)
    .map((part) => {
      const url = /^https?:\/\//i.test(part) ? safeURL(part) : "";
      return url
        ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>`
        : esc(part);
    })
    .join("");
}
