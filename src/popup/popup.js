// Color settings popup. Saves to chrome.storage.local under "colors" as
// { <state key>: "#rrggbb" }; colors.js picks changes up on open ggLeap tabs.
const STATES = globalThis.GGU_STATES;
const list = document.getElementById("states");
const resetAll = document.getElementById("reset-all");
let colors = {};

let saveTimer;
function save() {
  // the picker fires many input events while dragging; write at most every 80ms
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ colors }), 80);
}

function render() {
  list.replaceChildren(
    ...STATES.map((st) => {
      const value = colors[st.key] || st.hex;
      const li = document.createElement("li");
      li.classList.toggle("custom", Boolean(colors[st.key]));

      const input = document.createElement("input");
      input.type = "color";
      input.id = `color-${st.key}`;
      input.value = value;
      input.setAttribute("aria-label", `${st.label} color`);

      const name = document.createElement("label");
      name.className = "name";
      name.htmlFor = input.id;
      name.innerHTML = `<b></b>${st.note ? "<span></span>" : ""}`;
      name.querySelector("b").textContent = st.label;
      if (st.note) name.querySelector("span").textContent = st.note;

      const hex = document.createElement("span");
      hex.className = "hex";
      hex.textContent = value;

      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "reset";
      reset.textContent = "↺";
      reset.title = `Reset ${st.label} to default`;
      reset.setAttribute("aria-label", reset.title);
      reset.hidden = !colors[st.key];

      input.addEventListener("input", () => {
        colors[st.key] = input.value;
        hex.textContent = input.value;
        li.classList.add("custom");
        reset.hidden = false;
        resetAll.disabled = false;
        save();
      });
      reset.addEventListener("click", () => {
        delete colors[st.key];
        chrome.storage.local.set({ colors });
        render();
      });

      li.append(input, name, hex, reset);
      return li;
    }),
  );
  resetAll.disabled = Object.keys(colors).length === 0;
}

resetAll.addEventListener("click", () => {
  colors = {};
  chrome.storage.local.set({ colors });
  render();
});

chrome.storage.local.get("colors").then((stored) => {
  colors = stored.colors || {};
  render();
});
