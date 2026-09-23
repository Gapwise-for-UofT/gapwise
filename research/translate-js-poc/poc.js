// Research fixture only. No application route imports this file.
const selector = document.getElementById("language");
const copy = document.getElementById("public-copy");
const status = document.getElementById("translation-status");
const storageKey = "gapwise-translate-js-poc-language";
const languages = new Set(["english", "french", "spanish"]);

function savedLanguage() {
  try {
    const value = localStorage.getItem(storageKey);
    return languages.has(value) ? value : "english";
  } catch {
    return "english";
  }
}

function rememberLanguage(language) {
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
}

function changeLanguage(language) {
  if (!languages.has(language)) return;
  selector.value = language;
  rememberLanguage(language);
  document.documentElement.lang = { english: "en", french: "fr", spanish: "es" }[language];
  status.textContent =
    language === "english" ? "English source text" : "Machine translation requested";
  translate.changeLanguage(language);
}

// The source is vendored at a fixed commit. Scope scanning to invented public copy only.
translate.selectLanguageTag.show = false;
translate.language.setLocal("english");
translate.service.use("client.edge");
translate.request.api.init = "";
translate.request.api.connectTest = "";
translate.request.api.ip = "";
translate.request.api.language = translate.service.edge.language.json;
translate.ignore.class.push("notranslate");
translate.ignore.tag.push("code");
translate.setDocuments(copy);
translate.listener.start();

const post = translate.request.post.bind(translate.request);
translate.request.post = (path, data, onSuccess, onFailure, ...rest) =>
  post(
    path,
    data,
    onSuccess,
    (error) => {
      if (path === translate.request.api.translate) {
        selector.value = "english";
        rememberLanguage("english");
        document.documentElement.lang = "en";
        translate.changeLanguage("english");
        status.textContent = "Translation unavailable. Showing English source text.";
      }
      onFailure?.(error);
    },
    ...rest,
  );

const initialLanguage = savedLanguage();
selector.value = initialLanguage;
if (initialLanguage === "english") {
  translate.execute();
} else {
  changeLanguage(initialLanguage);
}

selector.addEventListener("change", (event) => changeLanguage(event.target.value));
document.getElementById("add-copy").addEventListener("click", () => {
  const paragraph = document.createElement("p");
  paragraph.textContent = "Explore another campus place.";
  document.getElementById("dynamic-copy").append(paragraph);
});
document.getElementById("navigate-copy").addEventListener("click", () => {
  history.pushState({}, "", "/public-view");
  document.getElementById("sample-copy").textContent = "Discover a public campus space.";
});
