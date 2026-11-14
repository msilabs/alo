---
title: কম্পোনেন্ট
summary: বারবার লাগে এমন HTML একবার লিখে ট্যাগের মতো ব্যবহার করা।
section: মূল ধারণা
order: 3
---

`components/`-এর প্রতিটি `.alo` ফাইল একটি কম্পোনেন্ট। ফাইলের নামই ট্যাগের নাম; কোনো `import` লাগে না।

```text
components/Header.alo          <Header />
components/docs/Sidebar.alo    <Docs.Sidebar />
```

ফোল্ডারের ভেতরের কম্পোনেন্ট সবসময় পুরো নামে লিখতে হয়: `<Docs.Sidebar />`, শুধু `<Sidebar />` নয়।

নতুন কম্পোনেন্ট:

```bash
node alo new component Card
```

## প্রপস আর স্লট

```html
<!-- components/Card.alo -->
<template>
    <article class="card">
        <h3>{{ props.title }}</h3>
        <slot />
    </article>
</template>

<style>
    .card { padding: 1rem; border: 1px solid var(--border); }
</style>
```

ব্যবহার:

```html
<Card title="প্রথম কার্ড">
    <p>এই লেখাটি বসে slot-এর জায়গায়।</p>
</Card>
```

- কম্পোনেন্টের ভেতরে প্রপস পড়তে হয় `props.title` লিখে।
- সংখ্যা বা অবজেক্ট পাঠাতে `{{ }}` দিন: `<Card count="{{ 5 }}" />`।
- কম্পোনেন্টের `<style>` শুধু নিজের HTML-এ লাগে।

## স্ক্রিপ্ট

কম্পোনেন্টের `<script>` ব্রাউজারে চলে, প্রতিটি ব্যবহারের জন্য একবার। `$el` হলো কম্পোনেন্টের বাইরের এলিমেন্ট।

```html
<script>
    $el.querySelector('button').addEventListener('click', () => {
        $el.classList.toggle('open');
    });
</script>
```

এই সাইটে ফোনের পর্দায় পাশের মেনু খোলা-বন্ধ হয় এভাবেই; দেখুন `components/docs/Sidebar.alo`।
