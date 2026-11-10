# আলো (Alo)

[![CI](https://github.com/msilabs/alo/actions/workflows/ci.yml/badge.svg)](https://github.com/msilabs/alo/actions/workflows/ci.yml)

**হালকা স্ট্যাটিক ওয়েব ফ্রেমওয়ার্ক।** HTML, CSS আর JS লিখুন, সাথে পান কম্পোনেন্ট, লেআউট আর সহজ লুপ ও শর্ত। বিল্ড করলে পাবেন পুরোপুরি স্ট্যাটিক সাইট। Node.js ছাড়া আর কিছু লাগে না।

## Alo কী

Alo একটি বিল্ড-টাইম টুল। আপনি `.alo` ফাইলে সাধারণ HTML, CSS আর JS লেখেন; লেখা আর তালিকা রাখেন JSON বা Markdown-এ। `node alo build` চালালে তৈরি হয় সাধারণ HTML, CSS আর JS, যা যেকোনো স্ট্যাটিক হোস্টিংয়ে চলে। কোনো নতুন ভাষা নেই, কোনো `import` নেই, কোনো কনফিগারেশন ফাইল নেই, আর ব্রাউজারে কোনো রিঅ্যাক্টিভ রানটাইম নেই। Alo নিজেও কোনো npm প্যাকেজের ওপর নির্ভর করে না।

## শুরু করা

Node.js ২২ বা নতুন ভার্সন লাগবে।

```bash
npx @msilabs/alo init my-site
cd my-site
npm install
node alo dev
```

ব্রাউজারে খুলুন `http://localhost:3000`। যেকোনো ফাইল বদলে সংরক্ষণ করলে পেইজ নিজে থেকে রিলোড হয়।

সাইট প্রকাশ করতে:

```bash
node alo build
```

তৈরি হওয়া সাইট থাকে `dist/` ফোল্ডারে।

একই কমান্ড তিনভাবে চালানো যায়, তিনটিই প্রজেক্টের নিজের ভার্সন চালায়: `node alo dev`, `npm run dev` অথবা `npx alo dev`।

## AI সহকারী দিয়ে কাজ করলে

Claude, ChatGPT, Cursor বা Copilot-এর মতো AI সহকারী Alo সম্পর্কে জানে না। আগে না জানালে সে React বা Vue-র ধরনে কোড লিখবে (`import`, `<li for>`, `{{ title }}`)। এ সমস্যা এড়াতে:

- **`alo init` দিয়ে বানানো প্রজেক্টে** রুটে একটি `AGENTS.md` থাকে। Claude Code, Cursor, Codex-এর মতো টুল ফোল্ডার খুললে এটি নিজে পড়ে নেয়; আপনাকে কিছু করতে হয় না।
- **চ্যাটে বা অন্য প্রজেক্টে** AI-কে এই লিংক দিন, বা প্রম্পটে লিখে দিন:

  > Read https://raw.githubusercontent.com/msilabs/alo/main/templates/init/AGENTS.md and follow it for all Alo code in this project.

গাইডটি ইংরেজিতে, কারণ AI-এর কাছে নিয়মগুলো এতে সবচেয়ে নির্ভুল পৌঁছায়। এতে আছে কঠোর নিয়ম, প্রজেক্টের গঠন, টেমপ্লেট, ডেটা, CSS আর JS, কমান্ড আর সবচেয়ে সাধারণ ভুলের তালিকা। রুটের [llms.txt](llms.txt) ফাইলেও একই লিংক আছে।

## এক পাতায় Alo

এটুকু জানলেই কাজ শুরু করা যায়।

1. **পেইজ:** `pages/about/page.alo` মানে `/about/`।
2. **লেআউট:** `layout.alo` তার ফোল্ডারের সব পেইজকে মোড়ায়। পেইজ বসে `<slot />`-এর জায়গায়।
3. **কম্পোনেন্ট:** `components/Card.alo` থাকলে লেখা যায় `<Card title="হ্যালো" />`। অ্যাট্রিবিউটই প্রপস; কম্পোনেন্টের ভেতরে পড়ুন `{{ props.title }}`।
4. **ডেটা:** `data/team.json` হয় `data.team`। `data/blog/` ফোল্ডারের JSON বা Markdown ফাইলগুলো হয় `data.blog` অ্যারে।
5. **টেমপ্লেট:** `{{ }}` দিয়ে মান বসানো। লুপ আর শর্ত লেখা হয় শুধু `<template>` ট্যাগে: `for`, `if`, `else-if`, `else`।
6. **CSS:** `<style>`-এর CSS শুধু সেই ফাইলে প্রযোজ্য হয়। `global/` ফোল্ডারের CSS প্রযোজ্য হয় সব পেইজে।
7. **JS:** `<script>`-এ সাধারণ JS। কম্পোনেন্টের নিজের এলিমেন্ট পাওয়া যায় `$el` দিয়ে।
8. **ডায়নামিক পেইজ:** `pages/blog/[slug]/page.alo` প্রতিটি পোস্টের জন্য একটি পেইজ বানায়; পোস্টের ডেটা থাকে `item`-এ।

| লিখবেন                                                     | কাজ                                      |
| ---------------------------------------------------------- | ---------------------------------------- |
| `{{ x }}`                                                  | মান বসানো                                |
| `{{{ html }}}`                                             | এস্কেপ ছাড়া HTML (যেমন Markdown-এর বডি) |
| `<template for="x in list">`                               | লুপ                                      |
| `<template if>` / `<template else-if>` / `<template else>` | শর্ত                                     |
| `<Card title="…" post="{{ post }}" />`                     | কম্পোনেন্ট আর প্রপস                      |
| `<slot />`                                                 | লেআউট বা কম্পোনেন্টে কনটেন্টের জায়গা    |

## পেইজ আর লেআউট

একটি `.alo` ফাইলে চারটি ব্লক থাকতে পারে, সবগুলোই ঐচ্ছিক:

```html
<head>
    <title>আমাদের কথা</title>
</head>

<template>
    <h1>আমাদের কথা</h1>
</template>

<style>
    h1 {
        color: tomato;
    }
</style>

<script>
    console.log('পেইজ খুলেছে');
</script>
```

ফোল্ডারই URL:

```
pages/
├── layout.alo           ← সব পেইজের হেডার-ফুটার
├── page.alo             → /
├── not-found.alo        → /404.html
├── about/
│   └── page.alo         → /about/
└── blog/
    ├── layout.alo       ← শুধু /blog/... এ
    ├── page.alo         → /blog/
    └── [slug]/
        └── page.alo     → /blog/<slug>/
```

লেআউটে ঠিক একটি `<slot />` থাকে, যেখানে পেইজ বসে:

```html
<!-- pages/layout.alo -->
<template>
    <Header />
    <main>
        <slot />
    </main>
    <Footer />
</template>
```

পেইজ প্রথমে বসে সবচেয়ে কাছের লেআউটে, তারপর উপরেরটিতে। সব লেআউট আর পেইজের `<head>` মিলে একটি হয়: শেষের `<title>` প্রাধান্য পায়, আর একই নামের `<meta>`-তেও শেষেরটি প্রাধান্য পায়। `<html>`, `<head>`, `<body>`, `charset` আর `viewport` Alo নিজে বসায়।

## কম্পোনেন্ট আর প্রপস

বড় হাতের অক্ষর দিয়ে শুরু হওয়া ট্যাগ মানেই কম্পোনেন্ট, ছোট হাতের অক্ষর দিয়ে শুরু হলে HTML। ফোল্ডারের নাম Dot Notation অনুযায়ী হয়:

| ফাইল                                 | ট্যাগ                   |
| ------------------------------------ | ----------------------- |
| `components/Card.alo`                | `<Card />`              |
| `components/blog/PostCard.alo`       | `<Blog.PostCard />`     |
| `components/post-list/Item.alo`      | `<PostList.Item />`     |

```html
<!-- components/Card.alo -->
<template>
    <article class="card {{ props.class }}">
        <h3>{{ props.title ?? 'শিরোনাম নেই' }}</h3>
        <slot>
            <p>কিছু লেখা নেই।</p>
        </slot>
    </article>
</template>
```

```html
<Card title="হ্যালো" class="mt-4">
    <p>কার্ডের ভেতরের লেখা</p>
</Card>
```

প্রপসের নিয়ম:

- `title="হ্যালো"` পাঠায় স্ট্রিং `"হ্যালো"`।
- `post="{{ post }}"`: পুরো মান একটি `{{ }}` হলে আসল মানটিই যায়, এখানে অবজেক্ট। `count="{{ 5 }}"` পাঠায় সংখ্যা `5`, আর `count="5"` পাঠায় স্ট্রিং `"5"`।
- `subtitle="পোস্ট: {{ post.title }}"`: মানের অংশে `{{ }}` থাকলে সবসময় স্ট্রিং।
- `featured` (মান ছাড়া) মানে `true`।
- `post-date="আজ"` পড়া হয় `props.postDate` দিয়ে।
- কম্পোনেন্টের ভেতরে প্রপ পড়া যায় শুধু `props` থেকে: `{{ props.title }}`, `{{ props.class }}`। না পাঠানো প্রপ `undefined`।
- `class` বা `id` নিজে থেকে কোথাও বসে না; কম্পোনেন্ট নিজে বসায়, যেমন উপরের `class="card {{ props.class }}"`।

`<slot />`-এ বসে কম্পোনেন্ট ট্যাগের ভেতরের কনটেন্ট। সেই কনটেন্ট রেন্ডার হয় ডাকার জায়গার ভেরিয়েবল দিয়েই। কিছু না পাঠালে দেখায় `<slot>`-এর ভেতরের ফলব্যাক।

ভুল নামের প্রপ পাঠালে Alo সতর্ক করে: "`<Card>`-এ `titel` কোথাও ব্যবহার হয়নি। আপনি কি `title` বোঝাতে চেয়েছিলেন?"

## `{{ }}` আর `<template>` লজিক

`{{ }}`-এর ভেতরে সাধারণ JavaScript লিখুন, যা চলে **বিল্ডের সময়**। ফল HTML-এস্কেপ হয়ে বসে।

```html
<p>মোট {{ data.blog.length }}টি লেখা</p>
<a href="/blog/{{ post.slug }}/">{{ post.title }}</a>
<p>দাম: {{ (price * 1.15).toFixed(2) }}</p>
```

- `null` আর `undefined` খালি লেখা হয়ে যায়।
- আক্ষরিক `{{` লিখতে চাইলে লিখুন `\{{`।
- অ্যাট্রিবিউটের পুরো মান `{{ }}` হলে:
  - মান `null` বা `undefined` হলে অ্যাট্রিবিউটটিই বাদ যায়। তাই `<img alt="{{ post.alt }}">`-এ `alt` না থাকলে আউটপুটে `alt` থাকে না।
  - `disabled`, `checked`, `hidden`, `open`-এর মতো অ্যাট্রিবিউট সত্য হলে বসে, মিথ্যা হলে বাদ যায়: `<button disabled="{{ !ready }}">`।

লুপ আর শর্ত লেখা হয় শুধু `<template>` ট্যাগে। ট্যাগটি নিজে আউটপুটে যায় না, যায় শুধু ভেতরের কনটেন্ট:

```html
<ul>
    <template for="(post, i) in data.blog">
        <li>{{ i + 1 }}. {{ post.title }}</li>
    </template>
</ul>

<template if="stock > 10">
    <span>স্টকে আছে</span>
</template>
<template else-if="stock > 0">
    <span>মাত্র {{ stock }}টি বাকি</span>
</template>
<template else>
    <span>শেষ হয়ে গেছে</span>
</template>
```

- `<li if>` বা `<Card for>` চলে না; `<template>` দিয়ে মোড়ান।
- একই `<template>`-এ `for` আর `if` একসাথে চলে না; একটির ভেতরে আরেকটি রাখুন।
- অবজেক্টের ওপর লুপ চালাতে লিখুন `Object.entries(obj)`।
- ডেটা বদলানো যায় না। `data.blog.reverse()` বা `sort()`-এর বদলে লিখুন `data.blog.toReversed()`, `toSorted()` বা `slice()`।

## ডেটা আর Markdown

`data/` ফোল্ডারের সবকিছু সব পেইজ, লেআউট আর কম্পোনেন্টে `data` হিসেবে পাওয়া যায়:

| ফাইল                            | পাওয়া যায়                          |
| ------------------------------- | ---------------------------------- |
| `data/site.json`                | `data.site`                        |
| `data/footer-links.json`        | `data.footerLinks`                 |
| `data/blog/*.md`, `*.json`      | `data.blog` (অ্যারে)               |
| `data/shop/products/*.json`     | `data.shop.products`               |

তিনটি নিয়ম:

- ফাইল মানে তার মান।
- শুধু ফাইলে ভর্তি ফোল্ডার মানে অ্যারে।
- সাবফোল্ডারওয়ালা ফোল্ডার মানে অবজেক্ট।

অ্যারের আইটেমগুলো সাজানো থাকে ফাইলের নাম অনুযায়ী:

- `2026-01-10-hello-world.md` থেকে `item.date` হয় `"2026-01-10"`, আর `item.slug` হয় `"hello-world"`।
- ক্রম নিজে ঠিক করতে নামের শুরুতে সংখ্যা দিন: `01-…`, `02-…`।
- `draft: true` থাকলে লেখাটি `build`-এ আসে না, শুধু `dev`-এ দেখা যায়।

`data/site.json`-এ থাকে সাইটের সেটিংস:

```json
{
    "name": "আমার সাইট",
    "lang": "bn",
    "url": "https://example.com"
}
```

`name` হলো ডিফল্ট শিরোনাম, আর `lang` বসে `<html lang>`-এ। `url` দিলে `sitemap.xml` তৈরি হয়; এতে শুধু origin থাকে, শেষে `/` ছাড়া।

Markdown ফাইলের শুরুতে থাকতে পারে ছোট YAML ফ্রন্ট ম্যাটার:

```markdown
---
title: হ্যালো ওয়ার্ল্ড
tags: [intro, news]
draft: false
---

# প্রথম লেখা

এটি **Markdown**-এ লেখা।
```

- ফ্রন্ট ম্যাটারে চলে `key: value`, লেখা, সংখ্যা, `true`/`false`/`null`, আর সাধারণ লিস্ট। নেস্টেড অবজেক্টের মতো জটিল ডেটার জন্য `.json` ফাইল ব্যবহার করুন।
- লেখাটি পাওয়া যায় `item.body`-তে, HTML হিসেবে। বসাতে লিখুন `{{{ item.body }}}`।
- Markdown-এ চলে হেডিং, লিস্ট, লিংক, ছবি, কোড ব্লক, টেবিল আর `~~কাটা লেখা~~`। প্রতিটি হেডিং নিজে থেকে `id` পায়, বাংলাতেও: `## যা যা লাগে` থেকে `id="যা-যা-লাগে"`।
- Markdown-এর ভেতরে `{{ }}` প্রসেস হয় না; কনটেন্ট মানে শুধু ডেটা।
- Markdown-এর ভেতরের HTML হুবহু আউটপুটে যায়, স্যানিটাইজ করা হয় না। এটি আপনার নিজের লেখা ধরে নেওয়া হয়, তাই বাইরের কারও লেখা সরাসরি এখানে রাখবেন না।

## ডায়নামিক পেইজ

`pages/blog/[slug]/page.alo` প্রতিটি `data/blog/` আইটেমের জন্য একটি পেইজ বানায়। আইটেমটি পাওয়া যায় `item`-এ:

```html
<!-- pages/blog/[slug]/page.alo -->
<head>
    <title>{{ item.title }} | {{ data.site.name }}</title>
</head>

<template>
    <article>
        <h1>{{ item.title }}</h1>
        <time>{{ item.date }}</time>
        {{{ item.body }}}
    </article>
</template>
```

ডায়নামিক ফোল্ডারের নাম সবসময় `[slug]`, আর সেটি পাথের শেষ ফোল্ডার। কম্পোনেন্ট `item` দেখে না; দরকার হলে প্রপ দিয়ে পাঠান: `<Blog.PostMeta post="{{ item }}" />`।

## CSS আর JS

`<style>`-এর CSS শুধু সেই ফাইলের এলিমেন্টে প্রযোজ্য হয়, তাই নাম মিলে যাওয়ার ভয় নেই। `global/` ফোল্ডারের সব `.css` আর `.js` প্রযোজ্য হয় সব পেইজে। কিছুই `<link>` বা `<script src>` দিয়ে যোগ করতে হয় না।

কম্পোনেন্টের `<script>` চলে প্রতিটি ইনস্ট্যান্সের জন্য আলাদা করে, আর `$el` হলো তার রুট এলিমেন্ট:

```html
<!-- components/Faq.alo -->
<template>
    <div class="faq">
        <button>{{ props.question }}</button>
        <p>{{ props.answer }}</p>
    </div>
</template>

<style>
    p {
        display: none;
    }
    .open p {
        display: block;
    }
</style>

<script>
    $el.querySelector('button').addEventListener('click', () => {
        $el.classList.toggle('open');
    });
</script>
```

বিল্ডের ডেটা JS-এ পাঠাতে সাধারণ HTML-এর `data-*` অ্যাট্রিবিউট ব্যবহার করুন:

```html
<template>
    <div class="counter" data-start="{{ props.start ?? 0 }}">
        <button>+</button> <span></span>
    </div>
</template>

<script>
    let n = Number($el.dataset.start);
    const span = $el.querySelector('span');
    span.textContent = n;
    $el.querySelector('button').addEventListener('click', () => {
        span.textContent = ++n;
    });
</script>
```

পেইজ আর লেআউটের `<script>`-এ `$el` নেই; সেখানে সাধারণ `document.querySelector` চলে। যে পেইজে স্ক্রিপ্টওয়ালা কোনো কম্পোনেন্ট বা নিজের স্ক্রিপ্ট নেই, সেখানে সেগুলোর JS যোগ হয় না; সব পেইজে যায় শুধু `global/`-এর JS (থাকলে)।

---

# পরে দেখুন

এই অংশগুলো দরকার পড়লে পড়ুন।

## রাউট গ্রুপ

বন্ধনীর ফোল্ডার URL-এ গোনা হয় না, কিন্তু লেআউট খোঁজার পথে থাকে। এতে কিছু পেইজকে আলাদা লেআউট দেওয়া যায়, বা লেআউট ছাড়াই রাখা যায়:

```
pages/
├── (site)/
│   ├── layout.alo        ← হেডার-ফুটার
│   ├── page.alo          → /
│   └── about/page.alo    → /about/
└── (bare)/
    └── launch/page.alo   → /launch/ (হেডার-ফুটার ছাড়া)
```

## `{{{ }}}`

`{{{ x }}}` বসায় এস্কেপ ছাড়া HTML। এটি শুধু লেখার জায়গায় চলে, অ্যাট্রিবিউটে নয়। সাধারণত লাগে শুধু Markdown-এর বডির জন্য। বাইরের কারও লেখা এভাবে বসালে সেটি নিরাপদ নয়।

## `<style global>` আর চাইল্ড কম্পোনেন্টের স্টাইল

`<style global>`-এর CSS স্কোপ ছাড়া হুবহু যায়। একটি ফাইলে `<style>` আর `<style global>` দুটিই থাকতে পারে।

প্যারেন্টের স্কোপড CSS চাইল্ড কম্পোনেন্টের ভেতরে পৌঁছায় না। চাইল্ডকে স্টাইল দেওয়ার দুটি উপায়:

- **`class` প্রপ পাঠান:** `<Card class="highlight" />`। কম্পোনেন্টে লেখা থাকে `class="card {{ props.class }}"`, তাই রুটে `highlight` বসে, আর প্যারেন্টের স্টাইল প্রযোজ্য হয়।
- **`<style global>` ব্যবহার করুন।** `{{{ }}}` দিয়ে বসানো Markdown-এর মতো কনটেন্ট স্টাইল করতেও এটিই লাগে।

## ইন্টারঅ্যাকটিভিটি

- ক্লিক, মেনু, ট্যাব, মোডাল, ফর্ম: `$el` আর `addEventListener`।
- বিল্ডের ডেটা JS-এ নেওয়া: `data-*` আর `$el.dataset`।
- কম্পোনেন্টের মধ্যে যোগাযোগ: `document.dispatchEvent(new CustomEvent('cart:add'))` আর `addEventListener`।
- পেইজ বদলালেও মান ধরে রাখা: `localStorage`।
- আরও বেশি লাগলে: `<head>`-এ একটি `<script>` দিয়ে যেকোনো JS লাইব্রেরি যোগ করা যায়, যেমন Alpine.js। Alo অচেনা অ্যাট্রিবিউট (`x-data`, `@click`, `:class`) যেমন আছে তেমন রাখে।

## কমান্ড

```bash
node alo init [folder]                # উদাহরণসহ নতুন প্রজেক্ট (npx @msilabs/alo init)
node alo dev [--port 3000] [--base /] # dev সার্ভার + লাইভ রিলোড
node alo build [--base /]             # dist/ এ প্রোডাকশন বিল্ড
node alo new page blog/first-post     # pages/blog/first-post/page.alo
node alo new page "(bare)/launch"     # pages/(bare)/launch/page.alo
node alo new layout blog              # pages/blog/layout.alo
node alo new component Card           # components/Card.alo
node alo new component blog/PostCard  # components/blog/PostCard.alo
node alo new post blog/hello-world    # data/blog/<আজকের তারিখ>-hello-world.md (খসড়া)
node alo --help
node alo --version
```

- `dev` বিল্ড করে `.alo/dev/`-এ। খসড়া দেখা যায়, আর এরর হলে ব্রাউজারেই এরর দেখায়। পোর্ট ব্যস্ত থাকলে পরেরটি নেয়।
- `build`-এর ফলে:
  - CSS মিনিফাই হয়।
  - CSS আর JS ফাইলের নামে কনটেন্টের হ্যাশ বসে, তাই ব্রাউজার নিশ্চিন্তে ক্যাশ করতে পারে।
  - `sitemap.xml` আর `robots.txt` তৈরি হয়।
  - `public/`-এর সবকিছু হুবহু কপি হয়।
- এরর হলে পুরনো `dist/` অক্ষত থাকে।

## এডিটর

VS Code-এর জন্য আছে [Alo এক্সটেনশন](https://marketplace.visualstudio.com/items?itemName=msilabs.alo-vscode):

- `{{ }}` আর `<template>` লজিকের রঙ, আর কম্পোনেন্ট ট্যাগের আলাদা রঙ।
- কম্পোনেন্ট, প্রপস, `data.` আর `item.`-এর অটোকমপ্লিট; Ctrl/Cmd-ক্লিকে কম্পোনেন্ট বা ডেটার ফাইল খোলে।
- লেখার সময়েই Alo-র এরর আর সতর্কবার্তা, সাথে এক ক্লিকের সমাধান, যেমন "`<Crad>` → `<Card>`"।
- নতুন পেইজ বা কম্পোনেন্ট বানানো, dev সার্ভার আর বিল্ডের কমান্ড।

`init` দিয়ে বানানো প্রজেক্ট খুললে VS Code নিজেই এক্সটেনশনটি ইনস্টলের প্রস্তাব দেয়। `init` যা বানায়:

- `.vscode/extensions.json`: এক্সটেনশনটির সুপারিশ।
- `.vscode/settings.json`: ট্যাবে শুধু `page.alo` না দেখিয়ে ফোল্ডারের নাম, যেমন "about (page)"।
- `.gitattributes`, যাতে GitHub `.alo` ফাইলকে HTML হিসেবে দেখায়: `*.alo linguist-language=HTML`

অন্য এডিটরে `.alo` ফাইল HTML হিসেবে খুলুন।

## ডিপ্লয়

`dist/` ফোল্ডারটিই পুরো সাইট।

**Netlify বা Cloudflare Pages:** বিল্ড কমান্ড `npm run build`, আর publish ফোল্ডার `dist`।

**cPanel বা যেকোনো সাধারণ হোস্টিং:** `node alo build` চালিয়ে `dist/`-এর ভেতরের সবকিছু `public_html`-এ আপলোড করুন।

**GitHub Pages:** সাইট থাকে `https://<user>.github.io/<repo>/`-এ, মানে একটি সাব-পাথে। তাই `--base` দিন। `.github/workflows/pages.yml`:

```yaml
name: Pages
on:
    push:
        branches: [main]
permissions:
    contents: read
    pages: write
    id-token: write
jobs:
    deploy:
        runs-on: ubuntu-latest
        environment:
            name: github-pages
            url: ${{ steps.deployment.outputs.page_url }}
        steps:
            - uses: actions/checkout@v7
            - uses: actions/setup-node@v7
              with:
                  node-version: 24
            - run: npm ci
            - run: node alo build --base /my-repo/
            - uses: actions/configure-pages@v6
            - uses: actions/upload-pages-artifact@v5
              with:
                  path: dist
            - id: deployment
              uses: actions/deploy-pages@v5
```

টেমপ্লেটে লিংক সবসময় লিখুন `/about/`-এর মতো করে; `--base` দিলে Alo নিজেই `/my-repo/about/` বানায়। JS থেকে base জানতে হলে: `document.documentElement.dataset.base ?? '/'`।

## FAQ

**`<template if>` আর `<template for>` কি ব্রাউজারে চলে?**

না। এগুলো চলে **বিল্ডের সময়, একবার**। Alo এগুলো দিয়ে HTML ফাইল তৈরি করে, তারপর এগুলোর আর অস্তিত্ব থাকে না; ব্রাউজার পায় শুধু তৈরি হওয়া HTML। ক্লিকে বা ইনপুটে যা বদলাবে, সেটি লিখুন কম্পোনেন্টের `<script>`-এ।

**`<li if>` বা `<Card for>` কেন চলে না?**

লজিক থাকে শুধু `<template>` ট্যাগে। তাই ফাইলে দেখেই বোঝা যায় কোথায় বিল্ডের সময় কিছু ঘটবে, আর বাকি সব খাঁটি HTML থাকে।

**লজিকের জন্য আলাদা কোনো সিনট্যাক্স নেই কেন?**

যাতে প্রতিটি `.alo` ফাইল সাধারণ HTML থাকে: এডিটর ঠিকমতো রঙ করে, ফরম্যাটার কাজ করে, আর HTML জানা যে কেউ পড়তে পারে। মান বসানোর জন্য শুধু `{{ }}`, আর লুপ ও শর্তের জন্য HTML-এর নিজের `<template>` ট্যাগ।

**কম্পোনেন্টে `{{ title }}` না লিখে `{{ props.title }}` কেন?**

এক নিয়ম, কোনো ব্যতিক্রম নেই: `class`-এর মতো JS-এর কীওয়ার্ডও `props.class` দিয়ে পড়া যায়। আর এতে প্রপ কখনো লুপের ভেরিয়েবলের সাথে মিশে যায় না।

**কম্পোনেন্টের প্রপ JS-এ কীভাবে পাব?**

সাধারণ HTML-এর মতো: `data-count="{{ props.count }}"` লিখুন, আর JS-এ পড়ুন `$el.dataset.count` দিয়ে।

**কনফিগারেশন ফাইল নেই, তাহলে GitHub Pages-এর সাব-পাথ কীভাবে দেব?**

`node alo build --base /repo-name/`। লিংক সবসময় `/about/`-এর মতো লিখুন; বাকি অংশ Alo নিজে বসায়।

**এরর মেসেজ কেমন দেখায়?**

প্রতিটি এররে থাকে ফাইল, লাইন, কোডের অংশ আর সমাধানের ইঙ্গিত:

```
✖ Error: pages/about/page.alo:12:5
  Component `<Crad>` not found.

  11 |   <h1>আমাদের সম্পর্কে</h1>
  12 |   <Crad title="মিশন" />
     |   ^
  13 | </template>

  Hint: Did you mean `<Card>`? (components/Card.alo)
```

## যা Alo ইচ্ছাকৃতভাবে করে না, আর কেন

- **রিঅ্যাক্টিভিটি, স্টেট, store, ভার্চুয়াল DOM, ক্লায়েন্ট-সাইড রাউটিং:** ছোট সাইটে লাগে না। দরকার হলে নিজের পছন্দের JS লাইব্রেরি যোগ করুন।
- **`import`, কনফিগারেশন ফাইল, প্লাগইন:** সবকিছু আসে ফোল্ডার আর ফাইলের নাম থেকে, তাই মনে রাখার কিছু নেই।
- **TypeScript আর সার্ভার-সাইড রেন্ডারিং:** Alo শুধু স্ট্যাটিক ফাইল বানায়, আর ব্রাউজারে চলে সাধারণ JS।
- **JS আর HTML মিনিফাই:** নিরাপদ JS মিনিফায়ারের জন্য পুরো JS পার্সার লাগে, অথচ ছোট সাইটে লাভ সামান্য। HTML-এর হোয়াইটস্পেস হুবহু রাখতে হয়।
- **reference-style Markdown লিংক, footnote, task list:** এগুলো আক্ষরিক লেখা হিসেবে আসে।
- **পেজিনেশন, নামযুক্ত স্লট, একাধিক লেভেলের ডায়নামিক রাউট:** আসল ব্যবহারকারীরা চাইলে পরে ভাবা হবে।

---

## Alo-তে কাজ করতে চাইলে

```bash
git clone https://github.com/msilabs/alo.git
cd alo
npm test
cd site && node ../bin/alo.js dev
```

- পুরো স্পেক: [docs/SPEC.md](docs/SPEC.md)
- নকশার সিদ্ধান্ত আর তাদের কারণ: [DECISIONS.md](DECISIONS.md)
- নতুন ফিচার প্রস্তাবের আগে স্পেকের অংশ ০-এর তিন প্রশ্ন দেখুন: HTML জানা কেউ কি দেখে বুঝবে? শিখতে হয় কি? ছোট সাইটে সত্যিই লাগে কি?

## লাইসেন্স

[MIT](LICENSE)
