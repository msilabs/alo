---
title: ডেটা আর লজিক
summary: JSON আর Markdown ফাইল থেকে তালিকা বানানো, লুপ আর শর্ত।
section: মূল ধারণা
order: 4
---

`data/`-এর ফাইলগুলো সব পেইজ আর কম্পোনেন্টে `data` নামে পাওয়া যায়।

```text
data/site.json       data.site       একটি অবজেক্ট
data/menu.json       data.menu       একটি তালিকা
data/docs/*.md       data.docs       প্রতিটি ফাইল তালিকার একটি আইটেম
```

## মান দেখানো

`{{ }}`-এর ভেতরে সাধারণ JavaScript লেখা যায়। এটি চলে build-এর সময়, ব্রাউজারে নয়।

```html
<h1>{{ data.site.name }}</h1>
<p>মোট {{ data.docs.length }}টি পাতা</p>
```

## লুপ আর শর্ত

লুপ আর শর্ত লেখা হয় শুধু `<template>` ট্যাগে।

```html
<ul>
    <template for="doc in data.docs">
        <li><a href="/docs/{{ doc.slug }}/">{{ doc.title }}</a></li>
    </template>
</ul>

<template if="data.docs.length === 0">
    <p>এখনো কোনো পাতা নেই।</p>
</template>
<template else>
    <p>পড়া শুরু করুন।</p>
</template>
```

## সাজানো

ডেটা বদলানো যায় না, তাই `sort()`-এর বদলে `toSorted()` ব্যবহার করুন। এটি নতুন একটি তালিকা দেয়।

```html
<template for="doc in data.docs.toSorted((a, b) => a.order - b.order)">
    ...
</template>
```

## Markdown ফাইল

ফাইলের শুরুতে `---` এর মাঝের লাইনগুলো আইটেমের তথ্য হয় (`doc.title`, `doc.order`)। ফাইলের নাম হয় `doc.slug`, আর বাকি লেখা `doc.body`।

`[slug]` পেইজে লেখাটি দেখাতে তিনটি ব্র্যাকেট লাগে, কারণ এটি তৈরি HTML:

```html
{{{ item.body }}}
```

একটি পাতা আপাতত লুকাতে ওপরে `draft: true` লিখুন। তখন সেটি `node alo dev`-এ দেখা যায়, `node alo build`-এ বাদ পড়ে।
