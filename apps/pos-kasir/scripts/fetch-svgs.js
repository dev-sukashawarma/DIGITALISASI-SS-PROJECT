async function run() {
  const urls = {
    gojek: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/gojek.svg',
    shopee: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/shopee.svg',
    grab: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/grab.svg',
    tiktok: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/tiktok.svg'
  };
  for (const [key, url] of Object.entries(urls)) {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`--- ${key} ---`);
    console.log(text);
  }
}
run();
