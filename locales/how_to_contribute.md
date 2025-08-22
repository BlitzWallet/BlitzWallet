# Translation Guide

Thank you for helping translate this project!  
Please follow the steps below to add a new language:

---

## 1. Create a Language Folder

- Inside the `locals/` folder, create a new folder for your language.
- The folder name must use the correct **language code** (ISO-style).
  - Examples:
    - English → `en`
    - Spanish → `sp`
    - French → `fr`

---

## 2. Copy the Base Translation File

- Go to the English folder:
  ```
  locals/en/translation.json
  ```
- Copy the file into your new language folder.  
  Example for Spanish:
  ```
  locals/sp/translation.json
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

## 4. Add Your Language to `localeslist.js`

Open `localeslist.js` and add your language entry:
**The (languageName) property SHOULD be translated to the given langugae**

```js
{
  languageName: 'Español',
  fullySupported: true,
  translatedName: 'languages.spanish',
  id: 'sp',
  flagCode: 'es',
},
```

---

## 5. Update `i18n.js`

Open `i18n.js` and do the following:

1. **Import your translation file** at the top:

   ```js
   import spTranslation from './locals/sp/translation.json';
   ```

2. **Add your language code** to `supportedLngs`:

   ```js
   supportedLngs: ['en', 'sp'],
   ```

3. **Add your translation to the `resources` object**:
   ```js
   resources: {
     en: { translation: enTranslation },
     sp: { translation: spTranslation },
   },
   ```

---

✅ That’s it! Once you’ve confirmed it works, commit your changes and open a pull request.
