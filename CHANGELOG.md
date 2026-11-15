# পরিবর্তনের তালিকা

## 1.2.1 (২০২৬-১১-১৫)

### নিরাপত্তা

Socket.dev-এর দুটি "potential security risk" সতর্কতার জন্য।

- **Markdown (`core/markdown.js`):**
  - ইনপুটের raw HTML (ইনলাইন আর ব্লক) এখন ডিফল্টভাবে এস্কেপ হয়। আগে সরাসরি আউটপুটে যেত।
  - `renderMarkdown(text, { allowHtml: true })` দিলে HTML চলে, তবে একটি allowlist sanitizer-এর ভেতর দিয়ে। `script`, `style`, `iframe`, `svg`, `object`, কমেন্ট, `on...` হ্যান্ডলার আর `style` অ্যাট্রিবিউট বাদ যায়; `href`/`src`-এর URL-ও যাচাই হয়।
  - লিংকে শুধু `http`, `https`, `mailto` আর ছবিতে শুধু `http`, `https` চলে। relative URL (`/a`, `a/b`, `#x`, `?q`, `//host`) ঠিক থাকে। `javascript:`, `data:`, `vbscript:` আর বাকি স্কিমের লিংক বাদ যায়, লেখাটি থাকে; ছবির বদলে alt লেখা আসে।
  - স্কিম পড়ার আগে শুরুর whitespace আর control character বাদ যায়; `jav&#x61;script:`, `java\tscript:`, `%20javascript:`-এর মতো লুকানো রূপও ধরা পড়ে।
  - অ্যাট্রিবিউটের মান সবসময় এস্কেপ হয়।
- **এক্সপ্রেশন (`core/expression.js`):** `new Function` আর এরর ডায়াগনস্টিকের দ্বিতীয় dynamic evaluation সরানো হয়েছে। এখন নিজস্ব tokenizer, parser আর evaluator চলে।
  - চলে: সংখ্যা, স্ট্রিং, টেমপ্লেট লিটারাল, regex, `true`/`false`/`null`, array আর object (spread সহ), `.` `?.` `[]`, মেথড কল, `new Date` আর `new Intl.*`, সব সাধারণ অপারেটর, `??`, `? :`, `typeof`, `in`, আর `x => x.title`-এর মতো অ্যারো ফাংশন।
  - global শুধু `Math`, `JSON`, `Date`, `Intl`, `Number`, `String`, `Boolean`, `Array`, `RegExp`, `Map`, `Set`, `parseInt` ইত্যাদি, আর `Object.keys/values/entries/fromEntries/hasOwn/assign`। `process`, `require`, `globalThis`, `Function`, `eval` নেই।
  - `__proto__`, `constructor`, `prototype` (আর `__` দিয়ে শুরু যেকোনো নাম) পড়া বা লেখা ব্লক।
  - এরর মেসেজ এখন শুধু স্ট্যাটিক টেক্সট; এরর খুঁজতে আর কোনো এক্সপ্রেশন চালানো হয় না।
- **স্ক্রিপ্ট (`core/assets.js`):** `node:vm` সরানো হয়েছে।

### বদল (ভাঙা পরিবর্তন)

- Markdown-এর raw HTML ডিফল্টভাবে লেখা হিসেবে দেখায়। আগের আচরণ ফেরাতে কোডে `allowHtml: true` লাগবে, তবে তখনও sanitizer চলবে (যেমন `<script>`, `style="..."`, `<iframe>` আর অজানা ট্যাগ বাদ যায়)। বর্তমানে `alo` CLI থেকে এই অপশন চালু করার উপায় নেই।
- Markdown-এর লিংক বা ছবিতে `ftp:`, `tel:`, `data:` ইত্যাদি স্কিম আর চলে না।
- `<script>` আর `global/*.js`-এর JavaScript syntax এখন বিল্ডের সময় যাচাই হয় না; ভুল থাকলে ধরা পড়ে ব্রাউজারে।
- এক্সপ্রেশনে `function () {}`, `class`, `this`, `++`/`--`, কমা অপারেটর, block-body অ্যারো ফাংশন (`x => { ... }`) আর `process`/`require`-এর মতো global চলে না। `data.x = 1`-এর মতো লেখা আগের মতোই "cannot be changed" এরর দেয়।

## 1.2.0 (২০২৬-১১-১৪)

### নতুন

- `alo init`-এ `--template`: `blank`, `portfolio`, `docs`, `landing`। না দিলে আগের মতোই ছোট উদাহরণ সাইট তৈরি হয় (`default`)।
  - `blank`: শুধু একটি পেইজ, কোনো CSS বা কম্পোনেন্ট ছাড়া।
  - `portfolio`: প্রজেক্ট, about আর যোগাযোগের পাতা; about পাতা প্রিন্ট করলে CV-র মতো আসে।
  - `docs`: Markdown থেকে ডকুমেন্টেশন সাইট, পাশে মেনু আর আগের/পরের লিংক।
  - `landing`: এক পাতার প্রোডাক্ট সাইট: hero, ফিচার, দাম, প্রশ্ন।
- সব টেমপ্লেট প্যাকেজের ভেতরেই থাকে, তাই `init` অফলাইনেও চলে। নতুন টেমপ্লেটগুলোতে বাইরের কোনো ফন্ট বা লিংক নেই।
- অজানা টেমপ্লেটের নামে এরর আসে, সাথে কাছাকাছি নাম আর পুরো তালিকা; ডিস্কে কিছু লেখা হয় না।

### বদল

- অজানা ফ্ল্যাগের ইঙ্গিতে আর ফ্ল্যাগের তালিকা থাকে না, শুধু থাকে "Run `alo --help` for everything."

## 1.1.0 (২০২৬-১১-১১)

### নতুন

- `alo init` প্রজেক্টে একটি `.vscode/extensions.json` রাখে, যা [Alo VS Code এক্সটেনশন](https://marketplace.visualstudio.com/items?itemName=msilabs.alo-vscode) সুপারিশ করে। প্রজেক্টটি VS Code-এ খুললে VS Code নিজেই এক্সটেনশনটি ইনস্টল করার প্রস্তাব দেয়।
- ফোল্ডারের কম্পোনেন্টকে ছোট নামে লিখলে (`components/blog/PostCard.alo`-এর জন্য `<PostCard />`) এখন ইঙ্গিতে আসে পুরো নাম: "Did you mean `<Blog.PostCard>`?" আগে ইঙ্গিত নতুন ফাইল বানাতে বলত।

### বদল

- `alo init` আর `.vscode/settings.json`-এ `"files.associations": { "*.alo": "html" }` লেখে না। এই সেটিং থাকলে VS Code `.alo` ফাইল HTML হিসেবে খোলে আর এক্সটেনশন কাজ করতে পারে না। পুরনো প্রজেক্টে সেটিংটি সরিয়ে দিন। এক্সটেনশন নিজেও এটি খুঁজে পেয়ে সরানোর প্রস্তাব দেয়।
- ছোট হাতের অক্ষরে শুরু হওয়া ডটওয়ালা ট্যাগ (`<blog.PostCard />`) এখন এরর, সাথে ইঙ্গিত "For the component, write `<Blog.PostCard>`." আগে এটি নীরবে একটি অবৈধ HTML ট্যাগ হিসেবে আউটপুটে যেত।

### ঠিক করা

- `components/`-এ বড় হাতের ফোল্ডার (যেমন `components/Blog/`) থাকলে `build` আর `dev` "Unexpected error" দিয়ে থেমে যেত। এখন আসল এরর দেখায়: "Component folder name `Blog` is not allowed."

### ডকুমেন্টেশন

- README-তে নতুন অংশ "ফোল্ডারে কম্পোনেন্ট": নামের নিয়ম, একই ফোল্ডার থেকেও পুরো নাম লেখা, আর সাধারণ ভুলের তালিকা।
- README আর `AGENTS.md`: `class` প্রপ দিয়ে চাইল্ড কম্পোনেন্টকে স্টাইল করার সঠিক উপায়। প্যারেন্টের সাধারণ `<style>` চাইল্ডের রুটে লাগে না; স্টাইল লিখতে হয় কম্পোনেন্টের নিজের `<style>`-এ বা `<style global>`-এ।

## 1.0.0 (২০২৬-১১-০৬)

প্রথম স্থিতিশীল রিলিজ।
