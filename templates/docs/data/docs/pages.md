---
title: পেইজ আর লেআউট
summary: ফোল্ডারের নাম থেকে ঠিকানা, আর সব পাতার সাধারণ কাঠামো।
section: মূল ধারণা
order: 2
---

Alo-তে কোনো রাউটের তালিকা লিখতে হয় না। `pages/`-এর ফোল্ডারই ঠিকানা।

```text
pages/page.alo                /
pages/about/page.alo          /about/
pages/docs/page.alo           /docs/
pages/docs/[slug]/page.alo    /docs/install/, /docs/pages/ ...
pages/not-found.alo           /404.html
```

নতুন পেইজ হাতে বানাতে পারেন, অথবা চালান:

```bash
node alo new page contact
```

## একটি পেইজ

`.alo` ফাইল সাধারণ HTML, কয়েকটি ব্লকে ভাগ করা। সব ব্লকই ঐচ্ছিক।

```html
<head>
    <title>যোগাযোগ</title>
</head>

<template>
    <h1>যোগাযোগ</h1>
    <p>আমাদের <a href="/about/">পরিচয়</a> পড়ুন।</p>
</template>

<style>
    h1 { color: tomato; }
</style>
```

- `<html>` বা `<body>` লিখতে হয় না; Alo নিজে বসায়।
- `<style>` শুধু এই ফাইলের HTML-এ লাগে, অন্য পাতায় ছড়ায় না।
- লিংক সবসময় `/about/`-এর মতো লিখুন: শুরুতে আর শেষে `/`।

## লেআউট

`layout.alo` তার ফোল্ডারের আর ভেতরের সব ফোল্ডারের পেইজকে মোড়ায়। পেইজের কনটেন্ট বসে `<slot />`-এর জায়গায়।

```html
<template>
    <Header />
    <main>
        <slot />
    </main>
    <Footer />
</template>
```

এই সাইটে লেআউট দুটি। `pages/layout.alo` সব পাতায় ওপরের মেনু আর ফুটার দেয়। `pages/docs/layout.alo` শুধু `/docs/`-এর পাতাগুলোতে পাশের মেনু যোগ করে।

## `[slug]` পেইজ

`pages/docs/[slug]/page.alo` একটিই ফাইল, কিন্তু `data/docs/`-এর প্রতিটি ফাইলের জন্য একটি করে পাতা বানায়। ফাইলের ডেটা পাওয়া যায় `item`-এ: `item.title`, `item.slug`, আর Markdown-এর লেখা `item.body`।
