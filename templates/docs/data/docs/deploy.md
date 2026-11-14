---
title: প্রকাশ
summary: সাইট build করা আর ইন্টারনেটে তোলা।
section: প্রকাশ
order: 5
---

```bash
node alo build
```

এই কমান্ড `dist/` ফোল্ডারে সাধারণ HTML, CSS আর JS বানায়। ফোল্ডারটি যেকোনো স্ট্যাটিক হোস্টিংয়ে তুলে দিলেই সাইট চালু।

build-এ কোনো এরর থাকলে কমান্ডটি ফাইল, লাইন আর একটি ইঙ্গিত দেখায়, আর আগের `dist/` যেমন ছিল তেমনই থাকে।

## সাইটের ঠিকানা

`data/site.json`-এর `url`-এ আপনার সাইটের আসল ঠিকানা লিখুন, শেষে `/` ছাড়া:

```json
{
    "url": "https://docs.example.com"
}
```

Alo এখান থেকে `sitemap.xml` বানায়।

## Netlify বা Cloudflare Pages

- build কমান্ড: `npm run build`
- publish ফোল্ডার: `dist`

## GitHub Pages

GitHub Pages-এ সাইট থাকে `https://<user>.github.io/<repo>/`-এ, মানে একটি সাব-পাথে। তাই build-এ `--base` দিন:

```bash
node alo build --base /my-repo/
```

লিংকগুলো আগের মতোই `/docs/`-এর মতো লেখা থাকবে; Alo নিজে `/my-repo/docs/` বানিয়ে নেয়।

## এরপর

এই নমুনা পাতাগুলো মুছে `data/docs/`-এ নিজের পাতা লিখুন, আর `data/sections.json`-এ নিজের অংশের নাম দিন।
