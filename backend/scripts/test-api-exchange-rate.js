const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const requestUrl = new URL('/api/exchange-rates/latest', baseUrl);
requestUrl.searchParams.set('pair', 'USDVND');

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

async function main() {
  let response;
  try {
    response = await fetch(requestUrl, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err) {
    fail(`Request failed: ${err.message || err}`);
  }

  const bodyText = await response.text();
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (err) {
    fail(`Response was not valid JSON (status ${response.status})`, bodyText);
  }

  if (!Object.prototype.hasOwnProperty.call(data, 'rate')) {
    fail('Response is missing required key: rate', data);
  }

  if (!Object.prototype.hasOwnProperty.call(data, 'effectiveDate')) {
    fail('Response is missing required key: effectiveDate', data);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'warnings') && !Array.isArray(data.warnings)) {
    fail('Response warnings must be an array when present', data);
  }

  if (!response.ok) {
    fail(`Unexpected HTTP status ${response.status}`, data);
  }

  console.log(JSON.stringify({
    ok: true,
    status: response.status,
    rate: data.rate,
    effectiveDate: data.effectiveDate,
    warnings: data.warnings || [],
  }, null, 2));
}

main().catch(err => fail(err.message || String(err)));
