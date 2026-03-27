fetch('http://localhost:3001/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'tôi là huy' })
}).then(res => res.json()).then(console.log).catch(console.error);
