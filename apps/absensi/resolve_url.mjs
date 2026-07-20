const url = 'https://maps.app.goo.gl/PdSzxzHMHVYkvrZP9';

fetch(url, { redirect: 'manual' })
  .then(res => {
    console.log('Redirect Location:', res.headers.get('location'));
  })
  .catch(err => console.error(err));
