import axios from 'axios';

export async function fetchHttp(url) {
  const res = await axios.get(url, { timeout: 15000 });
  const html = res.data;
  return {
    html,
    source_info: { fetched_url: url, fetched_at: new Date().toISOString() }
  };
} 