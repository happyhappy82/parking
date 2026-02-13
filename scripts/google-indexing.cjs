/**
 * Google Indexing API로 새 URL 제출
 *
 * 환경변수:
 *   SITE_URL                    - 사이트 기본 URL (https://parkingmap.kr)
 *   PUBLISHED_SLUG              - 발행된 글 slug
 *   GOOGLE_SERVICE_ACCOUNT_JSON - Google Service Account JSON (Base64 or raw)
 */

const { google } = require('googleapis');

async function main() {
  const siteUrl = process.env.SITE_URL;
  const slug = process.env.PUBLISHED_SLUG;
  const serviceAccountRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!siteUrl || !slug) {
    console.log('SITE_URL or PUBLISHED_SLUG missing — skipping');
    return;
  }

  if (!serviceAccountRaw) {
    console.log('GOOGLE_SERVICE_ACCOUNT_JSON missing — skipping');
    return;
  }

  // Service Account JSON 파싱 (Base64 또는 raw JSON)
  let credentials;
  try {
    credentials = JSON.parse(serviceAccountRaw);
  } catch {
    try {
      credentials = JSON.parse(Buffer.from(serviceAccountRaw, 'base64').toString('utf-8'));
    } catch (err) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
      process.exit(1);
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  const client = await auth.getClient();
  const url = `${siteUrl}/blog/${slug}/`;

  console.log(`Submitting URL: ${url}`);

  try {
    const res = await client.request({
      url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
      method: 'POST',
      data: {
        url,
        type: 'URL_UPDATED',
      },
    });

    console.log(`Google Indexing API response: ${res.status}`);
    console.log(`URL: ${res.data.urlNotificationMetadata?.url || url}`);
    console.log(`Latest update: ${res.data.urlNotificationMetadata?.latestUpdate?.type || 'N/A'}`);
  } catch (err) {
    console.error(`Google Indexing API error: ${err.message}`);
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(`Data: ${JSON.stringify(err.response.data)}`);
    }
    // 인덱싱 실패는 치명적이지 않으므로 exit(1) 안 함
  }
}

main();
