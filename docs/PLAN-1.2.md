# Alo 1.2.0 — পরিকল্পনা: `init --template`

অবস্থা: মাইলস্টোন ০–৫ শেষ; 1.2.0-র রিলিজ commit আর tag তৈরি (২০২৬-১১-১৪)। npm-এ প্রকাশ হয় GitHub release দিলে।

প্রকাশের যাচাই (অংশ ১০): `npm pack`-এ ১১৪টি ফাইল, ৮৮KB (খোলা অবস্থায় ৩৩৫KB); পাঁচটি টেমপ্লেট ফোল্ডারই আছে। প্যাক করা `.tgz` থেকে পাঁচটি টেমপ্লেটেই `init` → `npm install` → `node alo build` সতর্কবার্তা ছাড়া চলেছে: `default` ৫, `blank` ১, `portfolio` ৮, `docs` ৮, `landing` ২টি পেইজ।

এই ভার্সনের পরিধি একটিই: `alo init`-এ `--template` ফ্ল্যাগ, আর চারটি নতুন টেমপ্লেট। সব টেমপ্লেট প্যাকেজের ভেতরে (`templates/`) থাকে; বাইরের git repo থেকে টেমপ্লেট নামানো এই ভার্সনে নেই। core-এ (`core/`) কোনো পরিবর্তন নেই।

---

## ১. কী যোগ হয়, এক নজরে

```sh
npx @msilabs/alo init my-site                        # আজকের মতোই
npx @msilabs/alo init my-site --template blank
npx @msilabs/alo init my-site --template portfolio
npx @msilabs/alo init my-site --template docs
npx @msilabs/alo init my-site --template landing
```

| নাম | ফোল্ডার | কার জন্য | পেইজ |
| --- | --- | --- | --- |
| `default` | `templates/init/` | প্রথমবার Alo দেখছেন | হোম, about, ব্লগ, পোস্ট, 404 (আজকের মতো) |
| `blank` | `templates/blank/` | Alo জানেন, নিজে সাজাবেন | শুধু হোম |
| `portfolio` | `templates/portfolio/` | নিজের কাজ দেখানোর সাইট | হোম, প্রজেক্ট, প্রজেক্টের পাতা, about, যোগাযোগ, 404 |
| `docs` | `templates/docs/` | ডকুমেন্টেশন সাইট | হোম, ডকসের সূচি, প্রতিটি পাতা, 404 |
| `landing` | `templates/landing/` | এক পাতার প্রোডাক্ট সাইট | হোম, 404 |

যা বদলায় না:

- `--template` ছাড়া `alo init` হুবহু আজকের ফল দেয়: একই ফাইল, একই বার্তা।
- `templates/init/` ফোল্ডারের নাম আর `templates/init/AGENTS.md`-এর ঠিকানা (README আর `llms.txt` এই ঠিকানা দেয়)।
- `alo dev`, `alo build`, `alo new`, আর `core/`-এর সবকিছু।
- zero-dependency: নতুন কোনো npm প্যাকেজ নয়, টেমপ্লেটেও নয়।

ভাঙা পরিবর্তন নেই, তাই ভার্সন 1.2.0।

---

## ২. সিদ্ধান্ত

`DECISIONS.md`-এ #৯২–#১০০ হিসেবে যোগ হয়েছে।

| # | সিদ্ধান্ত | কারণ |
| --- | --- | --- |
| ৯২ | `alo init [folder] --template <name>`; না দিলে `default` | এক ফ্ল্যাগে সব ধরন; পুরনো কমান্ড অপরিবর্তিত |
| ৯৩ | সব টেমপ্লেট প্যাকেজের ভেতরে, `templates/<name>/`-এ | অফলাইনে চলে; টেমপ্লেট সবসময় একই ভার্সনের Alo-র সাথে মেলে আর একই টেস্টে build হয় |
| ৯৪ | ডিফল্ট টেমপ্লেটের নাম `default`, ফোল্ডার `templates/init/`-ই থাকে | `templates/init/AGENTS.md`-এর প্রকাশিত ঠিকানা ভাঙে না |
| ৯৫ | `AGENTS.md`-এর উৎস একটিই (`templates/init/AGENTS.md`); `init` সেটি প্রতিটি টেমপ্লেটের প্রজেক্টে কপি করে | পাঁচটি কপি আলাদা হয়ে যাওয়া এড়ানো |
| ৯৬ | টেমপ্লেটগুলো একে অপরের ওপর নির্ভর করে না; `01-reset.css` আর `favicon.svg` প্রতিটিতে নিজের কপি | `init` শুধু একটি ফোল্ডার কপি করে; মেলানোর কোনো যুক্তি লাগে না |
| ৯৭ | টেমপ্লেটে বাইরের কিছু নেই: CDN, বাইরের ফন্ট বা ছবির লিংক নয়; ছবি শুধু SVG | নতুন প্রজেক্ট অফলাইনে চলে; প্যাকেজ ছোট থাকে |
| ৯৮ | টেমপ্লেটের নমুনা লেখা বাংলায়, ডিফল্টের মতো; `portfolio`-তে জায়গা-ধরা লেখা; `docs`-এর নমুনা Alo-র ছোট গাইড | সব টেমপ্লেটে এক ভাষা; নমুনা পড়েই শেখা যায় |
| ৯৯ | অজানা নাম বা `user/repo` ধাঁচের নাম দিলে এরর, সাথে টেমপ্লেটের তালিকা; ডিস্কে কিছু লেখা হয় না | ভুল নামে চুপচাপ ডিফল্ট বানালে ব্যবহারকারী পরে টের পায় |
| ১০০ | তালিকার ক্রম ফ্রন্ট ম্যাটারের `order` থেকে (`portfolio`-র প্রজেক্ট, `docs`-এর পাতা), ফাইলের নামের সংখ্যা থেকে নয় | ঠিকানা পরিষ্কার থাকে; দুই টেমপ্লেটে এক নিয়ম |

---

## ৩. আচরণের খুঁটিনাটি

### ৩.১ ফ্ল্যাগ

- `--template portfolio` আর `--template=portfolio` দুটোই চলে (অন্য ফ্ল্যাগের মতো)।
- ফোল্ডারের নাম ছাড়াও চলে: `alo init --template blank` বর্তমান খালি ফোল্ডারে বানায়।
- `--template default` মানে ফ্ল্যাগ না দেওয়া।
- `alo init blank` আগের মতোই `blank` নামের ফোল্ডারে ডিফল্ট প্রজেক্ট বানায়; নাম দেখে কিছু অনুমান করা হয় না।
- `--template` শুধু `init`-এ চলে।

### ৩.২ বার্তা

সফল হলে, ডিফল্ট ছাড়া অন্য টেমপ্লেটে একটি বাড়তি লাইন:

```
✔ Created a new Alo project: my-site
  Template: portfolio

Next steps:
  cd my-site
  npm install
  node alo dev
```

এরর (সবগুলো ডিস্কে কিছু লেখার আগে):

| অবস্থা | বার্তা | ইঙ্গিত |
| --- | --- | --- |
| অজানা নাম, কাছাকাছি মিল আছে | ``There is no template `portfolo`.`` | ``Did you mean `portfolio`?`` + তালিকা |
| অজানা নাম | ``There is no template `shop`.`` | ``Templates: `default`, `blank`, `portfolio`, `docs`, `landing`.`` |
| নামে `/` বা `:` আছে | ``Templates from a repository are not supported.`` | তালিকা |
| মান নেই | ``\`--template\` needs a value.`` | ``For example: `--template portfolio` `` |
| অন্য কমান্ডে | ``\`--template\` does not work with `alo build`.`` | ``\`--template\` only works with `alo init`.`` |

`--help`-এ:

```
  alo init [folder]                  create a new project
           [--template name]         default, blank, portfolio, docs, landing
```

অজানা ফ্ল্যাগের ইঙ্গিত ("Alo only has `--port` and `--base`…") থেকে ফ্ল্যাগের নাম বাদ দিয়ে শুধু `Run \`alo --help\` for everything.` রাখা, যাতে প্রতিটি নতুন ফ্ল্যাগে এই বাক্য বদলাতে না হয়।

### ৩.৩ প্রতিটি প্রজেক্টে যা একই থাকে

কোড থেকে তৈরি ফাইল (#৭৯) সব টেমপ্লেটে এক: `alo`, `package.json`, `.gitignore`, `.gitattributes`, `.vscode/settings.json`, `.vscode/extensions.json`। সাথে `AGENTS.md` (#৯৫)।

---

## ৪. টেমপ্লেটের নিয়ম

প্রতিটি টেমপ্লেট এগুলো মানে; টেস্ট এগুলোই যাচাই করে (অংশ ৭)।

- `init` করার পর `alo build` কোনো এরর বা সতর্কবার্তা ছাড়া চলে। অব্যবহৃত কম্পোনেন্টও নয়: সেই লাইন stdout-এ যায়, তাই টেস্ট stdout-এ `Unused components` না থাকাও দেখে।
- ফোল্ডারে শুধু সাইটের ফাইল: `pages/`, `components/`, `data/`, `global/`, `public/`। `AGENTS.md`, `package.json` বা ডটফাইল নয়।
- বাইরের URL থেকে কিছু লোড হয় না (#৯৭)।
- হালকা আর ডার্ক মোড দুটোতেই পড়া যায় (`prefers-color-scheme`), ফোনের প্রস্থে ভাঙে না।
- রঙ, ফন্ট আর মাপ `global/theme.css`-এর ভেরিয়েবলে (`blank` বাদে)।
- নমুনা লেখা নিজেই বলে কোন ফাইল বদলাতে হবে, ডিফল্টের কার্ডগুলোর মতো।
- JS শুধু যেখানে না হলে চলে না (মোবাইল মেনু)। সম্ভব হলে `<details>`-এর মতো HTML।
- আকার: প্রতিটি টেমপ্লেটের ফাইলগুলোর বাইটের যোগফল ৮০KB-র নিচে (এখন `templates/init/` ২৩KB; ডিস্কের ব্লক ধরে `du` দেখায় ৬৮KB)।

---

## ৫. টেমপ্লেটগুলো

### ৫.১ `blank`

```
pages/page.alo          একটি <h1> আর এক লাইন
data/site.json          name, lang, url (url না থাকলে build সতর্কবার্তা দেয়)
public/favicon.svg
```

কোনো CSS, কম্পোনেন্ট, লেআউট বা 404 পেইজ নেই। খালি ফোল্ডার npm প্যাকেজে যায় না, তাই `components/` আর `global/` তৈরি হয় না; দরকার হলে `alo new component …` বানিয়ে নেয়।

### ৫.২ `portfolio`

```
pages/
  layout.alo                  Header + Footer
  page.alo                    পরিচয়, বাছাই করা ৩টি প্রজেক্ট, দক্ষতা
  projects/page.alo           সব প্রজেক্ট
  projects/[slug]/page.alo    একটি প্রজেক্ট (Markdown বডি)
  about/page.alo              জীবনী + অভিজ্ঞতার তালিকা
  contact/page.alo            ইমেইল আর সামাজিক লিংক
  not-found.alo
components/
  Header.alo, Footer.alo, ProjectCard.alo, Tag.alo
data/
  site.json, menu.json
  profile.json                নাম, পদবি, ছোট পরিচয়, ইমেইল
  social.json                 লিংকের তালিকা
  skills.json
  experience.json
  projects/*.md (৩টি)         title, summary, tags, link, cover, order
global/base/01-reset.css, global/theme.css
public/favicon.svg, public/projects/*.svg (৩টি কভার)
```

- প্রজেক্টের ক্রম: `data.projects.toSorted((a, b) => a.order - b.order)` (#১০০)। ফাইলের নামে সংখ্যা নয়, যাতে ঠিকানা পরিষ্কার থাকে (`/projects/shop/`)।
- যোগাযোগের পাতায় ফর্ম নেই (ব্যাকএন্ড নেই); `mailto:` আর লিংক।
- `about` পাতা প্রিন্ট করলে CV-র মতো আসে (`@media print`), তাই আলাদা `resume` টেমপ্লেট লাগে না।
- নমুনায় কোনো বানানো মানুষ নয়; "আপনার নাম" ধাঁচের জায়গা-ধরা লেখা (#৯৮)।

### ৫.৩ `docs`

```
pages/
  layout.alo                  Header + Footer
  page.alo                    ছোট পরিচয় + "শুরু করুন" লিংক
  docs/layout.alo             বাঁ পাশে Sidebar, ডানে <slot />
  docs/page.alo               অংশ ধরে সব পাতার সূচি
  docs/[slug]/page.alo        একটি পাতা + আগের/পরের লিংক
  not-found.alo
components/
  Header.alo, Footer.alo
  docs/Sidebar.alo            <Docs.Sidebar />
  docs/PrevNext.alo           <Docs.PrevNext slug="{{ item.slug }}" />
data/
  site.json, menu.json
  sections.json               অংশের নাম, ক্রমে
  docs/*.md                   ফ্রন্ট ম্যাটার: title, section, order
global/base/01-reset.css, global/theme.css
public/favicon.svg
```

- সব পাতা এক স্তরে: `/docs/<slug>/`। `[slug]` শুধু পাথের শেষে চলে, তাই `/docs/guide/install/` হয় না; ভাগ দেখায় Sidebar, `section` দিয়ে।
- ক্রম: `data.docs.toSorted((a, b) => a.order - b.order)`। ফাইলের নামে সংখ্যা নয়, যাতে ঠিকানা পরিষ্কার থাকে।
- সক্রিয় লিংক `route.path` দিয়ে, তাই Sidebar-কে `item` পাঠাতে হয় না।
- Markdown বডি আর কোড ব্লকের স্টাইল `<style global>`-এ।
- মোবাইলে Sidebar খোলা-বন্ধের জন্য ছোট `$el` স্ক্রিপ্ট।
- নেই: সার্চ, "এই পাতায়" সূচি, ভার্সন বাছাই।
- নমুনা পাতা ৫টি, যা নিজেই Alo-র ছোট গাইড: ইনস্টল, পেইজ, কম্পোনেন্ট, ডেটা, প্রকাশ (#৯৮)। README বদলালে এই পাঁচটি পাতাও মিলিয়ে দেখতে হবে।

### ৫.৪ `landing`

```
pages/
  layout.alo
  page.alo                    অংশগুলো ক্রমে বসানো
  not-found.alo
components/
  Header.alo                  পাতার ভেতরের লিংক (/#features …)
  Hero.alo, Features.alo, Pricing.alo, Faq.alo, Cta.alo, Footer.alo
data/
  site.json, menu.json
  features.json, plans.json, faq.json
global/base/01-reset.css, global/theme.css
public/favicon.svg, public/hero.svg
```

- `Pricing`: `plans.json`-এর `featured: true` পরিকল্পনা আলাদা দেখায় (`<template if>`)।
- `Faq`: `<details>`, JS ছাড়া।
- বোতামগুলো সাধারণ লিংক; ফর্ম বা সাইন-আপ নেই।

---

## ৬. কোডের পরিবর্তন

| ফাইল | পরিবর্তন |
| --- | --- |
| `cli/index.js` | `VALUE_FLAGS`-এ `template`; `FLAGS_BY_COMMAND.init = ['template']`; মান না থাকা আর ভুল কমান্ডের ইঙ্গিত; `HELP`; `init(process.cwd(), args[0], flags.template)` |
| `cli/scaffold.js` | `TEMPLATES` (নাম → ফোল্ডার, `default` → `init`); `init(cwd, folder, template = 'default')`; শুরুতেই নাম যাচাই (#৯৯); বাছাই করা ফোল্ডার কপি; `AGENTS.md` কপি (#৯৫); "Template:" লাইন |
| `templates/blank/`, `portfolio/`, `docs/`, `landing/` | নতুন |
| `templates/init/AGENTS.md` | গঠনের অংশটি "উদাহরণ" হিসেবে পড়া যায় কিনা দেখা (`blank`-এ `about/` বা `blog/` নেই); দরকার হলে এক লাইন বদল |
| `package.json` | `version: 1.2.0`; `files`-এ `templates` আগে থেকেই আছে |

`core/`, `cli/build.js`, `cli/dev-server.js`: কোনো পরিবর্তন নেই।

---

## ৭. টেস্ট

`test/scaffold.test.js`-এ:

- **প্রতিটি টেমপ্লেটের জন্য (লুপে):** `init` সফল; কোড থেকে তৈরি ছয়টি ফাইল আর `AGENTS.md` আছে; `build` exit 0, stderr খালি, stdout-এ `Unused components` নেই; পেইজের সংখ্যা প্রত্যাশিত; ফাইলের বাইটের যোগফল ৮০KB-র নিচে।
- **`default`:** `--template` ছাড়া, `--template default` আর `--template=default` একই ফাইলের তালিকা দেয়; আউটপুটে "Template:" লাইন নেই।
- **এরর:** অজানা নাম (ইঙ্গিতে কাছের নাম), `user/repo`, মান ছাড়া `--template`, `build --template blank`। প্রতিটিতে exit 1 আর লক্ষ্য ফোল্ডার তৈরি হয়নি।
- **ফোল্ডার ছাড়া:** `init --template blank` বর্তমান ফোল্ডারে বানায়।
- **নিয়ম (অংশ ৪):** `templates/init/` ছাড়া কোনো টেমপ্লেটে `AGENTS.md`, `package.json` বা ডটফাইল নেই; টেমপ্লেটের ফাইলে `https://` দিয়ে লোড হওয়া `src`, `href="…css"` বা `url(` নেই; যেসব টেমপ্লেটে `01-reset.css` আছে সেগুলো হুবহু এক।
- **তালিকার মিল:** `TEMPLATES`-এর প্রতিটি নাম `templates/`-এ আছে, আর `templates/`-এর প্রতিটি ফোল্ডার `TEMPLATES`-এ আছে।

প্রতিটি টেমপ্লেটের আউটপুটের একটি-দুটি নির্দিষ্ট যাচাই (যেমন `docs`-এ সক্রিয় লিংকের class, `portfolio`-তে প্রজেক্টের পাতার সংখ্যা)। পুরো HTML মেলানো নয়।

---

## ৮. ডকস

- **README:** "শুরু" অংশে `--template`-এর এক লাইন; নতুন অংশ "টেমপ্লেট" (টেবিল + প্রতিটির ফোল্ডার-গঠন সংক্ষেপে); CLI-র তালিকা।
- **`docs/SPEC.md`:** অংশ ৩ (প্রজেক্ট শুরু), ১৭ (CLI), ১৯ (টেমপ্লেট), ২২ (টেস্ট)।
- **`DECISIONS.md`:** #৯২–#১০০।
- **`CHANGELOG.md`:** খসড়া নিচে।
- **`llms.txt`:** টেমপ্লেটের তালিকার এক লাইন।
- **`site/`:** শুরু করার গাইডে `--template`। সাইট push হবে npm প্রকাশের পরে।
- **`alo-vscode`:** পরিবর্তন লাগে না; সব টেমপ্লেটে `pages/` আছে।

CHANGELOG-এর খসড়া:

```markdown
## 1.2.0 (তারিখ)

### নতুন

- `alo init`-এ `--template`: `blank`, `portfolio`, `docs`, `landing`। না দিলে আগের মতোই ছোট উদাহরণ সাইট তৈরি হয়।
  - `blank`: শুধু একটি পেইজ, কোনো CSS বা কম্পোনেন্ট ছাড়া।
  - `portfolio`: প্রজেক্ট, about আর যোগাযোগের পাতা।
  - `docs`: Markdown থেকে ডকুমেন্টেশন সাইট, পাশে মেনু।
  - `landing`: এক পাতার প্রোডাক্ট সাইট।
```

---

## ৯. মাইলস্টোন

প্রতিটির শেষে `npm test` সবুজ, তারপর থামা।

| # | কাজ | প্রস্তাবিত commit |
| --- | --- | --- |
| ০ | খোলা প্রশ্নের উত্তর; `DECISIONS.md` আর `SPEC.md` হালনাগাদ | `docs: plan init templates for 1.2.0` |
| ১ | `--template` ফ্ল্যাগ, এরর, `AGENTS.md` কপি, `blank`, লুপের টেস্ট | `feat(init): add --template flag and blank template` |
| ২ | `portfolio` | `feat(init): add portfolio template` |
| ৩ | `docs` | `feat(init): add docs template` |
| ৪ | `landing` | `feat(init): add landing template` |
| ৫ | README, CHANGELOG, `llms.txt`, `site/` | `docs: document init templates` |
| ৬ | প্রকাশ (অংশ ১০) | `chore: release 1.2.0` |

**কাটার জায়গা:** মাইলস্টোন ২-এর পরে ৫ আর ৬ করলেই 1.2.0 প্রকাশ করা যায়। তখন `docs` আর `landing` 1.3.0-তে যায়, নকশার কিছু বদলাতে হয় না; শুধু `TEMPLATES`, `--help` আর ডকস থেকে নাম দুটো বাদ থাকে।

প্রতিটি টেমপ্লেটের মাইলস্টোনে হাতে যাচাই: `node alo dev` চালিয়ে ব্রাউজারে হালকা মোড, ডার্ক মোড আর ফোনের প্রস্থ দেখা।

---

## ১০. প্রকাশের তালিকা

`docs/RELEASE-CHECK.md` ধরে, সাথে:

1. `npm pack --dry-run`: ফাইলের সংখ্যা আর আকার লিখে রাখা (1.1.0-তে ৪১টি ফাইল, ৫৬KB); পাঁচটি টেমপ্লেট ফোল্ডারই প্যাকেজে আছে।
2. প্যাক করা `.tgz` থেকে পাঁচটি টেমপ্লেটেই `init` → `npm install` → `node alo build`।
3. tag + GitHub release → npm।
4. প্রকাশের পরে আসল `npx @msilabs/alo init x --template portfolio` একবার।
5. `site/` push।

---

## ১১. খোলা প্রশ্নের উত্তর

সবগুলোর উত্তর মালিক দিয়েছেন (২০২৬-১১-১২)।

| # | প্রশ্ন | উত্তর |
| --- | --- | --- |
| ১ | নমুনা লেখার ভাষা | বাংলা, ডিফল্টের মতো; `data/site.json`-এ `lang: "bn"` (#৯৮) |
| ২ | ডিফল্টের নাম `default`, `init` না `starter` | `default` (#৯৪)। `init` নিলে ম্যাপ লাগত না, কিন্তু `alo init --template init` অদ্ভুত পড়ায় আর তালিকায় নামটি কিছু বোঝায় না |
| ৩ | `portfolio`-র নমুনা: বানানো মানুষ না জায়গা-ধরা লেখা | জায়গা-ধরা লেখা ("আপনার নাম") (#৯৮) |
| ৪ | `docs`-এর নমুনা পাতা: Alo-র ছোট গাইড না সাধারণ নমুনা | Alo-র ছোট গাইড (#৯৮) |
| ৫ | `site/`-এ টেমপ্লেটের ছবি বা লাইভ নমুনা | এই ভার্সনে নয়; শুধু লেখায় বর্ণনা |
| ৬ | `portfolio`-র প্রজেক্টের ক্রম: ফাইলের নামে সংখ্যা না `order` | ফ্রন্ট ম্যাটারে `order` (#১০০) |
| ৭ | পরিধি: চারটি টেমপ্লেটই, না শুধু `blank` + `portfolio` | চারটিই 1.2.0-তে; অংশ ৯-এর কাটার জায়গা খোলা থাকে |
| ৮ | কাজের branch | `main`-এই, প্রতি মাইলস্টোনে একটি commit |

--- | --- | --- |
| ১ | নমুনা লেখার ভাষা | বাংলা, ডিফল্টের মতো; `data/site.json`-এ `lang: "bn"` |
| ২ | ডিফল্টের নাম `default` না `starter` | `default`; নামটি শুধু `--template default` আর তালিকায় দেখা যায় |
| ৩ | `portfolio`-র নমুনা: বানানো মানুষ না জায়গা-ধরা লেখা | জায়গা-ধরা লেখা ("আপনার নাম"), যাতে ভুল করে কারও পরিচয় প্রকাশ না হয় |
| ৪ | `docs`-এর নমুনা পাতা: Alo-র ছোট গাইড না সাধারণ নমুনা | Alo-র ছোট গাইড; নতুন ব্যবহারকারী পড়েই শেখে। README বদলালে এই পাঁচটি পাতাও মিলিয়ে দেখতে হবে |
| ৫ | `site/`-এ টেমপ্লেটের ছবি বা লাইভ নমুনা | এই ভার্সনে নয়; শুধু লেখায় বর্ণনা |

---

## ১২. এই ভার্সনে নেই

- `--template user/repo` (git repo থেকে টেমপ্লেট)। চাহিদা দেখা দিলে পরের minor-এ।
- `business`, `catalog`, `blog`, `resume`, `event` টেমপ্লেট।
- `init`-এ প্রশ্ন করে বাছাই (interactive prompt)।
- `--tailwind` বা অন্য কোনো বাড়তি ফ্ল্যাগ।
- টেমপ্লেটের জন্য core-এ নতুন সুবিধা (RSS, pagination, সার্চ, নেস্টেড `[slug]`)।
- Adhar-এর `init --web` থেকে Alo-র টেমপ্লেট বাছাই; সেটি Adhar 1.2.0-র পরিকল্পনার বিষয়।

---

## ১৩. গ্রহণযোগ্যতার মানদণ্ড

- `--template` ছাড়া `alo init`-এর ফাইল আর আউটপুট 1.1.0-র সাথে হুবহু এক; পুরনো টেস্টগুলো বদল ছাড়াই পাস করে।
- পাঁচটি টেমপ্লেটের প্রতিটিতে `init` → `npm install` → `node alo dev` প্রথমবারেই চলে, আর `build`-এ কোনো সতর্কবার্তা নেই।
- ভুল নামে ডিস্কে কিছু তৈরি হয় না, আর এররে সব টেমপ্লেটের নাম থাকে।
- `package.json`-এ কোনো dependency যোগ হয়নি; `core/` অপরিবর্তিত।
- README পড়ে একজন নতুন ব্যবহারকারী বুঝতে পারে কোন টেমপ্লেট কখন নেবে।
