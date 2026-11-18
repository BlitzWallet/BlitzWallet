# Translation Guide

Thank you for helping translate this project!  
Please follow the steps below to add a new language:

---

## 1. Create a Language Folder

- Inside the `locales/` folder, create a new folder for your language.
- The folder name must use the correct **language code** (ISO-style).
  - Examples:
    - English → `en`
    - Spanish → `es`
    - French → `fr`

---

## 2. Copy the Base Translation File

- Go to the English folder:
  ```
  locales/en/translation.json
  ```
- Copy the file into your new language folder.  
  Example for Spanish:
  ```
  locales/es/translation.json
  ```

---

## 3. Translate the Values

- Translate only the **values** of each key.
- **Do not modify the keys.**
- Keep **spaces, punctuation, and formatting** identical.
- Do **not translate anything inside double curly brackets** (`{{ }}`).

Example:

```json
"welcomeMessage": "Welcome, {{username}}!"
```

- ✅ Correct: `"Bienvenido, {{username}}!"`
- ❌ Wrong: `"Bienvenido, {{nombreDeUsuario}}!"`

---

## 4. Add Your Language to `locales/localeslist.js`

Open `locales/localeslist.js` and add your language entry:
**The (languageName) property SHOULD be translated to the given langugae**

```js
{
  languageName: 'Español',
  fullySupported: true,
  translatedName: 'languages.spanish',
  shortId: 'es',
  id: 'es',
  flagCode: 'es',
},
```

- `id` is the folder/locale id (e.g. `pt-BR`, `de-DE`).
- `shortId` is the two-letter device language (`pt`, `de`). The app uses it to pick your language automatically on phones set to that language, so **do not leave it out**.

---

## 5. Add the Language Name Key

`translatedName` points at a key under `languages` in the translation files. Add it to `locales/en/translation.json` (and ideally every other locale), otherwise the language list in Settings shows the raw key:

```json
"languages": {
  "spanish": "Español"
}
```

---

## 6. Update `i18n.js`

Translations are loaded lazily, so you do **not** import the JSON at the top of the file. Open `i18n.js` and do the following:

1. **Add a loader** to `languageLoaders`:

   ```js
   es: () => import('./locales/es/translation.json'),
   ```

2. **Add your language code** to `supportedLngs`:

   ```js
   supportedLngs: ['en', 'es'],
   ```

For an id with a region (e.g. `pt-BR`, `de-DE`), add **both** the short code and the full id to `languageLoaders` and `supportedLngs`, pointing at the same folder:

```js
pt: () => import('./locales/pt-BR/translation.json'),
'pt-BR': () => import('./locales/pt-BR/translation.json'),
```

---


✅ That’s it! Once you’ve confirmed it works, commit your changes and open a pull request.
