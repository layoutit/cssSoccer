export function setCssoccerAttrs(element, attributes) {
  if (!element) return;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === "") continue;
    element.setAttribute("data-cssoccer-" + toKebabCase(name), String(value));
  }
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (character) => "-" + character.toLowerCase());
}
