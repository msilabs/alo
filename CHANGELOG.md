# পরিবর্তনের তালিকা

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
